import k1 from './k1.json';

/**
 * K1-regelverket som konteringen prövar mot.
 *
 * Kontona är byråns kontoplan (löpande eller bokslut, ./k1-andringar), med hela
 * texten för varje konto i databasen. k1.json, byggd med `npm run k1`, är bara
 * utgångsläget: det som gäller innan laddaK1Andringar har körts, och det som
 * "Återställ" går tillbaka till. Det som kan avgöras med en uppslagning eller en jämförelse görs här i kod
 * och lämnas aldrig till modellen — den kan inte minnas årets prisbasbelopp
 * och ska inte räkna på beloppsgränser.
 *
 * Bara kontona i kontoplanen får användas: K1-planen plus BAS-konton för försäljning
 * och inköp utan svensk moms (3105, 3108, 3231, 3305, 3308, 4515 …). Ett konto som inte finns i listan
 * stoppas, även om det är ett giltigt BAS-konto.
 */

export interface K1Konto {
  konto: string;
  namn: string;
  beskrivning: string;
  anvandNar: string[];
  anvandInteNar: string[];
  beslutsregler: string[];
  exempel: string[];
  varningar: string[];
  nyckelord: string[];
  granskningNar: string[];
  trosklar: string[];
  /** "Konto X får aldrig väljas automatiskt" står i beskrivningen. */
  endastManuellt: boolean;
  // Följer bara med till nedladdningen (k1Fil) — konteringen läser dem inte
  motkonton?: string[];
  relateradeKonton?: string[];
  version?: string;
  utkastOrsak?: string;
}

export interface Parameter {
  id: string;
  namn: string;
  varde: number | string;
  enhet: string;
  basParameter: string | null;
  multiplikator: number | null;
  gallerFran: string | null;
  gallerTill: string | null;
  typ?: string;
  senastKontrollerad?: string | null;
  version?: string;
}

export interface Regel {
  id: string;
  namn: string;
  parameterId: string;
  operator: string;
  omfattning: string;
  moms: string;
  gallerFran: string | null;
  gallerTill: string | null;
  konton: string[];
  anteckning: string;
  version?: string;
}

export type Allvar = 'stopp' | 'granskning';

export interface Flagga {
  typ: string;
  allvar: Allvar;
  text: string;
}

export interface Gransprovning {
  regel: string;
  namn: string;
  operator: string;
  belopp: number;
  varde: number;
  enhet: string;
  uppfylld: boolean;
}

export interface Provning {
  konto: string;
  rad: K1Konto | null;
  flaggor: Flagga[];
  gransprovningar: Gransprovning[];
}

export const KALLA: string = k1.kalla;
const ORIGINAL = new Map((k1.konton as K1Konto[]).map((k) => [k.konto, k]));
/** Kontona som de gäller: byråns kontoplan (se ./k1-andringar), k1.json tills den är laddad. */
let KONTON = new Map(ORIGINAL);

/**
 * Texten byrån kan ändra för ett konto. Kontoplanen sparar hela texten; ett
 * fält som saknas här har utgångslägets (k1.json) text.
 */
export type K1Andring = Partial<Pick<K1Konto, 'namn' | 'beskrivning' | 'anvandNar' | 'anvandInteNar' | 'beslutsregler' | 'varningar' | 'exempel' | 'granskningNar' | 'nyckelord'>>;

/** Samma spärr som i scripts/k1-till-json.mjs: meningen om kontot självt. */
function arEndastManuellt(k: K1Konto): boolean {
  return new RegExp(`Konto ${k.konto} får aldrig väljas automatiskt`, 'i').test([k.beskrivning, ...k.beslutsregler, ...k.varningar].join(' '));
}

const TOMT: Omit<K1Konto, 'konto'> = {
  namn: '', beskrivning: '', anvandNar: [], anvandInteNar: [], beslutsregler: [], exempel: [],
  varningar: [], nyckelord: [], granskningNar: [], trosklar: [], endastManuellt: false,
};

/** Kontot med byråns ändring ovanpå. Utan original är det ett konto byrån lagt till. */
export function medAndring(nr: string, a: K1Andring | undefined): K1Konto {
  const k = ORIGINAL.get(nr) ?? { konto: nr, ...TOMT };
  if (!a) return k;
  const ny: K1Konto = { ...k, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== null)) };
  return { ...ny, endastManuellt: arEndastManuellt(ny) };
}

/** Kontonumren i k1.json. */
export function originalNummer(): string[] {
  return [...ORIGINAL.keys()];
}

/** Fälten byrån kan ändra, i den ordning de sparas. */
export const TEXTFALT = ['namn', 'beskrivning', 'anvandNar', 'anvandInteNar', 'beslutsregler', 'varningar', 'exempel', 'granskningNar', 'nyckelord'] as const;

/** Kontots hela text, med ändringen ovanpå det som gällde. Det är det som sparas. */
export function helText(nr: string, a?: K1Andring): Required<K1Andring> {
  const k = medAndring(nr, a);
  return Object.fromEntries(TEXTFALT.map((f) => [f, k[f]])) as Required<K1Andring>;
}

/** De fält där kontot skiljer sig från utgångsläget (k1.json) — det som visas som ändrat. */
export function skillnadMotOriginal(nr: string, a?: K1Andring): K1Andring {
  const o = ORIGINAL.get(nr);
  const k = helText(nr, a);
  return Object.fromEntries(TEXTFALT.filter((f) => !o || JSON.stringify(k[f]) !== JSON.stringify(o[f])).map((f) => [f, k[f]])) as K1Andring;
}

/**
 * Kontoplanens konton: raderna byrån har, utan borttagna. En kontoplan utan
 * några rader alls har inte kopierats än och visar utgångsläget.
 */
function kontoNummer(andringar: Map<string, K1Andring>, borttagna: Set<string>): string[] {
  return [...(andringar.size ? andringar.keys() : ORIGINAL.keys())].filter((nr) => !borttagna.has(nr)).sort();
}

/** Låter konteringen använda kontoplanen. Konton i `borttagna` kan inte väljas. */
export function anvandAndringar(andringar: Map<string, K1Andring>, borttagna: Set<string> = new Set()): void {
  KONTON = new Map(kontoNummer(andringar, borttagna).map((nr) => [nr, medAndring(nr, andringar.get(nr))]));
}

/**
 * Hela kontoplanen som den gäller, utan borttagna konton — det som laddas ner
 * (k1-lopande.json, k1-bokslut.json). Gränsvärdena är kontoplanens regelmaster.
 */
export function k1Fil(andringar: Map<string, K1Andring>, borttagna: Set<string> = new Set(), rm: Regelmaster = K1_REGELMASTER) {
  const nummer = kontoNummer(andringar, borttagna);
  return {
    kalla: KALLA,
    konton: nummer.map((nr) => medAndring(nr, andringar.get(nr))),
    parametrar: rm.parametrar,
    regler: rm.regler,
  };
}

/** Kontot som det står i k1.json, utan byråns ändringar. */
export function originalKonto(konto: string): K1Konto | null {
  return ORIGINAL.get(String(konto ?? '').trim()) ?? null;
}
/**
 * Regelmasterns gränsvärden (parametrar) och regler. k1.json är utgångsläget;
 * byrån importerar nya per kontoplan (./regelmaster), och konteringen använder
 * den löpande — laddaK1Andringar lägger in den med anvandRegelmaster.
 */
export interface Regelmaster { kalla: string; parametrar: Parameter[]; regler: Regel[] }
export const K1_REGELMASTER: Regelmaster = { kalla: KALLA, parametrar: k1.parametrar as Parameter[], regler: k1.regler as Regel[] };

const karta = (rm: Regelmaster) => new Map(rm.parametrar.map((p) => [p.id, p]));
let PARAMETRAR = karta(K1_REGELMASTER);
let REGLER = K1_REGELMASTER.regler;
let REGELMASTER = K1_REGELMASTER;

export function anvandRegelmaster(rm: Regelmaster): void {
  REGELMASTER = rm;
  PARAMETRAR = karta(rm);
  REGLER = rm.regler;
}

export function slaUppKonto(konto: string): K1Konto | null {
  return KONTON.get(String(konto ?? '').trim()) ?? null;
}

export function allaKonton(): K1Konto[] {
  return [...KONTON.values()];
}

/** Löser upp en parameter till ett tal, även när den är härledd ur en annan. */
function losVarde(id: string, djup = 0, parametrar = PARAMETRAR): { varde: number; parameter: Parameter } | null {
  const p = parametrar.get(id);
  if (!p || djup > 5) return null;
  if (typeof p.varde === 'number') return { varde: p.varde, parameter: p };
  const bas = p.basParameter ?? (parametrar.has(p.varde) ? p.varde : null);
  if (!bas) return null;
  const under = losVarde(bas, djup + 1, parametrar);
  if (!under) return null;
  return { varde: under.varde * (p.multiplikator ?? 1), parameter: p };
}

function galler(regel: Regel, datum: string | null) {
  if (!datum) return true;
  if (regel.gallerFran && datum < regel.gallerFran) return false;
  if (regel.gallerTill && datum > regel.gallerTill) return false;
  return true;
}

/**
 * Beloppsregler som går att pröva mot en enda transaktion. Gränser per person,
 * per anställd eller i procent kräver uppgifter vi inte har på raden — de
 * lämnas åt granskningen, som har texten.
 */
const PROVBAR_ENHET = /^SEK( inkl\. moms| exkl\. moms)?$/;

/**
 * Regler som gäller en del av underlaget, inte kontots belopp. "Mindre
 * avvikande kostnadsrad" säger att en liten rad som hör till ett annat konto
 * får följa med på huvudkontot om den är högst 1 000 kr — prövad mot hela
 * kontots belopp blev varje grossistkvitto över 1 000 kr gult. Konteringen
 * delar upp kvittot per konto i stället för att slå ihop, så reglerna prövas
 * inte i kod. De står kvar i kontots regeltext.
 */
const INTE_PER_KONTO = new Set(['minor_line_merge_amount_limit', 'minor_line_merge_share_limit', 'minor_line_recurring_annual_limit']);

/** En regel ur gränsvärdestabellen med sitt värde uträknat, till fliken Regler i Kontoplan. */
export interface RegelmasterRad extends Regel {
  parameter: { namn: string; varde: number | string; enhet: string; senastKontrollerad: string | null } | null;
  /** Beloppet prövas mot gränsen i provaKonto. Övriga står bara i kontots text. */
  provasIKod: boolean;
}

/** Regelmasterns regler med uträknade värden — det provaKonto bygger på. Utan argument den konteringen använder. */
export function regelmaster(rm: Regelmaster = REGELMASTER): RegelmasterRad[] {
  // provaKonto prövar bara regler som ett konto pekar på
  const iTrosklar = new Set([...KONTON.values()].flatMap((k) => k.trosklar));
  const parametrar = karta(rm);
  return rm.regler.map((regel) => {
    const p = parametrar.get(regel.parameterId);
    const lost = losVarde(regel.parameterId, 0, parametrar);
    return {
      ...regel,
      parameter: p ? {
        namn: p.namn,
        varde: lost?.varde ?? p.varde,
        enhet: p.enhet,
        senastKontrollerad: p.senastKontrollerad ?? null,
      } : null,
      provasIKod: !INTE_PER_KONTO.has(regel.id)
        && (regel.konton.length > 0 || iTrosklar.has(regel.id))
        && ['<', '<=', '>', '>='].includes(regel.operator)
        && !!lost && PROVBAR_ENHET.test(lost.parameter.enhet),
    };
  });
}

/**
 * Prövar ett föreslaget konto mot regelverket.
 *
 * `netto` är beloppet utan moms, `brutto` med. Gränsvärdena anges oftast
 * exklusive avdragsgill moms, så netto används om inte enheten säger inkl. moms.
 *
 * Bara under-gränser (< och <=) som inte är uppfyllda ger granskning direkt:
 * de säger att kontot förutsätter ett lågt belopp, som 5400 under ett halvt
 * prisbasbelopp. Över-gränserna (5 000-kronorsreglerna) handlar om
 * situationer — kundförskott, periodisering — som inte syns på beloppet
 * ensamt. De skickas med som fakta till granskningen, som har texten.
 */
export function provaKonto({ konto, netto, brutto, datum }: {
  konto: string;
  netto: number;
  brutto: number;
  datum: string | null;
}): Provning {
  const nummer = String(konto ?? '').trim();
  const rad = KONTON.get(nummer) ?? null;

  if (!rad) {
    return {
      konto: nummer,
      rad: null,
      flaggor: [{
        typ: 'utanfor-k1',
        allvar: 'stopp',
        text: `${nummer || '(tomt)'} finns inte bland K1-kontona och får inte användas.`,
      }],
      gransprovningar: [],
    };
  }

  const flaggor: Flagga[] = [];
  if (rad.endastManuellt) {
    flaggor.push({
      typ: 'endast-manuellt',
      allvar: 'stopp',
      text: `${nummer} ${rad.namn} får aldrig väljas automatiskt.`,
    });
  }

  const gransprovningar: Gransprovning[] = [];
  const trosklar = new Set(rad.trosklar);
  for (const regel of REGLER) {
    if (!regel.konton.includes(nummer) && !trosklar.has(regel.id)) continue;
    if (INTE_PER_KONTO.has(regel.id)) continue;
    if (!['<', '<=', '>', '>='].includes(regel.operator) || !galler(regel, datum)) continue;
    const lost = losVarde(regel.parameterId);
    if (!lost || !PROVBAR_ENHET.test(lost.parameter.enhet)) continue;

    const belopp = Math.abs(/inkl\. moms/.test(lost.parameter.enhet) ? brutto : netto);
    const uppfylld =
      regel.operator === '<' ? belopp < lost.varde
      : regel.operator === '<=' ? belopp <= lost.varde
      : regel.operator === '>' ? belopp > lost.varde
      : belopp >= lost.varde;

    gransprovningar.push({
      regel: regel.id,
      namn: regel.namn,
      operator: regel.operator,
      belopp,
      varde: lost.varde,
      enhet: lost.parameter.enhet,
      uppfylld,
    });

    if ((regel.operator === '<' || regel.operator === '<=') && !uppfylld) {
      flaggor.push({
        typ: 'gransvarde',
        allvar: 'granskning',
        text: `${regel.namn}: ${belopp.toLocaleString('sv-SE')} kr är inte ${regel.operator} ${lost.varde.toLocaleString('sv-SE')} kr.`,
      });
    }
  }

  return { konto: nummer, rad, flaggor, gransprovningar };
}

/**
 * Den korta kontolistan i konteringens systemprompt: konto, namn, beskrivning
 * och sökord för alla K1-konton. Hela regeltexten slår modellen upp själv.
 */
export function kontolista(): string {
  return allaKonton()
    .map((k) => `${k.konto} ${k.namn} — ${k.beskrivning}${k.nyckelord.length ? ` [${k.nyckelord.join(', ')}]` : ''}`)
    .join('\n');
}

const BAS_URSPRUNG = /^(Posten|Bokningen) kommer från (BAS|ett generellt BAS)|^BAS-kontot är/i;

/**
 * Hela regeltexten för ett konto, till granskningen. Innehåller det som
 * kontot ska prövas mot (beskrivning, använd när, använd inte när,
 * beslutsregler) och det som avgör om en människa ska titta.
 *
 * Motkontona tas inte med: flera av dem ligger utanför K1 och skulle locka
 * modellen åt fel håll.
 */
export function kontoBlock(p: Provning): string {
  const rad = p.rad;
  if (!rad) return `KONTO ${p.konto}: finns inte bland K1-kontona.`;
  const punkt = (rubrik: string, rader: string[]) =>
    rader.length ? `${rubrik}:\n${rader.map((r) => `- ${r}`).join('\n')}` : '';
  // Punkter om vilket BAS-konto en post kom ifrån gäller när en gammal
  // bokföring flyttas över till K1. Här konteras från underlaget, så de
  // stämmer aldrig — men modellen läser dem annars som att allt ska granskas.
  const granskningNar = rad.granskningNar.filter((g) => !BAS_URSPRUNG.test(g));

  return [
    `KONTO ${rad.konto} ${rad.namn}`,
    rad.beskrivning,
    punkt('Använd när', rad.anvandNar),
    punkt('Använd INTE när', rad.anvandInteNar),
    punkt('Beslutsregler', rad.beslutsregler),
    punkt('Varningar', rad.varningar),
    punkt('Exempel', rad.exempel),
    punkt('Kräver manuell granskning när', granskningNar),
    punkt(
      'Gränsprövning (uträknad i kod, godta siffrorna)',
      p.gransprovningar.map((g) =>
        `${g.namn}: ${g.belopp.toLocaleString('sv-SE')} kr ${g.operator} ${g.varde.toLocaleString('sv-SE')} kr → ${g.uppfylld ? 'uppfyllt' : 'EJ uppfyllt'}`),
    ),
  ]
    .filter(Boolean)
    .join('\n\n');
}
