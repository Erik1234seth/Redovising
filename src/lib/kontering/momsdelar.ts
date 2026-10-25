/**
 * Ett kvitto kan ha flera momssatser — livsmedel på 6 % och förpackningar på
 * 25 % i samma köp. Konteringen anger då en del per sats. Null eller en tom
 * lista betyder att hela beloppet har en sats (`momssats`).
 *
 * Används både på servern och i admin, så inga serverberoenden här.
 */

export interface Momsdel {
  momssats: number;
  /** Beloppet med den här satsen, inklusive moms. Negativt för returer och pant. */
  belopp: number;
  /** Momsen enligt underlaget, eller null när den inte står där. */
  moms: number | null;
}

const SATSER = [0, 6, 12, 25];

/**
 * Delarna som går att bokföra: en per sats, bara kända satser. Blir det bara
 * en sats kvar är det ingen blandning, och då gäller momssats som vanligt.
 */
export function rensaMomsdelar(delar: unknown): Momsdel[] | null {
  if (!Array.isArray(delar)) return null;
  const perSats = new Map<number, Momsdel>();
  for (const d of delar as Partial<Momsdel>[]) {
    const sats = Number(d?.momssats);
    const belopp = Number(d?.belopp);
    // En del kan vara negativ — pant för returlådor på 0 % drar av från köpet
    if (!SATSER.includes(sats) || !Number.isFinite(belopp) || belopp === 0) continue;
    const moms = d?.moms === null || d?.moms === undefined || !Number.isFinite(Number(d.moms)) ? null : Number(d.moms);
    const fore = perSats.get(sats);
    perSats.set(sats, fore
      ? { momssats: sats, belopp: fore.belopp + belopp, moms: fore.moms === null || moms === null ? null : fore.moms + moms }
      : { momssats: sats, belopp, moms });
  }
  if (perSats.size < 2) return null;
  return [...perSats.values()].sort((a, b) => b.momssats - a.momssats);
}

/** "6 %" eller "25 % + 6 %". */
export function momsText(momssats: number | null, delar: Momsdel[] | null | undefined): string {
  return delar?.length ? delar.map((d) => `${d.momssats} %`).join(' + ') : `${momssats ?? 0} %`;
}

/** Samma moms i två konteringar: samma satser och, vid blandning, samma belopp per sats. */
export function sammaMoms(
  a: { momssats: number | null; momsdelar?: Momsdel[] | null },
  b: { momssats: number | null; momsdelar?: Momsdel[] | null },
): boolean {
  const nyckel = (k: typeof a) => k.momsdelar?.length
    ? k.momsdelar.map((d) => `${d.momssats}:${Math.round(d.belopp)}`).sort().join('|')
    : String(Number(k.momssats ?? 0));
  return nyckel(a) === nyckel(b);
}
