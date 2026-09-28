import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Flaggar banktransaktioner som troligen redan finns på annat håll.
 *
 * Samma köp syns ofta två gånger: som kvitto eller faktura som AI:n läst ut,
 * och som dragning på kontot. Utbetalningar från Zettle och Shopify syns i
 * banken men är redan bokförda i dagskassan på 1930. Ingenting raderas — raden
 * får bara dublett_av (den andra transaktionen) eller dublett_orsak (texten om
 * dagskassan), så att den som konterar ser det.
 *
 * Matchningen är belopp, valuta och riktning exakt, och datum inom några dagar
 * eftersom kortköp bokförs på kontot ett par dagar efter kvittot. Varje
 * underlagsrad kan bara matcha en bankrad. Allt räknas om varje gång, så en
 * rad som raderats eller lästs om tappar sin flagga.
 */

const MAX_DAGAR = 5;
const PAGE = 1000;

interface Rad {
  id: string;
  kalla: string;
  datum: string | null;
  belopp: number;
  valuta: string;
  riktning: string;
  dublett_av: string | null;
  dublett_orsak: string | null;
}

function dagar(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function sammaBelopp(a: number, b: number) {
  return Math.abs(a - b) < 0.005;
}

async function lasRader(supabase: SupabaseClient, userId: string): Promise<Rad[]> {
  const out: Rad[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transaktioner')
      .select('id, kalla, datum, belopp, valuta, riktning, dublett_av, dublett_orsak')
      .eq('user_id', userId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Kunde inte läsa transaktionerna: ${error.message}`);
    for (const r of data ?? []) out.push({ ...r, belopp: Number(r.belopp) } as Rad);
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

/** Bankinsättningar som redan är bokförda i en Zettle- eller Shopify-dagskassa. */
async function lasDagskassor(supabase: SupabaseClient, userId: string, fran: string) {
  const { data, error } = await supabase
    .from('verifikationer')
    .select('kalla, datum, verifikation_rader(konto, belopp, borttagen)')
    .eq('user_id', userId)
    .in('kalla', ['zettle', 'shopify'])
    .gte('datum', fran);
  if (error) throw new Error(`Kunde inte läsa dagskassorna: ${error.message}`);

  const out: { kalla: string; datum: string; belopp: number }[] = [];
  for (const v of data ?? []) {
    const rader = (v.verifikation_rader ?? []) as { konto: string; belopp: number; borttagen: boolean }[];
    for (const r of rader) {
      if (r.konto === '1930' && !r.borttagen && Number(r.belopp) > 0 && v.datum) {
        out.push({ kalla: v.kalla, datum: v.datum, belopp: Number(r.belopp) });
      }
    }
  }
  return out;
}

export async function markeraDubbletter(supabase: SupabaseClient, userId: string) {
  const rader = await lasRader(supabase, userId);
  const bank = rader.filter((r) => r.kalla === 'bank' && r.datum).sort((a, b) => a.datum!.localeCompare(b.datum!));
  if (bank.length === 0) return 0;

  const underlag = rader.filter((r) => r.kalla !== 'bank' && r.datum);
  const upptagna = new Set<string>();
  const onskat = new Map<string, { dublett_av: string | null; dublett_orsak: string | null }>();

  for (const b of bank) {
    let basta: Rad | null = null;
    for (const u of underlag) {
      if (upptagna.has(u.id) || u.valuta !== b.valuta || u.riktning !== b.riktning || !sammaBelopp(u.belopp, b.belopp)) continue;
      const d = dagar(u.datum!, b.datum!);
      if (d <= MAX_DAGAR && (!basta || d < dagar(basta.datum!, b.datum!))) basta = u;
    }
    if (basta) upptagna.add(basta.id);
    onskat.set(b.id, { dublett_av: basta?.id ?? null, dublett_orsak: null });
  }

  const kassor = await lasDagskassor(supabase, userId, bank[0].datum!);
  const anvandaKassor = new Set<number>();
  for (const b of bank) {
    if (b.riktning !== 'in' || b.valuta !== 'SEK' || onskat.get(b.id)?.dublett_av) continue;
    const i = kassor.findIndex((k, n) => !anvandaKassor.has(n) && sammaBelopp(k.belopp, b.belopp) && dagar(k.datum, b.datum!) <= MAX_DAGAR);
    if (i < 0) continue;
    anvandaKassor.add(i);
    const k = kassor[i];
    onskat.set(b.id, {
      dublett_av: null,
      dublett_orsak: `Redan bokförd i ${k.kalla === 'zettle' ? 'Zettle' : 'Shopify'}-dagskassan ${k.datum}`,
    });
  }

  let andrade = 0;
  for (const b of bank) {
    const ny = onskat.get(b.id)!;
    if (ny.dublett_av === b.dublett_av && ny.dublett_orsak === b.dublett_orsak) continue;
    const { error } = await supabase.from('transaktioner').update(ny).eq('id', b.id);
    if (error) throw new Error(`Kunde inte flagga dubbletter: ${error.message}`);
    andrade++;
  }
  return andrade;
}
