import type { SupabaseClient } from '@supabase/supabase-js';
import { tolkaBetalsatt, type Betalsatt } from './betalsatt';
import { TRANSAKTION_KOLUMNER, bokfor, type ValdKontering } from './kontera';
import { rensaMomsdelar, sammaMoms, type Momsdel } from './momsdelar';

/**
 * Konteringen är preliminär i 14 dagar. Under tiden går den att ändra hur
 * mycket som helst — konteras om, få ett annat konto, eller försvinna när en
 * sida till samma kvitto kommer in och underlaget läses om. Ingenting ligger
 * i bokföringen förrän tiden gått.
 *
 * Klockan räknas från `transaktioner.preliminar_at`, som sätts varje gång
 * konteringen ändras: ny AI-kontering, ett konto Erik valt, en ändrad
 * transaktion, en ångrad bokföring.
 *
 * Det som blir verifikation är byråns val om det finns, annars modellernas
 * kontering när båda är gröna och överens. Allt annat väntar på granskning.
 *
 * Cron-jobbet /api/cron/verifikationer kör `bokforForfallna` en gång om dygnet.
 */

export const PRELIMINAR_DAGAR = 14;
const DAG = 86_400_000;

/** Dagen konteringen blir verifikation, YYYY-MM-DD. */
export function verifikationFran(preliminarAt: string | null): string | null {
  return preliminarAt ? new Date(new Date(preliminarAt).getTime() + PRELIMINAR_DAGAR * DAG).toISOString().slice(0, 10) : null;
}

interface KonteringRad {
  konto: string | null;
  momssats: number | string | null;
  momsdelar: unknown;
  omdome: string;
}

export interface SlutligKontering {
  konto: string;
  momssats: number;
  momsdelar: Momsdel[] | null;
  motkonto: string | null;
  signatur: 'Erik' | 'AI';
}

/** Det som blir verifikation, eller null när transaktionen väntar på granskning. */
export function slutligKontering(vald: ValdKontering | null, konteringar: KonteringRad[]): SlutligKontering | null {
  if (vald?.konto) {
    return { konto: vald.konto, momssats: Number(vald.momssats) || 0, momsdelar: rensaMomsdelar(vald.momsdelar), motkonto: vald.motkonto, signatur: 'Erik' };
  }
  const [a] = konteringar;
  const gron = konteringar.length >= 2 && konteringar.every((k) => k.omdome === 'gron' && k.konto && k.konto === a.konto
    && sammaMoms({ momssats: Number(k.momssats), momsdelar: rensaMomsdelar(k.momsdelar) }, { momssats: Number(a.momssats), momsdelar: rensaMomsdelar(a.momsdelar) }));
  if (!gron) return null;
  return { konto: a.konto!, momssats: Number(a.momssats) || 0, momsdelar: rensaMomsdelar(a.momsdelar), motkonto: null, signatur: 'AI' };
}

type Rad = Parameters<typeof bokfor>[1] & { vald_kontering: ValdKontering | null; preliminar_at: string | null };

/**
 * Gör preliminära konteringar till verifikationer. Utan `nu` bara de som
 * legat orörda i 14 dagar; med `nu` alla som är klara — för knappen i
 * flödesschemat. Det som redan är bokfört och dubbletter rörs inte.
 */
export async function bokforForfallna(
  supabase: SupabaseClient,
  { userId, underlagId, nu = false }: { userId?: string; underlagId?: string; nu?: boolean } = {},
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
    const { data, error } = await q;
    if (error) throw new Error(`Kunde inte läsa transaktionerna: ${error.message}`);
    rader.push(...(data ?? []) as unknown as Rad[]);
    if (!data || data.length < 1000) break;
  }

  const res = { bokforda: 0, fel: [] as string[] };
  const betalsatt = new Map<string, Betalsatt | null>();
  for (let i = 0; i < rader.length; i += 200) {
    const del = rader.slice(i, i + 200);
    const ids = del.map((t) => t.id);
    const [k, v] = await Promise.all([
      supabase.from('konteringar').select('transaktion_id, konto, momssats, momsdelar, omdome').in('transaktion_id', ids),
      supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', ids),
    ]);
    if (k.error ?? v.error) throw new Error((k.error ?? v.error)!.message);
    const bokforda = new Set((v.data ?? []).map((x) => x.transaktion_id));

    for (const t of del) {
      if (bokforda.has(t.id) || !(Number(t.belopp) > 0)) continue;
      const slutlig = slutligKontering(t.vald_kontering, (k.data ?? []).filter((x) => x.transaktion_id === t.id));
      if (!slutlig) continue;
      if (!betalsatt.has(t.user_id)) {
        const { data: p } = await supabase.from('profiles').select('har_foretagskonto').eq('id', t.user_id).maybeSingle();
        betalsatt.set(t.user_id, tolkaBetalsatt(p?.har_foretagskonto ?? null));
      }
      const bs = betalsatt.get(t.user_id);
      const namn = [t.motpart, t.beskrivning].filter(Boolean).join(', ') || t.id;
      if (!bs) { res.fel.push(`${namn}: kunden saknar betalsätt (Kundkontext)`); continue; }
      try {
        await bokfor(supabase, t, slutlig.konto, slutlig.momssats, bs, slutlig.signatur, slutlig.motkonto ?? undefined, slutlig.momsdelar);
        res.bokforda++;
      } catch (err) {
        res.fel.push(`${namn}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return res;
}
