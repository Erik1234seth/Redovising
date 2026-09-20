import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extraheraTransaktioner, kanLasasAvAi } from './extract';

/**
 * Kör AI-avläsningen på ett underlag och sparar transaktionerna hos kunden.
 *
 * Startas för hand från adminpanelen — Erik markerar filerna och kör. Till
 * skillnad från SIE-importen, som sker av sig själv när filen kommer in,
 * kostar det här pengar per fil och ska ske när någon vill det.
 *
 * Körs en fil om igen ersätts det som lästes ut förra gången. Utfallet skrivs
 * på underlagsraden (transaktioner_*), så att det syns per fil vad den gav.
 */

const BUCKET = 'bokforing-underlag';
const CHUNK = 500;

export interface TransaktionResultat {
  antal: number;
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

  const result = await lasRad(supabase, row).catch((err): TransaktionResultat => ({
    antal: 0,
    fel: err instanceof Error ? err.message : 'Okänt fel',
  }));

  await supabase.from('bokforing_underlag').update({
    transaktioner_utlasta_at: new Date().toISOString(),
    transaktioner_antal: result.antal,
    transaktioner_notering: result.notering || null,
    transaktioner_fel: result.fel ?? null,
  }).eq('id', row.id);

  return result;
}

async function lasRad(supabase: SupabaseClient, row: UnderlagRad): Promise<TransaktionResultat> {
  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(row.file_path);
  if (downloadError || !file) {
    throw new Error(`Filen saknas i lagringen: ${downloadError?.message ?? 'okänt fel'}`);
  }

  const { transaktioner, modell, notering } = await extraheraTransaktioner({
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: row.file_name,
    mimeType: row.mime_type,
  });

  // Det som lästes ut förra gången ersätts — annars dubbleras raderna vid en
  // omkörning, och det är just omkörningen man vill göra när avskriften blev fel
  const { error: deleteError } = await supabase.from('transaktioner').delete().eq('underlag_id', row.id);
  if (deleteError) throw new Error(`Kunde inte rensa tidigare transaktioner: ${deleteError.message}`);

  if (transaktioner.length === 0) {
    return { antal: 0, notering, fel: 'AI:n hittade inga transaktioner i filen' };
  }

  const email = row.sender_email?.trim().toLowerCase() || null;
  // Samma ägarskap som verifikationerna: kontot när det finns, adressen när
  // filen bara hör ihop med en mejladress
  if (!row.user_id && !email) throw new Error('Underlaget hör varken till ett konto eller en adress');

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

  return { antal: rows.length, notering };
}
