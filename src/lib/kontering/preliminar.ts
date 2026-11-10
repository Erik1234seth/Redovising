import type { SupabaseClient } from '@supabase/supabase-js';
import { tolkaBetalsatt, type Betalsatt } from './betalsatt';
import { TRANSAKTION_KOLUMNER, bokfor, type ValdKontering } from './kontera';
import { rensaMomsdelar, sammaMoms, tolkaOmvand, type Momsdel, type Omvand } from './momsdelar';

/**
 * Sedan 2026-11-10 bokförs konteringen direkt: Flöde gör verifikationer av
 * de gröna när körningen är klar, och en gul blir verifikation när byrån
 * godkänner den eller väljer konto (`valjKonto`). En omkörning i Flöde
 * ersätter transaktionerna, och verifikationerna försvinner med dem.
 * Momsfilen, huvudboken och NE läser verifikationerna.
 *
 * Det som blir verifikation är byråns val om det finns, annars AI:ns
 * kontering när den är grön. Finns flera förslag (från tiden då två modeller
 * konterade) ska alla vara gröna och överens. Allt annat väntar på granskning.
 *
 * `transaktioner.preliminar_at` säger att transaktionen får bokföras. Är den
 * tom (bokföringen ångrad i Kontering) väntar transaktionen tills byrån väljer
 * konto. Cron-jobbet /api/cron/verifikationer kör `bokforForfallna` en gång om
 * dygnet och tar det som inte gick att bokföra direkt.
 */

export const PRELIMINAR_DAGAR = 0;
const DAG = 86_400_000;

/** Dagen konteringen blir verifikation, YYYY-MM-DD. */
export function verifikationFran(preliminarAt: string | null): string | null {
  return preliminarAt ? new Date(new Date(preliminarAt).getTime() + PRELIMINAR_DAGAR * DAG).toISOString().slice(0, 10) : null;
}

interface KonteringRad {
  konto: string | null;
  momssats: number | string | null;
  momsdelar: unknown;
  /** Saknas där den inte valts ur databasen — då jämförs konteringarna utan den. */
  omvand?: string | null;
  omdome: string;
}

export interface SlutligKontering {
  konto: string;
  momssats: number;
  momsdelar: Momsdel[] | null;
  omvand: Omvand | null;
  motkonto: string | null;
  signatur: 'Erik' | 'AI';
}

/** Det som blir verifikation, eller null när transaktionen väntar på granskning. */
export function slutligKontering(vald: ValdKontering | null, konteringar: KonteringRad[]): SlutligKontering | null {
  if (vald?.konto) {
    return {
      konto: vald.konto, momssats: Number(vald.momssats) || 0, momsdelar: rensaMomsdelar(vald.momsdelar),
      omvand: tolkaOmvand(vald.omvand), motkonto: vald.motkonto, signatur: 'Erik',
    };
  }
  const moms = (k: KonteringRad) => ({ momssats: Number(k.momssats), momsdelar: rensaMomsdelar(k.momsdelar), omvand: tolkaOmvand(k.omvand) });
  const [a] = konteringar;
  const gron = konteringar.length >= 1 && konteringar.every((k) => k.omdome === 'gron' && k.konto && k.konto === a.konto
    && sammaMoms(moms(k), moms(a)));
  if (!gron) return null;
  return { konto: a.konto!, ...moms(a), momssats: Number(a.momssats) || 0, motkonto: null, signatur: 'AI' };
}

type Rad = Parameters<typeof bokfor>[1] & { vald_kontering: ValdKontering | null; preliminar_at: string | null };

/**
 * Gör klara konteringar till verifikationer. Det som redan är bokfört och
 * dubbletter rörs inte.
 */
export async function bokforForfallna(
  supabase: SupabaseClient,
  { userId, underlagId, transaktionIds, nu = false }: { userId?: string; underlagId?: string; transaktionIds?: string[]; nu?: boolean } = {},
): Promise<{ bokforda: number; fel: string[] }> {
  const grans = new Date(Date.now() - PRELIMINAR_DAGAR * DAG).toISOString();
  const rader: Rad[] = [];
  for (let fran = 0; ; fran += 1000) {
    let q = supabase.from('transaktioner').select(`${TRANSAKTION_KOLUMNER}, vald_kontering, preliminar_at`)
      .not('user_id', 'is', null).is('dublett_av', null).is('dublett_orsak', null).not('preliminar_at', 'is', null)
      .order('id').range(fran, fran + 999);
    if (!nu) q = q.lte('preliminar_at', grans);
    if (userId) q = q.eq('user_id', userId);
    if (underlagId) q = q.eq('underlag_id', underlagId);
    if (transaktionIds) q = q.in('id', transaktionIds);
    const { data, error } = await q;
    if (error) throw new Error(`Kunde inte läsa transaktionerna: ${error.message}`);
    rader.push(...(data ?? []) as unknown as Rad[]);
    if (!data || data.length < 1000) break;
  }

  const res = { bokforda: 0, fel: [] as string[] };
  const betalsatt = new Map<string, Betalsatt | null>();
  const metod = new Map<string, string | null>();
  for (let i = 0; i < rader.length; i += 200) {
    const del = rader.slice(i, i + 200);
    const ids = del.map((t) => t.id);
    const [k, v] = await Promise.all([
      supabase.from('konteringar').select('transaktion_id, konto, momssats, momsdelar, omvand, omdome').in('transaktion_id', ids),
      supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', ids),
    ]);
    if (k.error ?? v.error) throw new Error((k.error ?? v.error)!.message);
    const bokforda = new Set((v.data ?? []).map((x) => x.transaktion_id));

    for (const t of del) {
      if (bokforda.has(t.id) || !(Number(t.belopp) > 0)) continue;
      const slutlig = slutligKontering(t.vald_kontering, (k.data ?? []).filter((x) => x.transaktion_id === t.id));
      if (!slutlig) continue;
      if (!betalsatt.has(t.user_id)) {
        const { data: p } = await supabase.from('profiles').select('har_foretagskonto, redovisningsmetod').eq('id', t.user_id).maybeSingle();
        betalsatt.set(t.user_id, tolkaBetalsatt(p?.har_foretagskonto ?? null));
        metod.set(t.user_id, p?.redovisningsmetod ?? null);
      }
      const bs = betalsatt.get(t.user_id);
      const namn = [t.motpart, t.beskrivning].filter(Boolean).join(', ') || t.id;
      if (!bs) { res.fel.push(`${namn}: kunden saknar betalsätt (Kundkontext)`); continue; }
      try {
        await bokfor(supabase, t, slutlig.konto, slutlig.momssats, bs, slutlig.signatur, slutlig.motkonto ?? undefined, slutlig.momsdelar, slutlig.omvand, metod.get(t.user_id));
        res.bokforda++;
      } catch (err) {
        res.fel.push(`${namn}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return res;
}
