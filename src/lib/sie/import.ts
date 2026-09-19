import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSieFile, tolkaSie } from './parse';

/**
 * Lägger in verifikationerna ur ett SIE-underlag i kundens verifikationer.
 *
 * Körs när ett underlag kommer in (mejl och adminuppladdning), och i efterhand
 * för SIE-filer som ännu inte lagts in — kunden kan ladda upp i appen, där
 * ingen server är inblandad, och filer från före den här funktionen ska med.
 *
 * Utfallet skrivs på underlagsraden (verifikationer_*), så att det syns på
 * personsidan vad varje fil gav. En fil tolkas bara en gång.
 *
 * Samma verifikation kan finnas i flera exporter — kunden skickar en SIE för
 * halvåret och sedan en för helåret. Den som redan finns hos kunden läggs inte
 * in igen, utan räknas som dubblett. Raderas filen som äger den tar en av de
 * andra filerna över (reimportAfterDelete).
 */

const BUCKET = 'bokforing-underlag';
const CHUNK = 500;

/** SIE-datum som inte är riktiga datum får inte stoppa hela importen. */
const asDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

export interface SieImportResult {
  inlagda: number;
  dubbletter: number;
  fel?: string;
}

export async function importSieUnderlag(supabase: SupabaseClient, underlagId: string): Promise<SieImportResult | null> {
  const { data: row, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, file_name, file_path, verifikationer_inlagda_at')
    .eq('id', underlagId)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa underlaget: ${error.message}`);
  if (!row || !isSieFile(row.file_name) || row.verifikationer_inlagda_at) return null;

  const result = await importRow(supabase, row).catch((err): SieImportResult => ({
    inlagda: 0,
    dubbletter: 0,
    fel: err instanceof Error ? err.message : 'Okänt fel',
  }));

  await supabase.from('bokforing_underlag').update({
    verifikationer_inlagda_at: new Date().toISOString(),
    verifikationer_antal: result.inlagda,
    verifikationer_dubbletter: result.dubbletter,
    verifikationer_fel: result.fel ?? null,
  }).eq('id', row.id);

  return result;
}

async function importRow(
  supabase: SupabaseClient,
  row: { id: string; user_id: string | null; sender_email: string | null; file_path: string },
): Promise<SieImportResult> {
  const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(row.file_path);
  if (downloadError || !file) throw new Error(`Filen saknas i lagringen: ${downloadError?.message ?? 'okänt fel'}`);

  const sie = tolkaSie(new Uint8Array(await file.arrayBuffer()));
  if (sie.verifikationer.length === 0) {
    return { inlagda: 0, dubbletter: 0, fel: sie.varningar[0] ?? 'Inga verifikationer i filen' };
  }

  const email = row.sender_email?.trim().toLowerCase() || null;
  const orgnr = sie.header.orgnr.replace(/\D/g, '');
  const rar = sie.header.rakenskapsar.find((r) => r.id === '0') ?? sie.header.rakenskapsar[0];

  // Räkenskapsåret ingår i nyckeln: numreringen börjar om varje år
  const externId = (v: { serie: string; nummer: string; datum: string }) => {
    const year = rar?.start || v.datum.slice(0, 4);
    return `${orgnr}|${year}|${v.serie}|${v.nummer}`;
  };

  // Det kunden redan har, på kontot eller adressen
  const owner = row.user_id ? { column: 'user_id', value: row.user_id } : { column: 'customer_email', value: email };
  const existing = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('verifikationer')
      .select('extern_id')
      .eq(owner.column, owner.value)
      .not('extern_id', 'is', null)
      .range(from, from + 999);
    if (error) throw new Error(`Kunde inte läsa verifikationer: ${error.message}`);
    for (const r of data ?? []) existing.add(r.extern_id as string);
    if ((data ?? []).length < 1000) break;
  }

  const fresh = sie.verifikationer.filter((v) => {
    const key = externId(v);
    if (existing.has(key)) return false;
    existing.add(key); // samma nummer två gånger i samma fil räknas också som dubblett
    return true;
  });

  // Id:na sätts här, så att raderna kan peka på sin verifikation utan att vi
  // behöver lita på ordningen i det som databasen skickar tillbaka
  const vers = fresh.map((v) => ({
    id: randomUUID(),
    user_id: row.user_id,
    customer_email: email,
    underlag_id: row.id,
    kalla: 'sie',
    extern_id: externId(v),
    serie: v.serie,
    nummer: v.nummer,
    datum: asDate(v.datum),
    text: v.text || null,
    registrerad: asDate(v.registrerad),
    signatur: v.signatur || null,
    summa: v.summa,
    balanserad: v.balanserad,
    orgnr: orgnr || null,
  }));

  const rader = fresh.flatMap((v, i) => v.transaktioner.map((t, radnr) => ({
    verifikation_id: vers[i].id,
    radnr,
    konto: t.konto,
    kontonamn: t.kontonamn || null,
    belopp: t.belopp,
    datum: asDate(t.datum),
    text: t.text || null,
    objekt: t.objekt,
    kvantitet: Number.isFinite(t.kvantitet) ? t.kvantitet : null,
    borttagen: t.borttagen,
    tillagd: t.tillagd,
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
    await supabase.from('verifikationer').delete().eq('underlag_id', row.id);
    throw err;
  }

  // Det filen äger efteråt, inte bara det som lades in nu — vid en omkörning
  // finns filens egna verifikationer redan och ska inte räknas som dubbletter
  const { count, error: countError } = await supabase
    .from('verifikationer')
    .select('id', { count: 'exact', head: true })
    .eq('underlag_id', row.id);
  if (countError) throw new Error(`Kunde inte räkna verifikationer: ${countError.message}`);
  const owned = count ?? vers.length;
  return { inlagda: owned, dubbletter: sie.verifikationer.length - owned };
}

/**
 * Efter att ett underlag raderats: filer hos samma kund som hade dubbletter
 * kan nu innehålla verifikationer som ingen fil äger längre. De körs om, så
 * att verifikationerna finns kvar så länge någon fil har dem.
 */
export async function reimportAfterDelete(
  supabase: SupabaseClient,
  owner: { userId: string | null; email: string | null },
): Promise<void> {
  const parts = [
    ...(owner.userId ? [`user_id.eq.${owner.userId}`] : []),
    ...(owner.email ? [`sender_email.eq."${owner.email}"`] : []),
  ];
  if (!parts.length) return;

  const { data, error } = await supabase
    .from('bokforing_underlag')
    .select('id')
    .or(parts.join(','))
    .gt('verifikationer_dubbletter', 0)
    .order('created_at');
  if (error) {
    console.error('[sie/import] kunde inte läsa filer att köra om:', error.message);
    return;
  }

  for (const row of data ?? []) {
    await supabase.from('bokforing_underlag').update({ verifikationer_inlagda_at: null }).eq('id', row.id);
    await importSieUnderlag(supabase, row.id).catch((err) =>
      console.error('[sie/import] omkörning:', err instanceof Error ? err.message : err));
  }
}

/**
 * Lägger in SIE-filer som inte lagts in än. Kallas från adminvyerna, så att
 * filer kunden laddat upp i appen kommer med utan något eget jobb.
 */
export async function importPendingSie(
  supabase: SupabaseClient,
  owner?: { userIds?: string[]; emails?: string[] },
): Promise<number> {
  let query = supabase
    .from('bokforing_underlag')
    .select('id, file_name, user_id, sender_email')
    .is('verifikationer_inlagda_at', null)
    .or('file_name.ilike.%.se,file_name.ilike.%.si,file_name.ilike.%.sie')
    .order('created_at')
    .limit(20);

  if (owner) {
    const parts = [
      ...(owner.userIds?.length ? [`user_id.in.(${owner.userIds.join(',')})`] : []),
      ...(owner.emails?.length ? [`sender_email.in.(${owner.emails.map((e) => `"${e}"`).join(',')})`] : []),
    ];
    if (!parts.length) return 0;
    query = query.or(parts.join(','));
  }

  const { data, error } = await query;
  if (error) {
    console.error('[sie/import] kunde inte läsa väntande SIE-filer:', error.message);
    return 0;
  }

  let done = 0;

  // En i taget, i inkomstordning — då blir det den äldsta filen som äger en
  // verifikation som finns i flera
  for (const row of data ?? []) {
    if (!isSieFile(row.file_name)) continue;
    try {
      if (await importSieUnderlag(supabase, row.id)) done++;
    } catch (err) {
      console.error(`[sie/import] ${row.file_name}:`, err instanceof Error ? err.message : err);
    }
  }
  return done;
}
