import type { MomsPeriod } from '@/lib/admin-types';
import { periodDatum, type Periodtyp } from '@/lib/moms/eskd';

/**
 * Sista inlämningsdagarna hos Skatteverket, räknade per period.
 *
 * Moms (omsättning upp till 40 miljoner, vilket gäller alla våra kunder):
 * - Månad och kvartal: den 12:e i andra månaden efter perioden, men den 17:e
 *   när den månaden är januari eller augusti.
 * - Helår (kalenderår, ingen EU-handel): 12 maj året efter. Med EU-handel är
 *   det 26 februari — det fångas inte här, eftersom vi inte vet vem som har det.
 *
 * NE-bilagan: 2 maj året efter. Byråanstånd skjuter den till mitten av juni,
 * men det måste sökas och räknas därför inte med.
 *
 * Infaller dagen på en lördag, söndag eller helgdag flyttas den till nästa
 * vardag, precis som Skatteverket gör.
 */

export type DeklTyp = 'moms' | 'ne';

export interface Deadlineperiod {
  typ: DeklTyp;
  /** Nyckeln i `inlamningar.period`: "2026-08", "2026-K3", "2026". */
  period: string;
  /** I klartext: "augusti 2026", "kvartal 3 2026", "helår 2026", "inkomstår 2025". */
  label: string;
  /** Periodens första och sista dag. */
  fran: string;
  tom: string;
  /** Sista dag att lämna in, YYYY-MM-DD. */
  deadline: string;
  /** Det eSKD- och periodvalet behöver. */
  periodtyp: Periodtyp;
  ar: number;
  nr: number;
}

const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (ar: number, manad: number, dag: number) => new Date(Date.UTC(ar, manad - 1, dag));

/** Påskdagen, Gauss/Meeus. */
function pask(ar: number): Date {
  const a = ar % 19, b = Math.floor(ar / 100), c = ar % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const manad = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(ar, manad, dag);
}

function helgdagar(ar: number): Set<string> {
  const p = pask(ar).getTime();
  const dag = 86_400_000;
  // Midsommarafton: fredagen mellan 19 och 25 juni
  const midsommar = [19, 20, 21, 22, 23, 24, 25].map((d) => utc(ar, 6, d)).find((d) => d.getUTCDay() === 5)!;
  return new Set([
    utc(ar, 1, 1), utc(ar, 1, 6), new Date(p - 2 * dag), new Date(p + dag), utc(ar, 5, 1),
    new Date(p + 39 * dag), utc(ar, 6, 6), midsommar, utc(ar, 12, 24), utc(ar, 12, 25), utc(ar, 12, 26), utc(ar, 12, 31),
  ].map(iso));
}

/** Flyttar fram till närmaste vardag som inte är helgdag. */
export function vardag(d: Date | string): string {
  const x = new Date(typeof d === 'string' ? `${d}T00:00:00Z` : d);
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6 || helgdagar(x.getUTCFullYear()).has(iso(x))) {
    x.setUTCDate(x.getUTCDate() + 1);
  }
  return iso(x);
}

/** Den 12:e i andra månaden efter `sistaManad`, eller den 17:e i januari och augusti. */
function momsdag(ar: number, sistaManad: number): string {
  let m = sistaManad + 2, a = ar;
  if (m > 12) { m -= 12; a += 1; }
  return vardag(utc(a, m, m === 1 || m === 8 ? 17 : 12));
}

const TYP: Record<Exclude<MomsPeriod, 'ingen-moms'>, Periodtyp> = {
  'månadsvis': 'månad',
  'kvartalsvis': 'kvartal',
  'helår': 'år',
};

export function momsperiod(typ: Periodtyp, ar: number, nr: number): Deadlineperiod {
  const { fran, tom } = periodDatum(ar, typ, nr);
  if (typ === 'år') {
    return { typ: 'moms', period: String(ar), label: `helår ${ar}`, fran, tom, deadline: vardag(utc(ar + 1, 5, 12)), periodtyp: typ, ar, nr: 1 };
  }
  if (typ === 'kvartal') {
    return { typ: 'moms', period: `${ar}-K${nr}`, label: `kvartal ${nr} ${ar}`, fran, tom, deadline: momsdag(ar, nr * 3), periodtyp: typ, ar, nr };
  }
  return { typ: 'moms', period: `${ar}-${String(nr).padStart(2, '0')}`, label: `${MANADER[nr - 1]} ${ar}`, fran, tom, deadline: momsdag(ar, nr), periodtyp: typ, ar, nr };
}

export function neperiod(ar: number): Deadlineperiod {
  return { typ: 'ne', period: String(ar), label: `inkomstår ${ar}`, fran: `${ar}-01-01`, tom: `${ar}-12-31`, deadline: vardag(utc(ar + 1, 5, 2)), periodtyp: 'år', ar, nr: 1 };
}

/** Perioden före den här, av samma slag. */
function forra(p: Deadlineperiod): Deadlineperiod {
  if (p.typ === 'ne') return neperiod(p.ar - 1);
  if (p.periodtyp === 'år') return momsperiod('år', p.ar - 1, 1);
  const max = p.periodtyp === 'kvartal' ? 4 : 12;
  return p.nr === 1 ? momsperiod(p.periodtyp, p.ar - 1, max) : momsperiod(p.periodtyp, p.ar, p.nr - 1);
}

/** Perioden efter den här, av samma slag. */
function nasta(p: Deadlineperiod): Deadlineperiod {
  if (p.typ === 'ne') return neperiod(p.ar + 1);
  if (p.periodtyp === 'år') return momsperiod('år', p.ar + 1, 1);
  const max = p.periodtyp === 'kvartal' ? 4 : 12;
  return p.nr === max ? momsperiod(p.periodtyp, p.ar + 1, 1) : momsperiod(p.periodtyp, p.ar, p.nr + 1);
}

/** Perioden som pågår idag. */
function pagaende(typ: DeklTyp, momsPeriod: MomsPeriod | null, idag: string): Deadlineperiod | null {
  const ar = Number(idag.slice(0, 4));
  const manad = Number(idag.slice(5, 7));
  if (typ === 'ne') return neperiod(ar);
  if (!momsPeriod || momsPeriod === 'ingen-moms') return null;
  const t = TYP[momsPeriod];
  return momsperiod(t, ar, t === 'år' ? 1 : t === 'kvartal' ? Math.ceil(manad / 3) : manad);
}

/**
 * Inlämningssidan började föra bok den här dagen. Perioder vars deadline gick
 * ut innan dess räknas aldrig som försenade — vi vet inte om de lämnades in
 * på annat sätt, och utan gränsen hade varje kund lyst rött från start.
 */
export const BOKFORING_START = '2026-10-10';

/**
 * Perioderna som är aktuella för kunden idag:
 * - avslutade perioder vars deadline gått ut efter `BOKFORING_START` men som
 *   inte markerats som inlämnade (försenade), och
 * - den avslutade perioden med närmast kommande deadline.
 *
 * `inlamnade` är periodnycklarna som redan finns i `inlamningar`. Den
 * kommande perioden tas med även när den är inlämnad, så att den kan visas
 * som grön fram till deadline.
 */
export function aktuellaPerioder(
  typ: DeklTyp,
  momsPeriod: MomsPeriod | null,
  inlamnade: Set<string>,
  idag = new Date().toISOString().slice(0, 10),
): Deadlineperiod[] {
  const nu = pagaende(typ, momsPeriod, idag);
  if (!nu) return [];

  // Tre perioder bakåt räcker: deadline ligger som mest två och en halv
  // månad efter periodens slut. Därifrån framåt till första som inte gått ut.
  let p = forra(forra(forra(nu)));
  while (p.deadline < idag) p = nasta(p);
  // p kan ha hamnat på den pågående perioden igen om allt gått ut — den är inte avslutad än
  const kommande = p.tom < idag ? p : null;

  const forsenade: Deadlineperiod[] = [];
  for (let q = forra(kommande ?? nu); q.deadline < idag && q.deadline >= BOKFORING_START; q = forra(q)) {
    if (!inlamnade.has(q.period)) forsenade.unshift(q);
  }
  return kommande ? [...forsenade, kommande] : forsenade;
}

/** Alla momsdeadlines för en momsperiodtyp mellan två datum, för kalendern. */
export function deadlinesMellan(typ: DeklTyp, momsPeriod: MomsPeriod | null, fran: string, tom: string): Deadlineperiod[] {
  const start = pagaende(typ, momsPeriod, fran);
  if (!start) return [];
  const ut: Deadlineperiod[] = [];
  let p = forra(forra(start));
  for (let i = 0; i < 60 && p.deadline <= tom; i++, p = nasta(p)) {
    if (p.deadline >= fran) ut.push(p);
  }
  return ut;
}
