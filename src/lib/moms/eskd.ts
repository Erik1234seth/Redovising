/**
 * Momsdeklarationen som fil — eSKD, det format Skatteverkets e-tjänst
 * "Lämna momsdeklaration" tar emot vid uppladdning.
 *
 * Rutorna räknas fram ur verifikationerna, konto för konto enligt BAS. Det är
 * samma uppdelning som bokföringsprogrammen gör: momskontona ger momsen,
 * intäkts- och inköpskontona ger underlagen.
 *
 * Formatet (eSKDUpload 6.0):
 * - ISO-8859-1, ingen DOCTYPE (DTD-adressen finns inte längre), inga indrag.
 * - Elementen i DTD:ns ordning, som inte är rutnumrens.
 * - Hela kronor, minus direkt före talet. Tomma rutor utelämnas, utom ruta 49
 *   som alltid ska finnas.
 * - Ruta 49 räknas ur de redan avrundade rutorna. Räknas den ur örena kan den
 *   bli en krona fel mot rutorna, och då stoppar Skatteverket deklarationen.
 *   Pengar tillbaka är en negativ ruta 49 — något eget element finns inte.
 */

export type Ruta =
  | '05' | '06' | '07' | '08'
  | '10' | '11' | '12'
  | '20' | '21' | '22' | '23' | '24'
  | '30' | '31' | '32'
  | '35' | '36' | '37' | '38' | '39' | '40' | '41' | '42'
  | '48' | '49' | '50'
  | '60' | '61' | '62';

/** Elementnamnen i den ordning DTD:n kräver. */
const ELEMENT: [Ruta, string][] = [
  ['05', 'ForsMomsEjAnnan'],
  ['06', 'UttagMoms'],
  ['07', 'UlagMargbesk'],
  ['08', 'HyrinkomstFriv'],
  ['20', 'InkopVaruAnnatEg'],
  ['21', 'InkopTjanstAnnatEg'],
  ['22', 'InkopTjanstUtomEg'],
  ['23', 'InkopVaruSverige'],
  ['24', 'InkopTjanstSverige'],
  ['50', 'MomsUlagImport'],
  ['35', 'ForsVaruAnnatEg'],
  ['36', 'ForsVaruUtomEg'],
  ['37', 'InkopVaruMellan3p'],
  ['38', 'ForsVaruMellan3p'],
  ['39', 'ForsTjSkskAnnatEg'],
  ['40', 'ForsTjOvrUtomEg'],
  ['41', 'ForsKopareSkskSverige'],
  ['42', 'ForsOvrigt'],
  ['10', 'MomsUtgHog'],
  ['11', 'MomsUtgMedel'],
  ['12', 'MomsUtgLag'],
  ['30', 'MomsInkopUtgHog'],
  ['31', 'MomsInkopUtgMedel'],
  ['32', 'MomsInkopUtgLag'],
  ['60', 'MomsImportUtgHog'],
  ['61', 'MomsImportUtgMedel'],
  ['62', 'MomsImportUtgLag'],
  ['48', 'MomsIngAvdr'],
  ['49', 'MomsBetala'],
];

export const RUTNAMN: Record<Ruta, string> = {
  '05': 'Momspliktig försäljning',
  '06': 'Momspliktiga uttag',
  '07': 'Beskattningsunderlag vid vinstmarginalbeskattning',
  '08': 'Hyresinkomster vid frivillig skattskyldighet',
  '10': 'Utgående moms 25 %',
  '11': 'Utgående moms 12 %',
  '12': 'Utgående moms 6 %',
  '20': 'Inköp av varor från annat EU-land',
  '21': 'Inköp av tjänster från annat EU-land',
  '22': 'Inköp av tjänster från land utanför EU',
  '23': 'Inköp av varor i Sverige, omvänd skattskyldighet',
  '24': 'Övriga inköp av tjänster, omvänd skattskyldighet',
  '30': 'Utgående moms 25 % på inköp',
  '31': 'Utgående moms 12 % på inköp',
  '32': 'Utgående moms 6 % på inköp',
  '35': 'Försäljning av varor till annat EU-land',
  '36': 'Försäljning av varor utanför EU',
  '37': 'Mellanmans inköp vid trepartshandel',
  '38': 'Mellanmans försäljning vid trepartshandel',
  '39': 'Försäljning av tjänster till näringsidkare i annat EU-land',
  '40': 'Övrig försäljning av tjänster utomlands',
  '41': 'Försäljning när köparen är skattskyldig i Sverige',
  '42': 'Övrig försäljning m.m.',
  '48': 'Ingående moms att dra av',
  '49': 'Moms att betala eller få tillbaka',
  '50': 'Beskattningsunderlag vid import',
  '60': 'Utgående moms 25 % vid import',
  '61': 'Utgående moms 12 % vid import',
  '62': 'Utgående moms 6 % vid import',
};

/** Rutorna med moms som läggs ihop till ruta 49, minus ruta 48. */
const UTGAENDE: Ruta[] = ['10', '11', '12', '30', '31', '32', '60', '61', '62'];

/**
 * Vilken ruta ett BAS-konto hamnar i, och med vilket tecken. Kredit är
 * negativt i verifikationerna, så intäkter och utgående moms vänds (-1).
 * Konton som inte syns i deklarationen ger null.
 */
export function rutaForKonto(konto: string): { ruta: Ruta; tecken: 1 | -1 } | null {
  const k = Number(konto);
  if (!/^\d{4}$/.test(konto)) return null;

  // Utgående moms. x4 är omvänd skattskyldighet på inköp, x5 import.
  if (k >= 2610 && k <= 2639) {
    const sats = Math.floor((k - 2600) / 10); // 1 = 25 %, 2 = 12 %, 3 = 6 %
    const sista = k % 10;
    const ruta = sista === 4 ? ['30', '31', '32'][sats - 1]
      : sista === 5 ? ['60', '61', '62'][sats - 1]
      : ['10', '11', '12'][sats - 1];
    return { ruta: ruta as Ruta, tecken: -1 };
  }
  // Ingående moms, även den beräknade på inköp från utlandet
  if (k >= 2640 && k <= 2649) return { ruta: '48', tecken: 1 };

  // Inköp med omvänd skattskyldighet — underlagen till ruta 30–32 och 60–62
  if (k >= 4515 && k <= 4517) return { ruta: '20', tecken: 1 };
  if (k >= 4535 && k <= 4537) return { ruta: '21', tecken: 1 };
  if (k >= 4531 && k <= 4533) return { ruta: '22', tecken: 1 };
  if (k >= 4415 && k <= 4417) return { ruta: '23', tecken: 1 };
  if (k >= 4425 && k <= 4427) return { ruta: '24', tecken: 1 };
  if (k >= 4545 && k <= 4547) return { ruta: '50', tecken: 1 };

  // Försäljning utan svensk moms
  if (k === 3105) return { ruta: '36', tecken: -1 };
  if (k === 3108) return { ruta: '35', tecken: -1 };
  if (k === 3305) return { ruta: '40', tecken: -1 };
  if (k === 3308) return { ruta: '39', tecken: -1 };
  if (k === 3231) return { ruta: '41', tecken: -1 };

  // Egna uttag
  if (k >= 3401 && k <= 3403) return { ruta: '06', tecken: -1 };
  if (k === 3404) return null;

  // Öres- och kronutjämning är ingen försäljning
  if (k === 3740) return null;

  // Övrig försäljning: konton som slutar på 4 är momsfria i BAS (3004, 3044 …)
  if (k >= 3000 && k <= 3799) {
    return { ruta: k % 10 === 4 && k < 3700 ? '42' : '05', tecken: -1 };
  }
  return null;
}

/**
 * Konton som inte kommer med i någon ruta men kan ha med momsen att göra:
 * momskonton utanför mappningen, intäkter som 38xx–39xx och 3740, och inköp
 * på 44xx–45xx som kan vara omvänd skattskyldighet. Övriga konton (bank,
 * kostnader, skulder) syns aldrig i deklarationen och tas inte med här.
 */
export function ignoreradeKonton(rader: { konto: string; kontonamn?: string; belopp: number }[]) {
  const ut = new Map<string, { konto: string; kontonamn: string; belopp: number }>();
  for (const r of rader) {
    if (rutaForKonto(r.konto)) continue;
    const k = Number(r.konto);
    const relevant = !/^\d{4}$/.test(r.konto)
      || (k >= 2600 && k <= 2699 && k !== 2650)
      || (k >= 3000 && k <= 3999)
      || (k >= 4400 && k <= 4599);
    if (!relevant) continue;
    const rad = ut.get(r.konto) ?? { konto: r.konto, kontonamn: r.kontonamn ?? '', belopp: 0 };
    rad.belopp += r.belopp;
    ut.set(r.konto, rad);
  }
  return [...ut.values()].filter((r) => Math.abs(r.belopp) >= 0.005).sort((a, b) => a.konto.localeCompare(b.konto));
}

/**
 * Momsavräkningen — momskontona nollas mot 2650 i slutet av perioden. Den är
 * ingen affärshändelse, och räknas den med blir rutorna noll.
 */
export const arMomsavrakning = (rader: { konto: string }[]) => rader.some((r) => r.konto === '2650');

export type Rutor = Partial<Record<Ruta, number>>;

/**
 * Summerar raderna per ruta och avrundar till hela kronor. Ruta 49 räknas ur
 * de avrundade rutorna. Tomma rutor tas inte med.
 */
export function raknaRutor(rader: { konto: string; belopp: number }[]): Rutor {
  const summa = new Map<Ruta, number>();
  for (const r of rader) {
    const m = rutaForKonto(r.konto);
    if (!m) continue;
    summa.set(m.ruta, (summa.get(m.ruta) ?? 0) + r.belopp * m.tecken);
  }

  const rutor: Rutor = {};
  for (const [ruta, belopp] of summa) {
    // Avrundning till närmaste krona, halva kronor bort från noll
    const kr = Math.sign(belopp) * Math.round(Math.abs(belopp) + 1e-9);
    if (kr !== 0) rutor[ruta] = kr;
  }
  rutor['49'] = UTGAENDE.reduce((s, r) => s + (rutor[r] ?? 0), 0) - (rutor['48'] ?? 0);
  return rutor;
}

/** Organisationsnumret som xxxxxx-xxxx. Personnummer med sekel kortas. */
export function eskdOrgNr(orgNr: string | null | undefined): string | null {
  const siffror = (orgNr ?? '').replace(/\D/g, '');
  if (siffror.length !== 10 && siffror.length !== 12) return null;
  const tio = siffror.slice(-10);
  return `${tio.slice(0, 6)}-${tio.slice(6)}`;
}

/** Perioden som ÅÅÅÅMM — sista månaden i perioden. */
export function eskdPeriod(tom: string): string {
  return tom.slice(0, 4) + tom.slice(5, 7);
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function byggEskd(opts: { orgNr: string; tom: string; rutor: Rutor; upplysning?: string }): string {
  const rader = [
    '<?xml version="1.0" encoding="ISO-8859-1"?>',
    '<eSKDUpload Version="6.0">',
    `<OrgNr>${opts.orgNr}</OrgNr>`,
    '<Moms>',
    `<Period>${eskdPeriod(opts.tom)}</Period>`,
  ];
  for (const [ruta, element] of ELEMENT) {
    const belopp = opts.rutor[ruta];
    if (ruta === '49' || (belopp !== undefined && belopp !== 0)) {
      rader.push(`<${element}>${belopp ?? 0}</${element}>`);
    }
  }
  const text = opts.upplysning?.trim();
  if (text) rader.push(`<TextUpplysningMoms>${escape(text.slice(0, 300))}</TextUpplysningMoms>`);
  rader.push('</Moms>', '</eSKDUpload>');
  return rader.join('\n');
}

/**
 * Filen ska vara ISO-8859-1. Tecken utanför (t.ex. em-streck) blir frågetecken
 * hellre än att filen avvisas.
 */
export function latin1(text: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(text.length));
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[i] = c < 256 ? c : 63;
  }
  return out;
}

export type Periodtyp = 'månad' | 'kvartal' | 'år';

/** Första och sista dagen i perioden. `nr` är månad 1–12, kvartal 1–4 eller ignoreras för år. */
export function periodDatum(ar: number, typ: Periodtyp, nr: number): { fran: string; tom: string } {
  const [forsta, sista] = typ === 'år' ? [1, 12] : typ === 'kvartal' ? [nr * 3 - 2, nr * 3] : [nr, nr];
  const dagar = new Date(Date.UTC(ar, sista, 0)).getUTCDate();
  const mm = (m: number) => String(m).padStart(2, '0');
  return { fran: `${ar}-${mm(forsta)}-01`, tom: `${ar}-${mm(sista)}-${mm(dagar)}` };
}
