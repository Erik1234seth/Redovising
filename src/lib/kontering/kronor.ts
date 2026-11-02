import type { SupabaseClient } from '@supabase/supabase-js';
import { valutakurs } from '@/lib/valutakurser';

/**
 * Bokföringen sker i kronor. En transaktion i utländsk valuta räknas om när
 * den konteras, och omräkningen sparas i transaktioner.kronor — beloppet och
 * valutan på raden står kvar som på underlaget.
 *
 * Kursen, i den här ordningen:
 *  1. Beloppet i kronor på underlaget (uppgifter.belopp_sek) — det kunden
 *     faktiskt betalade, med bankens eller PayPals påslag.
 *  2. En kurs på underlaget (uppgifter.valutakurs), om den ligger nära
 *     Riksbankens. Underlag skriver kursen åt båda hållen (11,6 kr per euro
 *     eller 0,086 euro per krona), så båda prövas mot Riksbankens.
 *  3. Riksbankens kurs för transaktionens datum, eller närmast föregående
 *     bankdag.
 * Finns ingen av dem räknas inget om, och konteringen flaggar raden.
 *
 * Omräkningen gäller det belopp, den valuta och det datum den räknades för.
 * Ändras något av dem räknas den om vid nästa kontering.
 */

export interface Kronor {
  belopp: number;
  moms: number | null;
  /** Kronor per en enhet av valutan. */
  kurs: number;
  kursdag: string | null;
  kalla: 'underlaget' | 'riksbanken';
  for: { belopp: number; valuta: string; datum: string | null };
}

interface Rad {
  id: string;
  datum: string | null;
  belopp: number;
  moms: number | null;
  valuta: string | null;
  uppgifter: Record<string, unknown> | null;
  kronor: Kronor | null;
}

/** En kurs på underlaget får avvika så här mycket från Riksbankens. */
const MAX_AVVIKELSE = 0.15;

const ore = (n: number) => Math.round(n * 100) / 100;

export const arUtlandsk = (t: { valuta: string | null }) => !!t.valuta && t.valuta.toUpperCase() !== 'SEK';

/** Omräkningen, om den gäller transaktionen som den ser ut nu. */
function giltig(t: Rad): Kronor | null {
  const k = t.kronor;
  if (!k?.for) return null;
  return k.for.valuta === t.valuta && Number(k.for.belopp) === Number(t.belopp) && k.for.datum === t.datum ? k : null;
}

/**
 * Transaktionen i kronor: belopp och moms omräknade och valutan SEK. Utan
 * giltig omräkning kommer den tillbaka som den är, fortfarande i sin valuta.
 */
export function iKronor<T extends Rad>(t: T): T {
  if (!arUtlandsk(t)) return t;
  const k = giltig(t);
  return k ? { ...t, belopp: k.belopp, moms: k.moms, valuta: 'SEK' } : t;
}

/** "30 EUR omräknat med Riksbankens kurs 11,123 den 2026-10-20" */
export function omrakningText(k: Kronor): string {
  const kurs = k.kurs.toLocaleString('sv-SE', { maximumFractionDigits: 5 });
  return `${k.for.belopp} ${k.for.valuta} omräknat med ${k.kalla === 'riksbanken'
    ? `Riksbankens kurs ${kurs} den ${k.kursdag}`
    : `kursen på underlaget (${kurs} kr per ${k.for.valuta})`}`;
}

async function rakna(supabase: SupabaseClient, t: Rad): Promise<Kronor | null> {
  const belopp = Number(t.belopp);
  if (!(belopp > 0) || !t.valuta) return null;
  const valuta = t.valuta.toUpperCase();
  const moms = t.moms === null || t.moms === undefined ? null : Number(t.moms);
  const forr = { belopp, valuta: t.valuta, datum: t.datum };
  const med = (kurs: number, kalla: Kronor['kalla'], kursdag: string | null): Kronor =>
    ({ belopp: ore(belopp * kurs), moms: moms === null ? null : ore(moms * kurs), kurs, kursdag, kalla, for: forr });

  const u = t.uppgifter ?? {};
  const sek = Number(u.belopp_sek);
  if (sek > 0) {
    return { ...med(sek / belopp, 'underlaget', t.datum), belopp: ore(sek) };
  }

  if (!t.datum) return null;
  const rb = await valutakurs(supabase, valuta, t.datum);
  if (!rb) return null;

  const angiven = Number(u.valutakurs);
  if (angiven > 0) {
    const kurs = [angiven, 1 / angiven].find((k) => Math.abs(k / rb.sek - 1) <= MAX_AVVIKELSE);
    if (kurs) return med(kurs, 'underlaget', t.datum);
  }
  return med(rb.sek, 'riksbanken', rb.datum);
}

/**
 * Ser till att en transaktion i utländsk valuta har en giltig omräkning, och
 * sparar den (utom vid torrkörning). Svarar med transaktionen, med
 * omräkningen ifylld när den gick att göra.
 */
export async function raknaOmTillKronor<T extends Rad>(supabase: SupabaseClient, t: T, { spara = true } = {}): Promise<T> {
  if (!arUtlandsk(t) || giltig(t)) return t;
  const kronor = await rakna(supabase, t);
  if (!kronor) return t;
  if (spara) {
    const { error } = await supabase.from('transaktioner').update({ kronor }).eq('id', t.id);
    if (error) throw new Error(`Kunde inte spara omräkningen till kronor: ${error.message}`);
  }
  return { ...t, kronor };
}
