/**
 * En transaktion kan delas upp — livsmedel på 6 % och förpackningar på 25 % i
 * samma köp, eller livsmedel på 4000 och diskmedel på 5400. Konteringen anger
 * då en del per konto och sats. Null eller en tom lista betyder att hela
 * beloppet ligger på kontot och satsen i `konto` och `momssats`.
 *
 * Används både på servern och i admin, så inga serverberoenden här.
 */

export interface Momsdel {
  /** Kontot delen bokförs på. Saknas i delar från före uppdelningen — då gäller konteringens konto. */
  konto?: string;
  momssats: number;
  /** Beloppet för delen, inklusive moms. Negativt för returer och pant. */
  belopp: number;
  /** Momsen enligt underlaget, eller null när den inte står där. */
  moms: number | null;
}

const SATSER = [0, 6, 12, 25];

/** Delarna slagna ihop per konto och sats, största beloppet först. Okända satser och tomma delar tas bort. */
export function slaIhopDelar(delar: unknown): Momsdel[] {
  if (!Array.isArray(delar)) return [];
  const per = new Map<string, Momsdel>();
  for (const d of delar as Partial<Momsdel>[]) {
    const sats = Number(d?.momssats);
    const belopp = Number(d?.belopp);
    // En del kan vara negativ — pant för returlådor på 0 % drar av från köpet
    if (!SATSER.includes(sats) || !Number.isFinite(belopp) || belopp === 0) continue;
    const konto = typeof d?.konto === 'string' && d.konto.trim() ? d.konto.trim() : undefined;
    const moms = d?.moms === null || d?.moms === undefined || !Number.isFinite(Number(d.moms)) ? null : Number(d.moms);
    const nyckel = `${konto ?? ''}:${sats}`;
    const fore = per.get(nyckel);
    per.set(nyckel, fore
      ? { ...fore, belopp: fore.belopp + belopp, moms: fore.moms === null || moms === null ? null : fore.moms + moms }
      : { ...(konto ? { konto } : {}), momssats: sats, belopp, moms });
  }
  return [...per.values()].sort((a, b) => Math.abs(b.belopp) - Math.abs(a.belopp));
}

/**
 * Delarna som går att bokföra. Blir det bara en del kvar är det ingen
 * uppdelning, och då gäller konto och momssats som vanligt.
 */
export function rensaMomsdelar(delar: unknown): Momsdel[] | null {
  const ihop = slaIhopDelar(delar);
  return ihop.length < 2 ? null : ihop;
}

/** Fler än ett konto bland delarna. */
function flerKonton(delar: Momsdel[]): boolean {
  return new Set(delar.map((d) => d.konto ?? '')).size > 1;
}

/** "6 %", "25 % + 6 %" eller, när delarna har olika konton, "4000 6 % + 5400 25 %". */
export function momsText(momssats: number | null, delar: Momsdel[] | null | undefined): string {
  if (!delar?.length) return `${momssats ?? 0} %`;
  const konton = flerKonton(delar);
  return delar.map((d) => `${konton && d.konto ? `${d.konto} ` : ''}${d.momssats} %`).join(' + ');
}

/** Samma uppdelning i två konteringar: samma konton och satser och, vid uppdelning, samma belopp per del. */
export function sammaMoms(
  a: { momssats: number | null; momsdelar?: Momsdel[] | null },
  b: { momssats: number | null; momsdelar?: Momsdel[] | null },
): boolean {
  const nyckel = (k: typeof a) => k.momsdelar?.length
    ? k.momsdelar.map((d) => `${d.konto ?? ''}:${d.momssats}:${Math.round(d.belopp)}`).sort().join('|')
    : String(Number(k.momssats ?? 0));
  return nyckel(a) === nyckel(b);
}
