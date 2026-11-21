/**
 * Kopplar fakturor till bankraderna som betalade dem. Ren logik utan databas,
 * så att den går att köra och pröva för sig (./kor laddar och sparar).
 *
 * Det som avgör är fakturanummer i bankens text, belopp och motpartens namn.
 * Datumet sållar bara bort det som ligger utanför fönstret, och avgör när två
 * kandidater annars är lika bra: den närmast förfallodagen vinner.
 *
 *   Fakturanumret i texten + beloppet   säker, oavsett datum i fönstret
 *   Fakturanumret + lägre belopp        delbetalning, fakturan väntar på resten
 *   Fakturanumret + högre belopp        överbetalning, flaggas
 *   Beloppet + namnet                   trolig om det är den enda kandidaten
 *   Bara beloppet                       trolig inom förfallodagen ± 30 dagar och
 *                                       med en enda kandidat, annars förslag
 *
 * Ingenting bokförs här. Kopplingen är ett stöd för konteringen i Flöde och
 * visar kunden att fakturan är betald.
 */

// ---------- Gränser (Eriks beslut 2026-11-21) ----------

/** En betalning kan komma så här många dagar före fakturadatumet. */
export const DAGAR_FORE_FAKTURADATUM = 7;
/** ... och senast så här många månader efter förfallodagen. */
export const MANADER_EFTER_FORFALLO = 1;
/** Bara beloppet räcker inom så här många dagar från förfallodagen. */
export const BARA_BELOPP_DAGAR = 30;
/** Öresavrundning och små skillnader i kronor. */
export const ORESAVRUNDNING_KR = 5;
/** Utländsk valuta: avvikelse från Riksbankens kurs. */
export const VALUTA_MARGINAL = 0.05;
/** En trolig bankavgift: så mycket lägre än väntat, det större av de två. */
export const AVGIFT_ANDEL = 0.03;
export const AVGIFT_KR = 200;
/** Högst så många fakturor i en samlad betalning. */
export const SAMLAD_MAX = 5;
/** Skatteverkets ROT/RUT-del kommer inom så här många månader efter fakturadatumet. */
export const SKATTEVERKET_MANADER = 6;

// ---------- Typer ----------

export interface MatchFaktura {
  id: string;
  nr: string;
  motpart: string;
  fakturadatum: string;
  forfallodatum: string;
  /** Det som ska betalas, i fakturans valuta: efter ROT/RUT-avdraget. */
  belopp: number;
  valuta: string;
  /** ROT/RUT-avdraget som Skatteverket betalar, i fakturans valuta. 0 utan avdrag. */
  avdrag: number;
  /** 'in' för kundfakturor, 'ut' för leverantörsfakturor. */
  riktning: 'in' | 'ut';
}

export interface MatchBankrad {
  kontoHash: string;
  id: string;
  datum: string;
  /** Kronor, positivt in och negativt ut. */
  belopp: number;
  /** Bankens text och motpartens namn ihop. */
  text: string;
}

export type Sakerhet = 'saker' | 'trolig' | 'forslag';
export type Grund = 'fakturanummer' | 'namn' | 'belopp';
export type Typ = 'hel' | 'delbetalning' | 'overbetalning' | 'samlad';
export type Del = 'betalning' | 'skatteverket';

export interface Koppling {
  fakturaId: string;
  kontoHash: string;
  bankId: string;
  bankDatum: string;
  bankBelopp: number;
  /** Den del av bankraden som gäller fakturan, i kronor och utan tecken. */
  belopp: number;
  del: Del;
  typ: Typ;
  grund: Grund;
  sakerhet: Sakerhet;
  /** Bankens belopp minus det väntade, i kronor. */
  avvikelse: number;
  kommentar: string | null;
}

/** Byråns beslut, som matchningen tar hänsyn till men aldrig ändrar. */
export interface Beslut {
  fakturaId: string;
  kontoHash: string;
  bankId: string;
  del: Del;
  belopp: number;
  status: 'bekraftad' | 'avvisad';
}

/** Kronor per enhet av valutan på ett datum, eller null om kursen saknas. */
export type Kurs = (valuta: string, datum: string) => number | null;

// ---------- Hjälp ----------

const DAG_MS = 86_400_000;
const dagar = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAG_MS);
const ore = (n: number) => Math.round(n * 100) / 100;

function plusDagar(datum: string, n: number) {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + n * DAG_MS).toISOString().slice(0, 10);
}

function plusManader(datum: string, n: number) {
  const d = new Date(`${datum}T00:00:00Z`);
  const dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const sista = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dag, sista));
  return d.toISOString().slice(0, 10);
}

/** Fönstret en betalning av fakturan kan ligga i. */
export function fonster(f: Pick<MatchFaktura, 'fakturadatum' | 'forfallodatum'>) {
  const sista = f.forfallodatum > f.fakturadatum ? f.forfallodatum : f.fakturadatum;
  return { fran: plusDagar(f.fakturadatum, -DAGAR_FORE_FAKTURADATUM), till: plusManader(sista, MANADER_EFTER_FORFALLO) };
}

/** Text för jämförelse: gemener och utan diakritiska tecken. */
function normal(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * Står fakturanumret i bankens text? Numrets siffror jämförs i ordning, med
 * eller utan mellanslag, punkt eller bindestreck mellan ("2026-003",
 * "2026003", "2026 003"), men aldrig som en del av ett längre nummer.
 * Nummer med färre än tre siffror räknas inte — "3" står i nästan varje text.
 */
export function harFakturanummer(nr: string, text: string): boolean {
  const siffror = nr.replace(/\D/g, '');
  if (siffror.length < 3) return false;
  const re = new RegExp(`(?<!\\d)${siffror.split('').join('[\\s.-]?')}(?![\\s.-]?\\d)`);
  return re.test(normal(text));
}

const STOPPORD = new Set(['ab', 'hb', 'kb', 'aktiebolag', 'handelsbolag', 'enskild', 'firma', 'och', 'i', 'the', 'of', 'ltd', 'inc', 'oy', 'as', 'aps', 'gmbh', 'sverige', 'sweden', 'svenska', 'group', 'ek', 'for']);

function ord(s: string) {
  return normal(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPPORD.has(w) && !/^\d+$/.test(w));
}

/**
 * Liknar motpartens namn bankens text? Har namnet ett ord räcker det ordet
 * (minst fyra tecken). Har det flera krävs två av dem, eller namnets längsta
 * ord — oftast efternamnet eller firmanamnet — så att "Anna" ensamt inte
 * räcker för "Anna Svensson" men "SVENSSON" gör det.
 */
export function harNamn(namn: string, text: string): boolean {
  const namnord = [...new Set(ord(namn))];
  if (!namnord.length) return false;
  const textord = new Set(ord(text));
  const traff = namnord.filter((w) => textord.has(w));
  if (namnord.length === 1) return traff.length === 1 && traff[0].length >= 4;
  const langst = namnord.reduce((a, b) => (b.length > a.length ? b : a));
  return traff.length >= 2 || (traff.includes(langst) && langst.length >= 5);
}

type Passning =
  | { slag: 'exakt' | 'avgift' | 'lagre' | 'hogre'; vantat: number; avvikelse: number; kommentar: string | null }
  | null;

/** Vad fakturans belopp är i kronor, med de kurser som kan gälla. */
function vantatIKronor(belopp: number, valuta: string, datum: string[], kurs: Kurs): { kr: number; kommentar: string | null }[] {
  if (valuta.toUpperCase() === 'SEK') return [{ kr: belopp, kommentar: null }];
  const ut: { kr: number; kommentar: string | null }[] = [];
  for (const d of datum) {
    const k = kurs(valuta, d);
    if (k) ut.push({ kr: ore(belopp * k), kommentar: `${belopp.toLocaleString('sv-SE')} ${valuta.toUpperCase()} med Riksbankens kurs ${k.toLocaleString('sv-SE', { maximumFractionDigits: 4 })} (${d})` });
  }
  return ut;
}

/**
 * Hur bankens belopp passar det väntade. Kronor: ± 5 kr. Utländsk valuta:
 * ± 5 % mot Riksbankens kurs på fakturadagen eller betaldagen, den som ligger
 * närmast. Under det: trolig avgift (upp till 3 % eller 200 kr) eller lägre.
 */
function passning(belopp: number, valuta: string, bankKr: number, datum: string[], kurs: Kurs): Passning {
  const vantade = vantatIKronor(belopp, valuta, datum, kurs);
  if (!vantade.length) return null;
  const v = vantade.reduce((a, b) => (Math.abs(bankKr - b.kr) < Math.abs(bankKr - a.kr) ? b : a));
  const avvikelse = ore(bankKr - v.kr);
  const utlandsk = valuta.toUpperCase() !== 'SEK';
  const marginal = utlandsk ? Math.max(ORESAVRUNDNING_KR, v.kr * VALUTA_MARGINAL) : ORESAVRUNDNING_KR;
  if (Math.abs(avvikelse) <= marginal) return { slag: 'exakt', vantat: v.kr, avvikelse, kommentar: v.kommentar };
  if (avvikelse < 0 && -avvikelse <= marginal + Math.max(v.kr * AVGIFT_ANDEL, AVGIFT_KR)) {
    return { slag: 'avgift', vantat: v.kr, avvikelse, kommentar: [v.kommentar, `${(-avvikelse).toLocaleString('sv-SE')} kr lägre än fakturan, trolig bankavgift`].filter(Boolean).join('. ') };
  }
  return { slag: avvikelse < 0 ? 'lagre' : 'hogre', vantat: v.kr, avvikelse, kommentar: v.kommentar };
}

const RANG: Record<Sakerhet, number> = { saker: 0, trolig: 1, forslag: 2 };
const GRUNDRANG: Record<Grund, number> = { fakturanummer: 0, namn: 1, belopp: 2 };
const nyckel = (fakturaId: string, kontoHash: string, bankId: string, del: Del) => `${fakturaId}|${kontoHash}|${bankId}|${del}`;
const bankNyckel = (b: { kontoHash: string; bankId?: string; id?: string }) => `${b.kontoHash}|${b.bankId ?? b.id}`;

function iRiktning(f: MatchFaktura, b: MatchBankrad) {
  return f.riktning === 'in' ? b.belopp > 0 : b.belopp < 0;
}

/** Alla delmängder med 2..max element, för samlade betalningar. Begränsat till små listor. */
function* kombinationer<T>(lista: T[], max: number, start = 0, valda: T[] = []): Generator<T[]> {
  if (valda.length >= 2) yield valda;
  if (valda.length === max) return;
  for (let i = start; i < lista.length; i++) yield* kombinationer(lista, max, i + 1, [...valda, lista[i]]);
}

// ---------- Matchningen ----------

export function matcha(fakturor: MatchFaktura[], bank: MatchBankrad[], beslut: Beslut[], kurs: Kurs): Koppling[] {
  const avvisade = new Set(beslut.filter((b) => b.status === 'avvisad').map((b) => nyckel(b.fakturaId, b.kontoHash, b.bankId, b.del)));
  const bekraftade = beslut.filter((b) => b.status === 'bekraftad');

  // Det byrån bekräftat är redan förbrukat: bankraden och fakturans belopp
  const upptagenBank = new Set<string>();
  const betalt = new Map<string, number>();
  const betaltSkv = new Map<string, number>();
  for (const b of bekraftade) {
    upptagenBank.add(bankNyckel(b));
    const karta = b.del === 'skatteverket' ? betaltSkv : betalt;
    karta.set(b.fakturaId, (karta.get(b.fakturaId) ?? 0) + Number(b.belopp));
  }

  const ut: Koppling[] = [];
  const stangd = new Set<string>();
  const stangdSkv = new Set<string>();
  const ta = (k: Koppling) => {
    ut.push(k);
    upptagenBank.add(bankNyckel(k));
  };

  // --- 1. Samlad betalning med flera fakturanummer i texten ---
  // Först, annars ser en samlad betalning ut som en överbetalning av den första fakturan
  for (const b of bank) {
    if (upptagenBank.has(bankNyckel(b))) continue;
    const oppna = fakturor.filter((f) => !stangd.has(f.id) && !betalt.has(f.id) && iRiktning(f, b) && b.datum >= fonster(f).fran && b.datum <= fonster(f).till
      && harFakturanummer(f.nr, b.text) && !avvisade.has(nyckel(f.id, b.kontoHash, b.id, 'betalning')));
    if (oppna.length < 2 || oppna.length > SAMLAD_MAX) continue;
    const summa = oppna.reduce((s, f) => s + f.belopp, 0);
    const valutor = new Set(oppna.map((f) => f.valuta.toUpperCase()));
    if (valutor.size !== 1) continue;
    const p = passning(summa, [...valutor][0], Math.abs(b.belopp), [b.datum], kurs);
    if (!p || (p.slag !== 'exakt' && p.slag !== 'avgift')) continue;
    fordela(oppna, b, p, 'fakturanummer', 'saker', 'betalning');
  }

  // --- 2. Fakturanumret i texten: hela, del- och överbetalningar ---
  for (const f of fakturor) {
    const { fran, till } = fonster(f);
    const rader = bank
      .filter((b) => iRiktning(f, b) && b.datum >= fran && b.datum <= till && harFakturanummer(f.nr, b.text))
      .sort((a, b) => a.datum.localeCompare(b.datum));
    // Det som är kvar att betala, i fakturans valuta. Bekräftade betalningar
    // räknas av när fakturan är i kronor; i utländsk valuta går det inte exakt.
    const sek = f.valuta.toUpperCase() === 'SEK';
    let kvar = ore(f.belopp - (sek ? betalt.get(f.id) ?? 0 : 0));
    if (betalt.has(f.id) && (!sek || kvar <= ORESAVRUNDNING_KR)) stangd.add(f.id);
    for (const b of rader) {
      if (stangd.has(f.id) || upptagenBank.has(bankNyckel(b))) continue;
      if (avvisade.has(nyckel(f.id, b.kontoHash, b.id, 'betalning'))) continue;
      const bankKr = Math.abs(b.belopp);
      const p = passning(kvar, f.valuta, bankKr, [f.fakturadatum, b.datum], kurs);
      if (!p) {
        // Ingen kurs att räkna med — numret stämmer, men beloppet går inte att pröva
        ta({ fakturaId: f.id, kontoHash: b.kontoHash, bankId: b.id, bankDatum: b.datum, bankBelopp: b.belopp, belopp: bankKr, del: 'betalning', typ: 'hel', grund: 'fakturanummer', sakerhet: 'forslag', avvikelse: 0, kommentar: `Ingen kurs för ${f.valuta} att jämföra beloppet med` });
        stangd.add(f.id);
        continue;
      }
      if (p.slag === 'exakt' || p.slag === 'avgift') {
        ta({ fakturaId: f.id, kontoHash: b.kontoHash, bankId: b.id, bankDatum: b.datum, bankBelopp: b.belopp, belopp: bankKr, del: 'betalning', typ: kvar === f.belopp ? 'hel' : 'delbetalning', grund: 'fakturanummer', sakerhet: 'saker', avvikelse: p.avvikelse, kommentar: p.kommentar });
        stangd.add(f.id);
      } else if (p.slag === 'lagre') {
        ta({ fakturaId: f.id, kontoHash: b.kontoHash, bankId: b.id, bankDatum: b.datum, bankBelopp: b.belopp, belopp: bankKr, del: 'betalning', typ: 'delbetalning', grund: 'fakturanummer', sakerhet: 'saker', avvikelse: p.avvikelse, kommentar: [p.kommentar, `Delbetalning, ${(-p.avvikelse).toLocaleString('sv-SE')} kr kvar att betala`].filter(Boolean).join('. ') });
        // Resten väntas i fakturans valuta, med samma andel
        kvar = ore(kvar * (-p.avvikelse / p.vantat));
      } else {
        ta({ fakturaId: f.id, kontoHash: b.kontoHash, bankId: b.id, bankDatum: b.datum, bankBelopp: b.belopp, belopp: bankKr, del: 'betalning', typ: 'overbetalning', grund: 'fakturanummer', sakerhet: 'trolig', avvikelse: p.avvikelse, kommentar: [p.kommentar, `Överbetalning med ${p.avvikelse.toLocaleString('sv-SE')} kr`].filter(Boolean).join('. ') });
        stangd.add(f.id);
      }
    }
  }

  // --- 3. Belopp, med eller utan namn: en kandidat i taget, bästa först ---
  type Kandidat = { f: MatchFaktura; b: MatchBankrad; grund: Grund; p: NonNullable<Passning>; avstand: number };
  const kandidater: Kandidat[] = [];
  for (const f of fakturor) {
    if (stangd.has(f.id) || betalt.has(f.id)) continue;
    const { fran, till } = fonster(f);
    for (const b of bank) {
      if (!iRiktning(f, b) || b.datum < fran || b.datum > till || upptagenBank.has(bankNyckel(b))) continue;
      if (avvisade.has(nyckel(f.id, b.kontoHash, b.id, 'betalning'))) continue;
      const p = passning(f.belopp, f.valuta, Math.abs(b.belopp), [f.fakturadatum, b.datum], kurs);
      if (!p) continue;
      const namn = harNamn(f.motpart, b.text);
      // Avgiften godtas bara när namnet stämmer; bara belopp kräver exakt
      if (p.slag === 'exakt' || (p.slag === 'avgift' && namn)) {
        kandidater.push({ f, b, grund: namn ? 'namn' : 'belopp', p, avstand: Math.abs(dagar(b.datum, f.forfallodatum)) });
      }
    }
  }
  const perFaktura = new Map<string, number>();
  const perBank = new Map<string, number>();
  for (const k of kandidater) {
    perFaktura.set(k.f.id, (perFaktura.get(k.f.id) ?? 0) + 1);
    perBank.set(bankNyckel(k.b), (perBank.get(bankNyckel(k.b)) ?? 0) + 1);
  }
  const grad = (k: Kandidat): Sakerhet => {
    const ensam = perFaktura.get(k.f.id) === 1 && perBank.get(bankNyckel(k.b)) === 1;
    if (!ensam) return 'forslag';
    if (k.grund === 'namn') return k.p.slag === 'exakt' ? 'trolig' : 'forslag';
    return k.avstand <= BARA_BELOPP_DAGAR ? 'trolig' : 'forslag';
  };
  kandidater
    .map((k) => ({ k, s: grad(k) }))
    .sort((a, b) => RANG[a.s] - RANG[b.s] || GRUNDRANG[a.k.grund] - GRUNDRANG[b.k.grund] || a.k.avstand - b.k.avstand)
    .forEach(({ k, s }) => {
      if (stangd.has(k.f.id) || upptagenBank.has(bankNyckel(k.b))) return;
      const andra = s === 'forslag' && (perFaktura.get(k.f.id)! > 1 || perBank.get(bankNyckel(k.b))! > 1)
        ? 'Flera fakturor eller bankrader passar — närmast förfallodagen valdes'
        : null;
      ta({ fakturaId: k.f.id, kontoHash: k.b.kontoHash, bankId: k.b.id, bankDatum: k.b.datum, bankBelopp: k.b.belopp, belopp: Math.abs(k.b.belopp), del: 'betalning', typ: 'hel', grund: k.grund, sakerhet: s, avvikelse: k.p.avvikelse, kommentar: [k.p.kommentar, andra].filter(Boolean).join('. ') || null });
      stangd.add(k.f.id);
    });

  // --- 4. Samlad betalning från samma motpart, på namnet ---
  for (const b of bank) {
    if (upptagenBank.has(bankNyckel(b))) continue;
    const oppna = fakturor.filter((f) => !stangd.has(f.id) && !betalt.has(f.id) && iRiktning(f, b) && b.datum >= fonster(f).fran && b.datum <= fonster(f).till
      && f.valuta.toUpperCase() === 'SEK' && harNamn(f.motpart, b.text) && !avvisade.has(nyckel(f.id, b.kontoHash, b.id, 'betalning')));
    if (oppna.length < 2 || oppna.length > 12) continue;
    const traffar = [...kombinationer(oppna, SAMLAD_MAX)].filter((kombo) => {
      const p = passning(kombo.reduce((s, f) => s + f.belopp, 0), 'SEK', Math.abs(b.belopp), [b.datum], kurs);
      return p?.slag === 'exakt';
    });
    if (traffar.length !== 1) continue;
    const p = passning(traffar[0].reduce((s, f) => s + f.belopp, 0), 'SEK', Math.abs(b.belopp), [b.datum], kurs)!;
    fordela(traffar[0], b, p, 'namn', 'trolig', 'betalning');
  }

  // --- 5. Skatteverkets ROT/RUT-del ---
  const skvRader = bank.filter((b) => b.belopp > 0 && /skatteverket|\bskv\b/i.test(b.text));
  const medAvdrag = fakturor.filter((f) => f.avdrag > 0 && f.riktning === 'in' && f.valuta.toUpperCase() === 'SEK' && !betaltSkv.has(f.id));
  for (const b of skvRader) {
    if (upptagenBank.has(bankNyckel(b))) continue;
    const oppna = medAvdrag.filter((f) => !stangdSkv.has(f.id) && b.datum >= f.fakturadatum && b.datum <= plusManader(f.fakturadatum, SKATTEVERKET_MANADER)
      && !avvisade.has(nyckel(f.id, b.kontoHash, b.id, 'skatteverket')));
    const enskilda = oppna.filter((f) => Math.abs(b.belopp - f.avdrag) <= ORESAVRUNDNING_KR);
    if (enskilda.length >= 1) {
      const f = enskilda.sort((x, y) => x.fakturadatum.localeCompare(y.fakturadatum))[0];
      ta({ fakturaId: f.id, kontoHash: b.kontoHash, bankId: b.id, bankDatum: b.datum, bankBelopp: b.belopp, belopp: b.belopp, del: 'skatteverket', typ: 'hel', grund: 'belopp', sakerhet: enskilda.length === 1 ? 'trolig' : 'forslag', avvikelse: ore(b.belopp - f.avdrag), kommentar: enskilda.length === 1 ? null : 'Flera fakturor har samma avdrag — den äldsta valdes' });
      stangdSkv.add(f.id);
      continue;
    }
    if (oppna.length < 2 || oppna.length > 12) continue;
    const traffar = [...kombinationer(oppna, SAMLAD_MAX)].filter((kombo) => Math.abs(b.belopp - kombo.reduce((s, f) => s + f.avdrag, 0)) <= ORESAVRUNDNING_KR);
    if (traffar.length !== 1) continue;
    let rest = b.belopp;
    traffar[0].forEach((f, i) => {
      const del = i === traffar[0].length - 1 ? ore(rest) : f.avdrag;
      rest -= del;
      ut.push({ fakturaId: f.id, kontoHash: b.kontoHash, bankId: b.id, bankDatum: b.datum, bankBelopp: b.belopp, belopp: del, del: 'skatteverket', typ: 'samlad', grund: 'belopp', sakerhet: 'trolig', avvikelse: 0, kommentar: `Skatteverkets utbetalning för ${traffar[0].length} fakturor` });
      stangdSkv.add(f.id);
    });
    upptagenBank.add(bankNyckel(b));
  }

  return ut;

  /** En bankrad delas på flera fakturor: var och en får sitt belopp, den sista resten. */
  function fordela(lista: MatchFaktura[], b: MatchBankrad, p: NonNullable<Passning>, grund: Grund, sakerhet: Sakerhet, del: Del) {
    const summa = lista.reduce((s, f) => s + f.belopp, 0);
    let rest = Math.abs(b.belopp);
    lista.forEach((f, i) => {
      const andel = i === lista.length - 1 ? ore(rest) : ore(Math.abs(b.belopp) * (f.belopp / summa));
      rest -= andel;
      ut.push({
        fakturaId: f.id, kontoHash: b.kontoHash, bankId: b.id, bankDatum: b.datum, bankBelopp: b.belopp, belopp: andel, del,
        typ: 'samlad', grund, sakerhet, avvikelse: i === lista.length - 1 ? p.avvikelse : 0,
        kommentar: [`Samlad betalning för ${lista.length} fakturor (${lista.map((x) => x.nr).join(', ')})`, i === lista.length - 1 ? p.kommentar : null].filter(Boolean).join('. '),
      });
      stangd.add(f.id);
    });
    upptagenBank.add(bankNyckel(b));
  }
}
