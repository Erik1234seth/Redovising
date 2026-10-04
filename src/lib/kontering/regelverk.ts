import k1 from './k1.json';

/**
 * K1-regelverket som konteringen prövar mot.
 *
 * Läses ur k1.json, som byggs från kontobeskrivningarna med `npm run k1`.
 * Det som kan avgöras med en uppslagning eller en jämförelse görs här i kod
 * och lämnas aldrig till modellen — den kan inte minnas årets prisbasbelopp
 * och ska inte räkna på beloppsgränser.
 *
 * Bara de 162 K1-kontona får användas. Ett konto som inte finns i listan
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
}

interface Parameter {
  id: string;
  namn: string;
  varde: number | string;
  enhet: string;
  basParameter: string | null;
  multiplikator: number | null;
  gallerFran: string | null;
  gallerTill: string | null;
}

interface Regel {
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
const KONTON = new Map((k1.konton as K1Konto[]).map((k) => [k.konto, k]));
const PARAMETRAR = new Map((k1.parametrar as Parameter[]).map((p) => [p.id, p]));
const REGLER = k1.regler as Regel[];

export function slaUppKonto(konto: string): K1Konto | null {
  return KONTON.get(String(konto ?? '').trim()) ?? null;
}

export function allaKonton(): K1Konto[] {
  return [...KONTON.values()];
}

/** Löser upp en parameter till ett tal, även när den är härledd ur en annan. */
function losVarde(id: string, djup = 0): { varde: number; parameter: Parameter } | null {
  const p = PARAMETRAR.get(id);
  if (!p || djup > 5) return null;
  if (typeof p.varde === 'number') return { varde: p.varde, parameter: p };
  const bas = p.basParameter ?? (PARAMETRAR.has(p.varde) ? p.varde : null);
  if (!bas) return null;
  const under = losVarde(bas, djup + 1);
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
 * Den korta kontolistan till första passet: konto, namn, beskrivning och
 * sökord för alla K1-konton. Cirka 48 000 tecken.
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
