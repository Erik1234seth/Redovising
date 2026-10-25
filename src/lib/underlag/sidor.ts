import type { SupabaseClient } from '@supabase/supabase-js';
import { lasUtTransaktioner } from '@/lib/transaktioner/import';
import type { Definition } from './definiera';

/**
 * Dokument i flera sidor som kommer in som separata filer — ett kvitto
 * fotograferat sida för sida. Var för sig räcker sidorna inte: sida 1 har
 * varuraderna, sida 2 summan och momsen. Lästa var för sig blir det två
 * transaktioner för samma köp, och en fråga till kunden om något som står
 * på den andra sidan.
 *
 * Definiera plockar ut dokumentnummer, org.nr, datum och "sida 1 av 2" när
 * det står på underlaget. Sidor med samma dokument kopplas ihop: den lägsta
 * sidan blir huvudunderlaget och de andra får `del_av` satt till den. Bara
 * huvudunderlaget läses ut, och då med alla sidor som ett dokument.
 *
 * Saknas en sida står den i `sidor_saknas` på huvudunderlaget, och då läses
 * ingenting ut förrän den kommit. Frågemejlet kl 18 dagen efter ber kunden om
 * den (se `@/lib/transaktioner/fragemejl`).
 *
 * Underlag utan sidnummer berörs inte — de flesta har inget.
 */

interface Sidrad {
  id: string;
  user_id: string | null;
  sender_email: string | null;
  gmail_message_id: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
  definition: Definition | null;
  del_av: string | null;
  sidor_saknas: number[] | null;
  transaktioner_utlasta_at: string | null;
}

const KOLUMNER = 'id, user_id, sender_email, gmail_message_id, file_name, file_path, mime_type, created_at, definition, del_av, sidor_saknas, transaktioner_utlasta_at';
/** Sidorna i ett dokument kommer in inom den här tiden. */
const DAGAR = 60;

const nummer = (s?: string | null) => s?.replace(/[\s\-–.:]/g, '').toLowerCase() || null;
const orgnr = (s?: string | null) => s?.replace(/\D/g, '') || null;
const namn = (s?: string | null) => s?.toLowerCase().replace(/\b(ab|hb|kb|aktiebolag)\b/g, '').replace(/[^a-zåäö0-9]/g, '') || null;

/**
 * Om två sidor hör till samma dokument. Med dokumentnummer på båda avgör
 * numret. Utan det krävs mer: samma mejl, samma datum och samma motpart.
 */
function sammaDokument(a: Sidrad, b: Sidrad): boolean {
  const x = a.definition!, y = b.definition!;
  if (x.antalSidor !== y.antalSidor || x.sida === y.sida) return false;
  if (orgnr(x.orgnr) && orgnr(y.orgnr) && orgnr(x.orgnr) !== orgnr(y.orgnr)) return false;
  if (x.datum && y.datum && x.datum !== y.datum) return false;
  if (nummer(x.dokumentnummer) && nummer(y.dokumentnummer)) return nummer(x.dokumentnummer) === nummer(y.dokumentnummer);
  const sammaMotpart = (!!orgnr(x.orgnr) && orgnr(x.orgnr) === orgnr(y.orgnr)) || (!!namn(x.motpart) && namn(x.motpart) === namn(y.motpart));
  return !!a.gmail_message_id && a.gmail_message_id === b.gmail_message_id && !!x.datum && x.datum === y.datum && sammaMotpart;
}

/**
 * Kopplar ihop underlaget med dokumentets andra sidor och räknar ut vilka som
 * saknas. Har ett huvudunderlag redan lästs ut och dokumentet ändrats — sidan
 * som saknades har kommit — läses det om här. Underlaget som definieras nu
 * läser den som anropade själv.
 */
export async function samlaSidor(supabase: SupabaseClient, underlagId: string): Promise<void> {
  const { data: egen, error } = await supabase.from('bokforing_underlag').select(KOLUMNER).eq('id', underlagId).maybeSingle<Sidrad>();
  if (error) throw new Error(`Kunde inte läsa underlaget: ${error.message}`);
  if (!egen) return;

  const d = egen.definition;
  if (!d?.sida || !d.antalSidor || (!egen.user_id && !egen.sender_email)) {
    // Inte en sida (längre) — släpp den ur ett dokument den legat i
    if (egen.del_av || egen.sidor_saknas) {
      await supabase.from('bokforing_underlag').update({ del_av: null, sidor_saknas: null }).eq('id', egen.id);
      if (egen.del_av) await samlaSidor(supabase, egen.del_av);
    }
    return;
  }

  let q = supabase.from('bokforing_underlag').select(KOLUMNER)
    .neq('id', egen.id)
    .eq('definition->>antalSidor', String(d.antalSidor))
    .gte('created_at', new Date(new Date(egen.created_at).getTime() - DAGAR * 86_400_000).toISOString())
    .lte('created_at', new Date(new Date(egen.created_at).getTime() + DAGAR * 86_400_000).toISOString());
  q = egen.user_id ? q.eq('user_id', egen.user_id) : q.eq('sender_email', egen.sender_email!);
  const { data: andra, error: aFel } = await q.returns<Sidrad[]>();
  if (aFel) throw new Error(`Kunde inte leta efter dokumentets andra sidor: ${aFel.message}`);

  // En fil per sida — samma sida inskickad två gånger är en dubblett, och den första gäller
  const perSida = new Map<number, Sidrad>([[d.sida, egen]]);
  for (const s of [...(andra ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!sammaDokument(egen, s)) continue;
    const sida = s.definition!.sida!;
    if (!perSida.has(sida)) perSida.set(sida, s);
  }
  const sidor = [...perSida.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  const huvud = sidor[0];
  const saknas = Array.from({ length: d.antalSidor }, (_, i) => i + 1).filter((n) => !perSida.has(n));

  const andrade: Sidrad[] = [];
  for (const s of sidor) {
    const delAv = s.id === huvud.id ? null : huvud.id;
    const saknasNu = s.id === huvud.id && saknas.length ? saknas : null;
    if (s.del_av === delAv && JSON.stringify(s.sidor_saknas ?? null) === JSON.stringify(saknasNu)) continue;
    const { error: uFel } = await supabase.from('bokforing_underlag').update({ del_av: delAv, sidor_saknas: saknasNu }).eq('id', s.id);
    if (uFel) throw new Error(`Kunde inte koppla ihop sidorna: ${uFel.message}`);
    andrade.push({ ...s, del_av: delAv, sidor_saknas: saknasNu });
  }
  if (!andrade.length) return;

  // Det som redan lästs ut ur en sida som nu är del av ett annat underlag tas
  // bort, och huvudunderlaget läses om med alla sidor. Underlaget som
  // definieras nu läses av den som anropade.
  for (const s of andrade) {
    if (s.id === egen.id || !s.transaktioner_utlasta_at) continue;
    if (s.id === huvud.id || s.del_av) {
      await lasUtTransaktioner(supabase, s.id).catch((err) =>
        console.error(`[sidor] kunde inte läsa om ${s.file_name}:`, err instanceof Error ? err.message : err));
    }
  }
}

/** Dokumentets övriga sidor i ordning — huvudunderlaget självt ingår inte. */
export async function dokumentetsSidor(supabase: SupabaseClient, huvudId: string): Promise<Pick<Sidrad, 'id' | 'file_name' | 'file_path' | 'mime_type' | 'definition'>[]> {
  const { data, error } = await supabase.from('bokforing_underlag')
    .select('id, file_name, file_path, mime_type, definition').eq('del_av', huvudId);
  if (error) throw new Error(`Kunde inte läsa dokumentets sidor: ${error.message}`);
  return (data ?? []).sort((a, b) => (a.definition?.sida ?? 0) - (b.definition?.sida ?? 0));
}
