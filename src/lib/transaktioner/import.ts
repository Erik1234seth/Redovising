import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { befintligaVerifikationsnycklar, verifikationsnyckel } from '@/lib/sie/import';
import { byggMejlkontext } from '@/lib/mejlkontext';
import { markeraDubbletter } from './dubbletter';
import { extraheraTransaktioner, kanLasasAvAi, type ExtraheradTransaktion, type ExtraheradVerifikation } from './extract';
import type { Underlagstyp } from './normalisera';

/**
 * Kör AI-avläsningen på ett underlag och sparar resultatet hos kunden.
 *
 * Startas för hand från adminpanelen — Erik markerar filerna och kör. Till
 * skillnad från SIE-importen, som sker av sig själv när filen kommer in,
 * kostar det här pengar per fil och ska ske när någon vill det.
 *
 * AI:n avgör vad filen är. Ett kvitto eller kontoutdrag blir transaktioner,
 * ett redan bokfört underlag blir verifikationer med kontona som står i det.
 *
 * Körs en fil om igen ersätts det som lästes ut förra gången, oavsett vilken
 * sort det blev då. Utfallet skrivs på underlagsraden — transaktioner_* eller
 * verifikationer_* — så att det syns per fil vad den gav.
 */

const BUCKET = 'bokforing-underlag';
const CHUNK = 500;

export interface TransaktionResultat {
  typ: Underlagstyp;
  antal: number;
  /** Verifikationer som redan fanns hos kunden och inte lades in igen. */
  dubbletter?: number;
  /** Sandlådans rad om vad den läste — tom för bilder och PDF. */
  notering?: string;
  fel?: string;
}

interface UnderlagRad {
  id: string;
  user_id: string | null;
  sender_email: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
}

export async function lasUtTransaktioner(
  supabase: SupabaseClient,
  underlagId: string,
): Promise<TransaktionResultat> {
  const { data: row, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, file_name, file_path, mime_type')
    .eq('id', underlagId)
    .maybeSingle<UnderlagRad>();
  if (error) throw new Error(`Kunde inte läsa underlaget: ${error.message}`);
  if (!row) throw new Error('Underlaget finns inte');

  if (!kanLasasAvAi(row.file_name, row.mime_type)) {
    throw new Error(`${row.file_name} är inte en filtyp vi kan läsa av (bild, PDF, Excel eller CSV)`);
  }

  let kraschade = false;
  const result = await lasRad(supabase, row).catch((err): TransaktionResultat => {
    kraschade = true;
    return { typ: 'transaktioner', antal: 0, fel: err instanceof Error ? err.message : 'Okänt fel' };
  });

  const nu = new Date().toISOString();

  // Avbröts körningen innan något sparats ligger förra resultatet kvar, och
  // då ska bara felet skrivas — inte det gamla nollställas
  if (kraschade) {
    await supabase.from('bokforing_underlag').update({
      transaktioner_utlasta_at: nu,
      transaktioner_fel: result.fel,
    }).eq('id', row.id);
    return result;
  }

  // Bara en av sorterna gäller för filen. Den andra nollställs, annars visar
  // panelen kvar vad en tidigare körning gav.
  await supabase.from('bokforing_underlag').update(result.typ === 'verifikationer' ? {
    verifikationer_inlagda_at: nu,
    verifikationer_antal: result.antal,
    verifikationer_dubbletter: result.dubbletter ?? 0,
    verifikationer_fel: result.fel ?? null,
    transaktioner_utlasta_at: null,
    transaktioner_antal: null,
    transaktioner_notering: result.notering || null,
    transaktioner_fel: null,
  } : {
    transaktioner_utlasta_at: nu,
    transaktioner_antal: result.antal,
    transaktioner_notering: result.notering || null,
    transaktioner_fel: result.fel ?? null,
    verifikationer_inlagda_at: null,
    verifikationer_antal: null,
    verifikationer_dubbletter: null,
    verifikationer_fel: null,
  }).eq('id', row.id);

  return result;
}

async function lasRad(supabase: SupabaseClient, row: UnderlagRad): Promise<TransaktionResultat> {
  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(row.file_path);
  if (downloadError || !file) {
    throw new Error(`Filen saknas i lagringen: ${downloadError?.message ?? 'okänt fel'}`);
  }

  const email = row.sender_email?.trim().toLowerCase() || null;

  // Kundens mejl följer med, så att det kunden skrivit om filen — ofta ett
  // datum som saknas på kvittot — kommer med i avläsningen
  let kontoEmail: string | null = null;
  if (row.user_id) {
    const { data: profil } = await supabase.from('profiles').select('email').eq('id', row.user_id).maybeSingle();
    kontoEmail = profil?.email ?? null;
  }
  const mejl = await byggMejlkontext(supabase, { userId: row.user_id, emails: [email, kontoEmail] });

  const svar = await extraheraTransaktioner({
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: row.file_name,
    mimeType: row.mime_type,
    lagradSom: row.file_path.split('/').pop(),
    mejl: mejl || undefined,
  });
  // Samma ägarskap som SIE-verifikationerna: kontot när det finns, adressen
  // när filen bara hör ihop med en mejladress
  if (!row.user_id && !email) throw new Error('Underlaget hör varken till ett konto eller en adress');

  // Det som lästes ut förra gången ersätts — annars dubbleras raderna vid en
  // omkörning, och det är just omkörningen man vill göra när avskriften blev
  // fel. Båda sorterna rensas, ifall filen lästes som den andra sorten då.
  const { error: deleteError } = await supabase.from('transaktioner').delete().eq('underlag_id', row.id);
  if (deleteError) throw new Error(`Kunde inte rensa tidigare transaktioner: ${deleteError.message}`);
  const { error: deleteVerError } = await supabase.from('verifikationer').delete().eq('underlag_id', row.id).eq('kalla', 'ai');
  if (deleteVerError) throw new Error(`Kunde inte rensa tidigare verifikationer: ${deleteVerError.message}`);

  if (svar.typ === 'verifikationer') {
    const res = await sparaVerifikationer(supabase, row, email, svar.verifikationer);
    return { typ: 'verifikationer', notering: svar.notering, ...res };
  }

  const antal = await sparaTransaktioner(supabase, row, email, svar.transaktioner, svar.modell);
  return antal === 0
    ? { typ: 'transaktioner', antal: 0, notering: svar.notering, fel: 'AI:n hittade inga transaktioner i filen' }
    : { typ: 'transaktioner', antal, notering: svar.notering };
}

async function sparaTransaktioner(
  supabase: SupabaseClient,
  row: UnderlagRad,
  email: string | null,
  transaktioner: ExtraheradTransaktion[],
  modell: string,
): Promise<number> {
  if (transaktioner.length === 0) return 0;

  const rows = transaktioner.map((t, i) => ({
    id: randomUUID(),
    user_id: row.user_id,
    customer_email: email,
    underlag_id: row.id,
    radnr: i + 1,
    datum: t.datum || null,
    beskrivning: t.beskrivning,
    motpart: t.motpart || null,
    belopp: t.belopp,
    moms: t.moms,
    valuta: t.valuta,
    riktning: t.riktning,
    anteckning: t.anteckning || null,
    detaljer: t.detaljer || null,
    kalla: 'ai',
    modell,
  }));

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error: insertError } = await supabase.from('transaktioner').insert(rows.slice(i, i + CHUNK));
    if (insertError) {
      // Halva listan är värre än ingen — då tror man att filen är avläst
      await supabase.from('transaktioner').delete().eq('underlag_id', row.id);
      throw new Error(`Kunde inte spara transaktionerna: ${insertError.message}`);
    }
  }

  // Nya kvitton kan vara samma köp som redan hämtats från banken
  if (row.user_id) {
    await markeraDubbletter(supabase, row.user_id).catch((err) => console.error('[transaktioner] dubblettkollen misslyckades:', err));
  }

  return rows.length;
}

/**
 * Sparar verifikationerna ur ett redan bokfört underlag.
 *
 * Bara de som går jämnt ut sparas. AI:n skriver av siffrorna, och en
 * verifikation där debet och kredit inte möts är en felläsning — den ska inte
 * hamna i bokföringen. De som inte gick ihop räknas upp i felet på filen.
 *
 * Finns verifikationen redan hos kunden, från en SIE-fil eller en annan
 * avläsning, läggs den inte in igen. Det kräver ett verifikationsnummer —
 * utan det går det inte att säga att två är samma.
 */
async function sparaVerifikationer(
  supabase: SupabaseClient,
  row: UnderlagRad,
  email: string | null,
  verifikationer: ExtraheradVerifikation[],
): Promise<Omit<TransaktionResultat, 'typ' | 'notering'>> {
  if (verifikationer.length === 0) {
    return { antal: 0, dubbletter: 0, fel: 'AI:n hittade inga verifikationer i filen' };
  }

  const obalanserade = verifikationer.filter((v) => !v.balanserad);
  const balanserade = verifikationer.filter((v) => v.balanserad);

  const owner = row.user_id
    ? { column: 'user_id' as const, value: row.user_id }
    : { column: 'customer_email' as const, value: email! };
  const befintliga = await befintligaVerifikationsnycklar(supabase, owner);

  const nya = balanserade.filter((v) => {
    const key = verifikationsnyckel(v);
    if (!key) return true;
    if (befintliga.has(key)) return false;
    befintliga.add(key); // samma nummer två gånger i samma fil räknas också som dubblett
    return true;
  });

  const vers = nya.map((v) => ({
    id: randomUUID(),
    user_id: row.user_id,
    customer_email: email,
    underlag_id: row.id,
    kalla: 'ai',
    serie: v.serie || null,
    nummer: v.nummer || null,
    datum: v.datum || null,
    text: v.text || null,
    summa: v.summa,
    balanserad: true,
  }));

  const rader = nya.flatMap((v, i) => v.rader.map((r, radnr) => ({
    verifikation_id: vers[i].id,
    radnr,
    konto: r.konto,
    kontonamn: r.kontonamn || null,
    belopp: r.belopp,
    text: r.text || null,
    objekt: [],
    borttagen: false,
    tillagd: false,
  })));

  try {
    for (let i = 0; i < vers.length; i += CHUNK) {
      const { error } = await supabase.from('verifikationer').insert(vers.slice(i, i + CHUNK));
      if (error) throw new Error(`Kunde inte spara verifikationer: ${error.message}`);
    }
    for (let i = 0; i < rader.length; i += CHUNK) {
      const { error } = await supabase.from('verifikation_rader').insert(rader.slice(i, i + CHUNK));
      if (error) throw new Error(`Kunde inte spara konteringsrader: ${error.message}`);
    }
  } catch (err) {
    // Halva filen inlagd är värre än ingen — städa bort det som hann in
    await supabase.from('verifikationer').delete().eq('underlag_id', row.id).eq('kalla', 'ai');
    throw err;
  }

  const namn = (v: ExtraheradVerifikation) => `${v.serie}${v.nummer}`.trim() || v.datum || v.text || '?';
  const fel = obalanserade.length
    ? `${obalanserade.length} av ${verifikationer.length} verifikationer gick inte jämnt ut och lades inte in: `
      + obalanserade.slice(0, 10).map(namn).join(', ')
      + (obalanserade.length > 10 ? ' …' : '')
    : undefined;

  return { antal: vers.length, dubbletter: balanserade.length - nya.length, fel };
}
