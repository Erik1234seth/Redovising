import type { SupabaseClient } from '@supabase/supabase-js';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';
import { svenskDag } from '@/lib/dagskassa';
import { byggMejlkontext } from '@/lib/mejlkontext';
import { kompletteringText, type Komplettering } from '@/lib/transaktioner/komplettera';
import { reglerAttValja } from '@/lib/transaktioner/kundregler';
import { hamtaInstruktioner, kontextFor, reglerFor } from '@/lib/transaktioner/instruktioner';
import { tolkaBetalsatt, type Betalsatt } from './betalsatt';
import { hamtaArslista, hamtaKundbild } from './kundbild';
import { iKo } from '@/lib/ai-anrop';
import { MODELLER, fraga, type Del, type Modell } from './modeller';
import { momsText, rensaMomsdelar, sammaMoms, slaIhopDelar, type Momsdel } from './momsdelar';
import { kontoBlock, kontolista, provaKonto, slaUppKonto, type Flagga } from './regelverk';
import { filensRader, underlagetsDelar, type Filrad } from './underlag';

/**
 * Konterar utlästa transaktioner enligt K1.
 *
 * Varje transaktion konteras av båda modellerna, var för sig och med samma
 * prompter. Båda ser samma underlag:
 *
 *   - kundbilden (./kundbild): en sparad sammanställning av kunden, och en
 *     lista med alla kundens transaktioner
 *   - kundens mejl, kundprofilen och kundreglerna
 *   - originalunderlaget som det ser ut — PDF, bild eller kalkylblad — och
 *     alla transaktioner som lästs ut ur filen (./underlag)
 *
 * Kunden och filen ligger först i anropen och cachas, så att nästa
 * transaktion ur samma fil inte läser om dem.
 *
 *   Pass 1     Analys: vad affären är, och 1–5 kandidatkonton ur
 *              K1-kontoplanen som modellen själv väljer.
 *   Pass 2     Kontering: modellen får kandidaternas hela regeltext —
 *              beskrivning, använd när, använd inte när, beslutsregler,
 *              granskning — och delar upp transaktionen per konto och
 *              momssats, väljer kundregler och säger vilka regler som inte
 *              stämmer. Ett konto utanför K1 ger ett nytt försök, en gång.
 *   Kod        Varje konto prövas: får det väljas automatiskt, håller
 *              beloppsgränserna. Momsen räknas och flaggorna sätts.
 *   Jämkning   Är modellerna oense eller osäkra får var och en se den andras
 *              kontering och kontera om en gång. Är de fortfarande oense går
 *              transaktionen till Granska med båda resonemangen.
 *
 * Betalkontot väljer inte modellen. Det följer av kunden: företagskonto ger
 * 1930, privatkonto ger 2017 vid köp och 2013 vid försäljning.
 *
 * Kontantmetoden: verifikationen får transaktionens datum, inga kund- eller
 * leverantörsskulder.
 *
 * Inget bokförs här. Konteringen är preliminär och blir verifikation 14 dagar
 * efter att den senast ändrades, när båda modellerna är gröna och har valt
 * samma konto och moms — eller när Erik valt konto själv. Se ./preliminar.
 */

export type Omdome = 'gron' | 'gul' | 'rod';
type Momshantering = 'svensk' | 'ingen' | 'omvand';

interface Transaktion {
  id: string;
  user_id: string;
  customer_email: string | null;
  underlag_id: string | null;
  datum: string | null;
  beskrivning: string | null;
  motpart: string | null;
  belopp: number;
  moms: number | null;
  valuta: string | null;
  riktning: 'in' | 'ut';
  anteckning: string | null;
  detaljer: string | null;
  vat_nummer: string | null;
  uppgifter: Record<string, unknown> | null;
  komplettering: Komplettering | null;
  dublettkoll: { status: string; motivering: string; avFil: string | null } | null;
  tillrackligt: { antaganden: string } | null;
  kalla: string;
}

interface Kandidatsvar {
  analys: string;
  kandidater: { konto: string; varfor: string }[];
}

/** Ett konto modellen övervägde i pass 1. */
export interface Kandidat {
  konto: string;
  namn: string;
  varfor: string;
}

interface Beslut {
  /** En del per konto och momssats — en enda när hela beloppet har samma konto och sats. */
  delar: { konto: string; momssats: 0 | 6 | 12 | 25; belopp: number; moms: number | null }[];
  momshantering: Momshantering;
  sakerhet: 'hog' | 'medel' | 'lag';
  motivering: string;
  regler: string[];
  brutna_regler: string[];
  granskning_kravs: boolean;
}

/** Vad modellen tyckte före jämkningen, och om den ändrade sig. */
export interface Jamkning {
  fore: { konto: string | null; momssats: number | null; momsdelar: Momsdel[] | null; omdome: Omdome; motivering: string };
  andradeSig: boolean;
  motivering: string;
}

export interface Kontering {
  modell: Modell;
  /** Modellen som faktiskt svarade. */
  svarade: string;
  /** Kontot med störst del av beloppet. */
  konto: string | null;
  momssats: number | null;
  /** Delarna per konto och sats när transaktionen är uppdelad, annars null. */
  momsdelar: Momsdel[] | null;
  motivering: string;
  /** Kundreglerna modellen valde. */
  regler: string[];
  /**
   * Hur modellen kom fram: analysen och kandidaterna ur pass 1, reglerna som
   * inte stämde, och jämkningen. `forstaKonto` är kontot före jämkningen.
   * Fälten `battre_konto` och `konton` finns kvar från den gamla granskningen.
   */
  granskning: {
    /** Modellens egen säkerhet. Låg gör raden gul, medel visas bara. */
    sakerhet: 'hog' | 'medel' | 'lag';
    stammer: boolean;
    battre_konto: string | null;
    brutna_regler: string[];
    granskning_kravs: boolean;
    motivering: string;
    forstaKonto: string;
    konton: unknown[];
    analys: string;
    kandidater: Kandidat[];
    jamkning: Jamkning | null;
  } | null;
  flaggor: Flagga[];
  omdome: Omdome;
}

export interface Utfall {
  transaktionId: string;
  konteringar: Kontering[];
  fel?: string;
}

// ---------- prompter ----------

const KANDIDAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['analys', 'kandidater'],
  properties: {
    analys: { type: 'string' },
    kandidater: {
      type: 'array',
      description: '1–5 K1-konton som kan vara rätt, det troligaste först',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['konto', 'varfor'],
        properties: {
          konto: { type: 'string', description: 'Fyrsiffrigt konto ur K1-kontoplanen' },
          varfor: { type: 'string' },
        },
      },
    },
  },
};

/** Reglerna att välja bland skiljer mellan kunder, så schemat byggs per kund. */
const beslutSchema = (regelIdn: string[]) => ({
  type: 'object',
  additionalProperties: false,
  required: ['delar', 'momshantering', 'sakerhet', 'motivering', 'regler', 'brutna_regler', 'granskning_kravs'],
  properties: {
    delar: {
      type: 'array',
      description: 'En rad per konto och momssats. En enda rad när hela beloppet har samma konto och sats.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['konto', 'momssats', 'belopp', 'moms'],
        properties: {
          konto: { type: 'string', description: 'Fyrsiffrigt konto ur K1-kontoplanen' },
          momssats: { type: 'integer', enum: [0, 6, 12, 25] },
          belopp: { type: 'number', description: 'Delens belopp inklusive moms' },
          moms: { type: ['number', 'null'], description: 'Delens moms enligt underlaget, null om underlaget inte visar någon moms' },
        },
      },
    },
    momshantering: { type: 'string', enum: ['svensk', 'ingen', 'omvand'] },
    sakerhet: { type: 'string', enum: ['hog', 'medel', 'lag'] },
    motivering: { type: 'string' },
    regler: { type: 'array', items: { type: 'string', enum: regelIdn }, description: 'Id på kundreglerna som gäller transaktionen' },
    brutna_regler: { type: 'array', items: { type: 'string' } },
    granskning_kravs: { type: 'boolean' },
  },
});

const GEMENSAMT = `Du konterar transaktioner åt en svensk enskild näringsidkare som upprättar förenklat årsbokslut (K1) och bokför enligt kontantmetoden.

Du får, i den här ordningen:
- KUNDBILDEN: en kollegas sammanställning av kunden.
- KUNDENS TRANSAKTIONER: alla kundens transaktioner, en rad var (K1, K2 …).
- Kundens mejl till byrån och kundreglerna.
- ORIGINALUNDERLAGET som transaktionen kommer ifrån — kvittot, fakturan eller kontoutdraget som det ser ut — och alla transaktioner som lästs ut ur filen (F1, F2 …).
- Sist EN transaktion att kontera, med var den står i filen och i kundens lista.

Titta på originalet själv. Avskriften kan ha missat något eller läst fel — säg det i så fall i motiveringen. Använd filens andra rader och kundens övriga transaktioner för att förstå vad affären är: en återkommande leverantör, en insättning och ett uttag med samma belopp, en bankrad vars kvitto finns i en annan fil. Hänvisa till raderna (F3, K120).

Allmänna regler:
- Välj bara konton ur K1-kontoplanen nedan. Inga andra konton, inte heller BAS-underkonton som 3001 eller 5410. Välj aldrig betalkontot — bank- eller privatsidan bokförs av systemet.
- Kontot väljs utifrån K1-kontoplanen och kontobeskrivningarna — byråns egen dokumentation. Hur kunden, byrån eller andra kunder bokfört liknande tidigare är en ledtråd om vad affären är, inte om vilket konto som är rätt: tidigare bokföringar kan vara gjorda i ett annat program, med BAS-underkonton, eller vara fel. Det gäller också "byrån valde" i kundens lista.
- Använd kundens verksamhet för att avgöra vad ett köp är till för. Har kunden i ett mejl förklarat vad ett köp eller en inbetalning avser, väger det tyngre än en gissning — säg det i motiveringen.
- Står det en instruktion från byrån i anteckningen följer du den. Den väger tyngst av allt. Står det BYRÅNS KONTEXT vid transaktionen följer du den på samma sätt.`;

const KANDIDAT_FAST = `${GEMENSAMT}

I DET HÄR STEGET väljer du inte konto. Du tar reda på vad affären är och vilka konton som kan komma i fråga. I nästa steg får du kandidaternas fullständiga regler och väljer.

- analys: vad transaktionen är och hur du vet det — vad som syns på originalet, vad filens andra rader och kundens övriga transaktioner säger, vad kunden skrivit. Säg vad som är oklart. Några meningar på svenska.
- kandidater: 1–5 konton ur K1-kontoplanen som kan vara rätt, det troligaste först, med en kort mening om varför. Ta med de konton du på allvar övervägt, också de mindre troliga — ett konto du inte tar med får du inte reglerna för. Hör delar av transaktionen till olika konton, till exempel livsmedel och diskmedel på samma kvitto, ta med alla de kontona.

K1-KONTOPLAN (konto namn — beskrivning [sökord]):
${kontolista()}`;

const BESLUT_FAST = `${GEMENSAMT}

I DET HÄR STEGET konterar du. Du har redan analyserat transaktionen och valt kandidatkonton, och nu får du deras fullständiga regler: beskrivning, "Använd när", "Använd INTE när", beslutsregler och när en människa ska granska. Välj bland kandidaterna och pröva valet mot reglerna. Passar ingen av dem får du välja ett annat konto ur K1-kontoplanen — säg då varför i motiveringen.

- delar: en rad per konto och momssats, med beloppet inklusive moms. Hör allt till samma konto och har samma momssats blir det en enda rad med hela beloppet.
- Hör delar av transaktionen till olika konton, dela upp den — även när en del är liten. Ta beloppen ur underlagets rader.
- Har underlaget flera momssatser — t.ex. livsmedel på 6 % och förpackningar på 25 % — blir det en rad per sats, även när satserna har samma konto. Ta beloppen ur underlagets momsspecifikation när den finns.
- momssats: svensk moms som ingår i delens belopp (25, 12, 6 eller 0). 0 när ingen avdragsgill eller utgående moms finns.
- moms: delens moms enligt underlaget. Anger underlaget bara momsen per sats och satsen delas på flera konton, räkna ut varje dels andel. null när underlaget inte visar någon moms.
- En del kan vara negativ, t.ex. returnerad pant på 0 %. Delarna ska tillsammans bli transaktionens belopp.
- momshantering: "svensk" vid vanlig svensk moms, "ingen" när momsen inte hanteras (momsfritt, privat, lån, överföringar, skatter), "omvand" vid omvänd skattskyldighet, EU-förvärv eller import.
- sakerhet: "hog" bara när underlaget tydligt visar vad det är och reglerna pekar ut kontot. "lag" när du gissar.
- motivering: två eller tre meningar på svenska om vad affären är och varför kontot är rätt enligt reglerna.
- regler: id på de KUNDREGLER som gäller transaktionen. Ta bara med en regel när underlaget, uppgifterna, mejlen eller byråns kontext visar att den gäller — tom lista annars. En regel du tar med följer du: dess instruktion är byråns och väger lika tungt som anteckningen. Nämn regeln i motiveringen.
- brutna_regler: punkter ur reglerna för de konton du valt som inte stämmer på transaktionen, citerade ur texten. Tom lista när allt stämmer. Kan du inte välja ett konto utan att bryta en regel, välj det bästa och citera regeln här.
- granskning_kravs: true om någon punkt under "Kräver manuell granskning när" stämmer på transaktionen, eller om underlaget inte räcker för att avgöra.

Gränsprövningarna i reglerna är uträknade i kod. Godta siffrorna.

Transaktionen konteras direkt från underlaget, inte från en tidigare bokföring. Punkter som handlar om vilket BAS-konto en post tidigare bokförts på stämmer därför aldrig — bortse från dem. Bokslutsjusteringar — t.ex. lagerinventering, periodiseringar och avskrivningar — görs i bokslutet. Punkter som tydligt gäller dem bryter inga regler och kräver ingen granskning här.

K1-KONTOPLAN (konto namn — beskrivning [sökord]):
${kontolista()}`;

/** Läggs till när modellerna inte är överens och var och en får se den andras kontering. */
const JAMKNING = `EN ANNAN MODELL HAR KONTERAT SAMMA TRANSAKTION, och ni kom inte fram till samma sak eller var inte säkra. Nedan står ditt förslag och den andras, med motiveringar. Pröva båda mot reglerna och underlaget på nytt.

Ändra dig om den andras resonemang är bättre — men bara då. Står du fast vid ditt, säg varför den andras inte håller. Är ni fortfarande oense eller osäkra får en människa avgöra, och då hjälper det att du är tydlig med vad som är oklart. Skriv i motiveringen vad du tog ställning till.`;

const RATTELSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['datum', 'belopp', 'moms', 'valuta', 'riktning', 'kommentar'],
  properties: {
    datum: { type: ['string', 'null'], description: 'YYYY-MM-DD, eller null om det inte ändras' },
    belopp: { type: ['number', 'null'], description: 'Nytt totalbelopp inklusive moms, positivt, eller null' },
    moms: { type: ['number', 'null'], description: 'Nytt momsbelopp, eller null' },
    valuta: { type: ['string', 'null'], description: 'Ny valutakod, eller null' },
    riktning: { type: ['string', 'null'], enum: ['in', 'ut', null] },
    kommentar: { type: 'string' },
  },
};

const RATTELSE_FAST = `Du rättar en transaktion åt en svensk bokföringsbyrå innan den konteras. Byrån har skrivit en instruktion om transaktionen.

Avgör om instruktionen ändrar transaktionens uppgifter: datum, belopp, moms, valuta eller riktning. Ändra bara det instruktionen säger eller som direkt följer av den, och sätt null på resten. Handlar instruktionen bara om vilket konto eller vilken moms som ska väljas, är alla fält null — den följer med till konteringen ändå.

Bokföringen sker i svenska kronor. Är beloppet i en annan valuta och instruktionen ger kursen eller beloppet i kronor, räkna om belopp och moms till kronor och sätt valuta till "SEK". Ger instruktionen ingen kurs, ändra bara valutan och skriv i kommentaren att beloppet i kronor saknas. Hitta aldrig på en växelkurs.

kommentar: en mening på svenska om vad du ändrade, eller att inget ändrades.`;

function transaktionText(t: Transaktion, betalsatt: Betalsatt): string {
  return [
    `Datum: ${t.datum || 'okänt'}`,
    `Riktning: ${t.riktning === 'in' ? 'pengar IN till företaget' : 'pengar UT från företaget'}`,
    `Belopp: ${t.belopp} ${t.valuta || 'SEK'}`,
    `Moms enligt underlaget: ${t.moms ? `${t.moms} kr` : 'framgår inte'}`,
    t.motpart ? `Motpart: ${t.motpart}` : '',
    t.vat_nummer ? `Motpartens VAT-nummer: ${t.vat_nummer}` : '',
    `Beskrivning: ${t.beskrivning || '—'}`,
    t.anteckning ? `Anteckning: ${t.anteckning}` : '',
    t.detaljer ? `Allt som står om transaktionen på underlaget:\n${t.detaljer}` : '',
    t.uppgifter ? `Uppgifter utplockade ur underlaget:\n${JSON.stringify(t.uppgifter, null, 1)}` : '',
    kompletteringText(t.komplettering),
    t.tillrackligt?.antaganden ? `Antaganden när underlaget kontrollerades: ${t.tillrackligt.antaganden}` : '',
    `Källa: ${t.kalla === 'bank' ? 'rad på kontoutdrag (inget kvitto)'
      : t.kalla === 'woocommerce' ? 'order eller återbetalning i kundens webbutik (WooCommerce), hämtad direkt från butiken'
      : 'utläst ur kundens underlag'}`,
    `Betalas via: ${betalsatt === 'privatkonto' ? 'privatkonto' : betalsatt === 'foretagskonto' ? 'företagskonto' : 'okänt'}`,
  ].filter(Boolean).join('\n');
}

// ---------- kunden ----------

/** Kontot pengarna går via. Vid "båda" vet vi inte — då väljer Erik. */
function betalkonto(betalsatt: Betalsatt, riktning: 'in' | 'ut'): string | null {
  if (betalsatt === 'foretagskonto') return '1930';
  if (betalsatt === 'privatkonto') return riktning === 'ut' ? '2017' : '2013';
  return null;
}

// ---------- moms och verifikation ----------

const ore = (n: number) => Math.round(n * 100) / 100;

/** En del som den bokförs: konto, sats, belopp inklusive moms och momsen. */
interface Bokdel { konto: string; sats: number; belopp: number; moms: number }

/**
 * Delarna ur konteringen, ihopslagna per konto och sats och med största beloppet
 * först — det kontot är transaktionens huvudkonto. Är det bara en del gäller
 * transaktionens belopp, oavsett vad modellen skrev.
 */
function delarUrBeslut(t: Transaktion, p: Beslut): Momsdel[] {
  const delar = slaIhopDelar(p.delar);
  return delar.length === 1 ? [{ ...delar[0], belopp: Number(t.belopp) }] : delar;
}

/**
 * Momsen tas från underlaget när den står där. Annars räknas den fram ur
 * satsen — men då är den en gissning, och raden kan inte bli grön.
 *
 * Varje del räknas för sig, och delarna ska tillsammans bli transaktionens
 * belopp och moms.
 */
function raknaMoms(t: Transaktion, delar: Momsdel[], momshantering: Momshantering, huvudkonto: string): { moms: number; delar: Bokdel[]; flaggor: Flagga[] } {
  const flaggor: Flagga[] = [];
  const konto = (d: Momsdel) => d.konto ?? huvudkonto;
  if (delar.length > 1) {
    const summa = ore(delar.reduce((s, d) => s + d.belopp, 0));
    if (Math.abs(summa - t.belopp) > 1) {
      flaggor.push({ typ: 'moms', allvar: 'granskning', text: `Delarna (${momsText(null, delar)}) blir ${summa} kr, men transaktionen är ${t.belopp} kr.` });
    }
  }
  if (momshantering === 'omvand') {
    flaggor.push({ typ: 'omvand-moms', allvar: 'granskning', text: 'Omvänd skattskyldighet eller import — momsen bokförs för hand.' });
    return { moms: 0, delar: delar.map((d) => ({ konto: konto(d), sats: 0, belopp: d.belopp, moms: 0 })), flaggor };
  }
  const underlag = Number(t.moms) || 0;
  if (momshantering === 'ingen') {
    if (underlag > 0) flaggor.push({ typ: 'moms', allvar: 'granskning', text: `Underlaget visar ${underlag} kr i moms men transaktionen bokförs utan moms.` });
    return { moms: 0, delar: delar.map((d) => ({ konto: konto(d), sats: 0, belopp: d.belopp, moms: 0 })), flaggor };
  }

  const bokdelar = delar.map((d) => {
    const raknad = ore((d.belopp * d.momssats) / (100 + d.momssats));
    // En enda del utan egen moms får underlagets
    const angiven = d.moms ?? (delar.length === 1 && underlag > 0 ? underlag : null);
    if (angiven !== null && Math.abs(angiven - raknad) > 1) {
      flaggor.push({ typ: 'moms', allvar: 'granskning', text: `Momsen för ${delar.length > 1 ? `${konto(d)} ${d.momssats} %` : `${d.momssats} %`} (${angiven} kr) stämmer inte med beloppet ${d.belopp} kr (${raknad} kr).` });
    }
    return { konto: konto(d), sats: d.momssats, belopp: d.belopp, moms: angiven === null ? raknad : ore(angiven) };
  });
  const moms = ore(bokdelar.reduce((s, d) => s + d.moms, 0));
  if (underlag > 0) {
    if (Math.abs(underlag - moms) > 1) {
      flaggor.push({ typ: 'moms', allvar: 'granskning', text: `Momsen på underlaget (${underlag} kr) stämmer inte med ${momsText(delar[0]?.momssats ?? 0, delar.length > 1 ? delar : null)} (${moms} kr).` });
    }
  } else if (moms > 0) {
    flaggor.push({ typ: 'moms', allvar: 'granskning', text: `Momsen framgår inte av underlaget — ${moms} kr är uträknat.` });
  }
  return { moms, delar: bokdelar, flaggor };
}

const MOMSKONTO_UT: Record<number, string> = { 25: '2611', 12: '2621', 6: '2631' };

/**
 * Raderna i verifikationen, debet positivt: en rad per konto, momsen och
 * betalkontot. Balanserar alltid — huvudkontot, den första delen, tar
 * öresavrundningen.
 * Ingående moms samlas på 2641; utgående får ett konto per sats.
 */
function byggRader(t: Transaktion, delar: Bokdel[], motkonto: string) {
  const brutto = ore(t.belopp);
  const moms = ore(delar.reduce((s, d) => s + d.moms, 0));
  const ut = t.riktning === 'ut';
  const netto = new Map<string, number>();
  for (const d of delar) netto.set(d.konto, ore((netto.get(d.konto) ?? 0) + d.belopp - d.moms));
  const huvud = delar[0].konto;
  const ovriga = [...netto].filter(([k]) => k !== huvud).reduce((s, [, n]) => s + n, 0);
  netto.set(huvud, ore(brutto - moms - ovriga));

  const rader: { konto: string; belopp: number }[] = [];
  for (const [k, n] of netto) if (n || k === huvud) rader.push({ konto: k, belopp: ut ? n : -n });
  const momskonton = new Map<string, number>();
  for (const d of delar) {
    const k = ut ? '2641' : MOMSKONTO_UT[d.sats] ?? '2611';
    momskonton.set(k, ore((momskonton.get(k) ?? 0) + d.moms));
  }
  for (const [k, m] of momskonton) if (m) rader.push({ konto: k, belopp: ut ? m : -m });
  rader.push({ konto: motkonto, belopp: ut ? -brutto : brutto });
  return rader;
}

// ---------- en modell, en transaktion ----------

/** Det som är gemensamt för båda modellerna och alla pass för en transaktion. */
interface Underlagsfraga {
  /** Kunddelen av systemprompten: profil, kundbild, årslista, mejl och kundregler. */
  kund: string;
  /** Originalunderlaget och filens transaktioner. */
  delat: Del[];
  /** Transaktionen som konteras, och byråns kontext. */
  user: string;
  regelIdn: string[];
}

/** Ett första steg: vad affären är och vilka konton som kan komma i fråga. */
async function valjKandidater(modell: Modell, f: Underlagsfraga): Promise<{ analys: string; kandidater: Kandidat[]; svarade: string }> {
  const fraga1 = (extra = '') => fraga<Kandidatsvar>(modell, {
    system: { fast: KANDIDAT_FAST, kund: f.kund }, delat: f.delat, user: f.user + extra, namn: 'kandidater', schema: KANDIDAT_SCHEMA,
  });
  const lista = (s: Kandidatsvar) => (Array.isArray(s.kandidater) ? s.kandidater : []).map((k) => ({ ...k, konto: String(k.konto ?? '').trim() }));
  let svar = await fraga1();
  const saknas = lista(svar.data).filter((k) => !slaUppKonto(k.konto)).map((k) => k.konto);
  if (saknas.length) svar = await fraga1(`\n\nDitt förra svar hade ${saknas.join(', ')}, som inte finns i K1-kontoplanen. Välj konton ur listan.`);

  const kandidater = lista(svar.data)
    .filter((k, i, a) => slaUppKonto(k.konto) && a.findIndex((x) => x.konto === k.konto) === i)
    .slice(0, 5)
    .map((k) => ({ konto: k.konto, namn: slaUppKonto(k.konto)!.namn, varfor: String(k.varfor ?? '') }));
  if (!kandidater.length) throw new Error(`${modell} gav inga kandidatkonton ur K1`);
  return { analys: String(svar.data.analys ?? ''), kandidater, svarade: svar.modell };
}

/** Kandidatkontonas hela regeltext, med gränsprövningarna uträknade på hela beloppet. */
function kandidatRegler(t: Transaktion, kandidater: Kandidat[]): string {
  const brutto = Number(t.belopp);
  const netto = ore(brutto - (Number(t.moms) || 0));
  return kandidater.map((k) => kontoBlock(provaKonto({ konto: k.konto, netto, brutto, datum: t.datum }))).join('\n\n---\n\n');
}

/** Andra steget: konteringen, med kandidaternas regler framför sig. */
async function besluta(
  modell: Modell, f: Underlagsfraga, t: Transaktion, analys: string, kandidater: Kandidat[], jamkning?: string,
): Promise<{ beslut: Beslut; svarade: string }> {
  const user = [
    f.user,
    `DIN ANALYS FRÅN FÖRRA STEGET:\n${analys}`,
    `KANDIDATKONTONA OCH DERAS REGLER:\n\n${kandidatRegler(t, kandidater)}`,
    jamkning ?? '',
  ].filter(Boolean).join('\n\n');
  const schema = beslutSchema(f.regelIdn);
  const saknas = (b: Beslut) => (Array.isArray(b.delar) ? b.delar : []).map((d) => d.konto).filter((k) => !slaUppKonto(k));
  let svar = await fraga<Beslut>(modell, { system: { fast: BESLUT_FAST, kund: f.kund }, delat: f.delat, user, namn: 'kontering', schema });
  if (saknas(svar.data).length) {
    svar = await fraga<Beslut>(modell, {
      system: { fast: BESLUT_FAST, kund: f.kund },
      delat: f.delat,
      user: `${user}\n\nDitt förra svar hade ${saknas(svar.data).join(', ')}, som inte finns i K1-kontoplanen. Välj konton ur listan.`,
      namn: 'kontering',
      schema,
    });
  }
  return { beslut: svar.data, svarade: svar.modell };
}

/**
 * Konteringen ur modellens beslut, med det som avgörs i kod: momsen,
 * kontonas gränsprövningar och det som gör en rad osäker oavsett konto.
 */
function byggKontering(
  modell: Modell,
  t: Transaktion,
  betalsatt: Betalsatt,
  beslut: Beslut,
  regelIdn: string[],
  svarade: Set<string>,
  extra: { analys: string; kandidater: Kandidat[]; forstaKonto: string | null; jamkning: Jamkning | null },
): Kontering {
  const flaggor: Flagga[] = [];
  // Bara regler som finns, en gång var
  const regler = [...new Set((Array.isArray(beslut.regler) ? beslut.regler : []).filter((id) => regelIdn.includes(id)))];

  const forstaDelar = delarUrBeslut(t, beslut);
  if (!forstaDelar.length) throw new Error(`${modell} gav inget konto`);
  const huvudkonto = forstaDelar[0].konto ?? '';
  const { delar: bokdelar, flaggor: momsflaggor } = raknaMoms(t, forstaDelar, beslut.momshantering, huvudkonto);
  flaggor.push(...momsflaggor);

  // Varje konto prövas i kod: får det väljas automatiskt, håller beloppsgränserna
  for (const konto of new Set(bokdelar.map((d) => d.konto))) {
    const del = bokdelar.filter((d) => d.konto === konto);
    const brutto = ore(del.reduce((s, d) => s + d.belopp, 0));
    const netto = ore(del.reduce((s, d) => s + d.belopp - d.moms, 0));
    flaggor.push(...provaKonto({ konto, netto, brutto, datum: t.datum }).flaggor);
  }
  const brutna = (Array.isArray(beslut.brutna_regler) ? beslut.brutna_regler : []).filter((r) => String(r).trim());
  if (brutna.length) flaggor.push({ typ: 'brutna-regler', allvar: 'granskning', text: `Stämmer inte med kontots regler: ${brutna.join(' · ')}` });
  if (beslut.granskning_kravs) flaggor.push({ typ: 'manuell-granskning', allvar: 'granskning', text: 'Reglerna kräver manuell granskning för den här transaktionen, eller underlaget räcker inte för att avgöra.' });

  // Det som gör en rad osäker oavsett konto
  const slutdelar = slaIhopDelar(forstaDelar);
  const motkonto = betalkonto(betalsatt, t.riktning);
  if (!motkonto) flaggor.push({ typ: 'betalsatt', allvar: 'granskning', text: 'Kunden betalar via både företags- och privatkonto — välj betalkonto.' });
  if (motkonto && slutdelar.some((d) => d.konto === motkonto)) flaggor.push({ typ: 'samma-konto', allvar: 'stopp', text: `${motkonto} är också betalkontot.` });
  if (!t.datum) flaggor.push({ typ: 'datum', allvar: 'granskning', text: 'Transaktionen saknar datum.' });
  // Dublettkollen var osäker — då bokförs den inte förrän någon tittat
  if (t.dublettkoll?.status === 'tveksam') {
    flaggor.push({ typ: 'dublett', allvar: 'granskning', text: `Kan vara en dubblett${t.dublettkoll.avFil ? ` av en transaktion i ${t.dublettkoll.avFil}` : ''}: ${t.dublettkoll.motivering}` });
  }
  if (t.valuta && t.valuta !== 'SEK') flaggor.push({ typ: 'valuta', allvar: 'granskning', text: `Beloppet är i ${t.valuta} och måste räknas om till kronor.` });
  // Medel sparas och visas men skickar inte raden till Granska — bara låg gör det
  if (beslut.sakerhet === 'lag') flaggor.push({ typ: 'osaker', allvar: 'granskning', text: 'Modellens säkerhet: låg.' });

  const svensk = beslut.momshantering === 'svensk';
  const sparade = slutdelar.map((d) => (svensk ? d : { ...d, momssats: 0, moms: null }));
  const omdome: Omdome = flaggor.some((f) => f.allvar === 'stopp') ? 'rod' : flaggor.length ? 'gul' : 'gron';
  const konto = slutdelar[0]?.konto ?? null;
  return {
    modell,
    svarade: [...svarade].join(', '),
    konto,
    momssats: svensk ? slutdelar[0]?.momssats ?? 0 : 0,
    momsdelar: rensaMomsdelar(sparade),
    motivering: String(beslut.motivering ?? ''),
    regler,
    granskning: {
      sakerhet: beslut.sakerhet === 'hog' || beslut.sakerhet === 'lag' ? beslut.sakerhet : 'medel',
      stammer: !brutna.length,
      battre_konto: null,
      brutna_regler: brutna,
      granskning_kravs: !!beslut.granskning_kravs,
      motivering: '',
      forstaKonto: extra.forstaKonto ?? konto ?? '',
      konton: [],
      analys: extra.analys,
      kandidater: extra.kandidater,
      jamkning: extra.jamkning,
    },
    flaggor,
    omdome,
  };
}

interface Forslag {
  kontering: Kontering;
  analys: string;
  kandidater: Kandidat[];
  svarade: Set<string>;
}

async function konteraMedModell(modell: Modell, t: Transaktion, betalsatt: Betalsatt, f: Underlagsfraga): Promise<Forslag> {
  const k = await valjKandidater(modell, f);
  const { beslut, svarade } = await besluta(modell, f, t, k.analys, k.kandidater);
  const alla = new Set([k.svarade, svarade]);
  return {
    kontering: byggKontering(modell, t, betalsatt, beslut, f.regelIdn, alla, { analys: k.analys, kandidater: k.kandidater, forstaKonto: null, jamkning: null }),
    analys: k.analys,
    kandidater: k.kandidater,
    svarade: alla,
  };
}

/** Båda gröna och överens om konto och moms — samma regel som när konteringen blir verifikation. */
function overens(k: Kontering[]): boolean {
  const [a] = k;
  return k.length >= 2 && k.every((x) => x.omdome === 'gron' && x.konto && x.konto === a.konto
    && sammaMoms({ momssats: Number(x.momssats), momsdelar: x.momsdelar }, { momssats: Number(a.momssats), momsdelar: a.momsdelar }));
}

const MODELLNAMN: Record<string, string> = { 'gpt-6-astra': 'GPT-6 Astra', 'claude-opus-5-5': 'Claude Opus 5.5' };

function forslagText(k: Kontering, analys: string): string {
  return [
    `Konto: ${k.konto ?? '—'} ${k.konto ? slaUppKonto(k.konto)?.namn ?? '' : ''}, moms ${momsText(k.momssats ?? 0, k.momsdelar)}`,
    `Analys: ${analys}`,
    `Motivering: ${k.motivering}`,
    k.flaggor.length ? `Flaggor: ${k.flaggor.map((x) => x.text).join(' · ')}` : '',
  ].filter(Boolean).join('\n');
}

function jamkningText(egen: Forslag, annan: Forslag): string {
  return `${JAMKNING}\n\nDITT FÖRSLAG:\n${forslagText(egen.kontering, egen.analys)}\n\nDEN ANDRA MODELLENS FÖRSLAG (${MODELLNAMN[annan.kontering.modell] ?? annan.kontering.modell}):\n${forslagText(annan.kontering, annan.analys)}`;
}

/**
 * Modellerna var oense eller osäkra. Var och en får se den andras kontering
 * och kontera om en gång, med båda modellernas kandidater. Är de fortfarande
 * oense går transaktionen till Granska med båda resonemangen.
 */
async function jamka(t: Transaktion, betalsatt: Betalsatt, f: Underlagsfraga, forsta: Forslag[]): Promise<Kontering[]> {
  return Promise.all(forsta.map(async (egen, i) => {
    const annan = forsta[1 - i];
    const kandidater = [...egen.kandidater, ...annan.kandidater]
      .filter((k, n, a) => a.findIndex((x) => x.konto === k.konto) === n).slice(0, 8);
    const { beslut, svarade } = await besluta(egen.kontering.modell, f, t, egen.analys, kandidater, jamkningText(egen, annan));
    const ny = byggKontering(egen.kontering.modell, t, betalsatt, beslut, f.regelIdn, new Set([...egen.svarade, svarade]), {
      analys: egen.analys,
      kandidater,
      forstaKonto: egen.kontering.konto,
      jamkning: null,
    });
    const fore = egen.kontering;
    const andradeSig = ny.konto !== fore.konto
      || !sammaMoms({ momssats: Number(ny.momssats), momsdelar: ny.momsdelar }, { momssats: Number(fore.momssats), momsdelar: fore.momsdelar });
    ny.granskning!.jamkning = {
      fore: { konto: fore.konto, momssats: fore.momssats, momsdelar: fore.momsdelar, omdome: fore.omdome, motivering: fore.motivering },
      andradeSig,
      motivering: ny.motivering,
    };
    return ny;
  }));
}

// ---------- flera transaktioner ----------

/** Så många transaktioner samtidigt. Varje transaktion kör båda modellerna samtidigt. */
const SAMTIDIGA = 4;

export async function konteraTransaktioner(
  supabase: SupabaseClient,
  userId: string,
  transaktionIds: string[],
  {
    torrkorning = false,
    medBokforda = false,
  }: {
    torrkorning?: boolean;
    /** Kör om alla: bokförda konteras också, och verifikationen ersätts om konteringen ändrats (se ./ersatt). */
    medBokforda?: boolean;
  } = {},
): Promise<Utfall[]> {
  const { data: profil, error: profilFel } = await supabase
    .from('profiles').select(KUND_KOLUMNER).eq('id', userId).maybeSingle();
  if (profilFel) throw new Error(`Kunde inte läsa kunden: ${profilFel.message}`);
  const betalsatt = tolkaBetalsatt((profil as unknown as Kund | null)?.har_foretagskonto ?? null);
  if (!betalsatt) throw new Error('Välj först om kunden betalar via företagskonto eller privatkonto (Kundkontext).');

  const { data: rader, error } = await supabase
    .from('transaktioner')
    .select(TRANSAKTION_KOLUMNER)
    .eq('user_id', userId)
    .is('dublett_av', null)
    // Redan bokförda via en kassarapport eller dagskassa: pengarna ligger
    // redan på 1930, och en kontering till skulle lägga dem där två gånger
    .is('dublett_orsak', null)
    .in('id', transaktionIds);
  if (error) throw new Error(`Kunde inte läsa transaktionerna: ${error.message}`);

  // Redan bokförda transaktioner konteras inte om, och rader på 0 kr finns
  // det inget att bokföra på
  const { data: bokforda } = await supabase
    .from('verifikationer').select('transaktion_id').in('transaktion_id', transaktionIds);
  const klara = new Set((bokforda ?? []).map((v) => v.transaktion_id as string));
  const kvar = (rader as Transaktion[]).filter((t) => (medBokforda || !klara.has(t.id)) && Number(t.belopp) > 0);
  if (!kvar.length) return [];

  // Byråns kontext och regler från flödesschemat
  const instruktioner = await hamtaInstruktioner(supabase, {
    userId, underlagIds: [...new Set(kvar.map((t) => t.underlag_id).filter((x): x is string => !!x))],
  });
  const allaRegler = reglerFor(instruktioner, userId);

  // Kunden: samma för alla transaktioner, och cachas därför i systemprompten
  const [kundbild, arslista, mejl] = await Promise.all([
    hamtaKundbild(supabase, userId),
    hamtaArslista(supabase, userId),
    byggMejlkontext(supabase, { userId, emails: [(profil as unknown as Kund | null)?.email] }),
  ]);
  const kund = [
    byggKundkontext(profil as unknown as Kund | null),
    kundbild ? `KUNDBILDEN:\n${kundbild}` : 'KUNDBILDEN: inte sammanställd än — utgå från kundens transaktioner nedan.',
    `KUNDENS TRANSAKTIONER (${arslista.rader.length} st, äldst först):\n${arslista.text || '(inga)'}`,
    mejl,
    `KUNDREGLER:\n${reglerAttValja(allaRegler)}`,
  ].filter(Boolean).join('\n\n');

  // Filen: samma för transaktionerna ur samma underlag
  const filer = new Map<string, Promise<{ delat: Del[]; nummer: Map<string, number> }>>();
  const filen = (underlagId: string) => {
    if (!filer.has(underlagId)) {
      filer.set(underlagId, (async () => {
        const { data: filrader } = await supabase.from('transaktioner')
          .select('id, datum, riktning, belopp, valuta, motpart, beskrivning').eq('underlag_id', underlagId).order('radnr');
        const lista = (filrader ?? []) as Filrad[];
        return { delat: await underlagetsDelar(supabase, underlagId, lista), nummer: filensRader(lista).nummer };
      })());
    }
    return filer.get(underlagId)!;
  };

  return iKo(kvar, SAMTIDIGA, async (t): Promise<Utfall> => {
    const kontext = kontextFor(instruktioner, t);
    try {
      if (kontext && !torrkorning) t = await rattaEfterKontext(supabase, t, betalsatt, kontext);
      const fil = t.underlag_id ? await filen(t.underlag_id) : { delat: [], nummer: new Map<string, number>() };
      const f = fil.nummer.get(t.id);
      const k = arslista.nummer.get(t.id);
      const var_ = [f ? `F${f} i filen` : '', k ? `K${k} i kundens lista` : ''].filter(Boolean).join(', ');
      return konteraEn(supabase, t, betalsatt, {
        kund,
        delat: fil.delat,
        user: [`TRANSAKTIONEN ATT KONTERA${var_ ? ` (${var_})` : ''}:\n${transaktionText(t, betalsatt)}`, kontext].filter(Boolean).join('\n\n'),
        regelIdn: allaRegler.map((r) => r.id),
      }, torrkorning);
    } catch (err) {
      return { transaktionId: t.id, konteringar: [], fel: err instanceof Error ? err.message : String(err) };
    }
  });
}

/**
 * Byråns kontext kan rätta transaktionens uppgifter — "beloppet är 3 235,43
 * kr" på en rad i EUR. Konteringen läser kontexten ändå, men beloppet,
 * valutaflaggan och bokföringen tar uppgifterna från transaktionen, så de
 * rättas här först. Står inget nytt i kontexten ändras ingenting.
 */
async function rattaEfterKontext(supabase: SupabaseClient, t: Transaktion, betalsatt: Betalsatt, kontext: string): Promise<Transaktion> {
  const { data: r } = await fraga<{
    datum: string | null; belopp: number | null; moms: number | null;
    valuta: string | null; riktning: 'in' | 'ut' | null; kommentar: string;
  }>('gpt-6-astra', {
    system: { fast: RATTELSE_FAST, kund: '' },
    user: `TRANSAKTIONEN:\n${transaktionText(t, betalsatt)}\n\nBYRÅNS INSTRUKTION:\n${kontext}`,
    namn: 'rattelse',
    schema: RATTELSE_SCHEMA,
  });
  const fore: Record<string, unknown> = { ...t, valuta: t.valuta || 'SEK' };
  const andringar: Andringar = Object.fromEntries(
    (['datum', 'belopp', 'moms', 'valuta', 'riktning'] as const)
      // Belopp kommer som "300.00" ur databasen
      .filter((k) => r[k] !== null && r[k] !== undefined && (typeof r[k] === 'number'
        ? Number(r[k]) !== Number(fore[k] ?? NaN)
        : String(r[k]) !== String(fore[k] ?? '')))
      .map((k) => [k, r[k]]),
  );
  if (!Object.keys(andringar).length) return t;
  await sparaAndringar(supabase, t, andringar, `Rättat efter byråns kontext: ${r.kommentar}`);
  return { ...t, ...andringar } as Transaktion;
}

/** En torrkörning konterar men sparar ingenting — för att prova prompter och modeller. */
async function konteraEn(
  supabase: SupabaseClient,
  t: Transaktion,
  betalsatt: Betalsatt,
  f: Underlagsfraga,
  torrkorning: boolean,
): Promise<Utfall> {
  let forsta: Forslag[];
  try {
    forsta = await Promise.all(MODELLER.map((m) => konteraMedModell(m, t, betalsatt, f)));
  } catch (err) {
    return { transaktionId: t.id, konteringar: [], fel: err instanceof Error ? err.message : String(err) };
  }
  let konteringar = forsta.map((x) => x.kontering);
  if (!overens(konteringar)) {
    try {
      konteringar = await jamka(t, betalsatt, f, forsta);
    } catch (err) {
      // Utan jämkning gäller de första förslagen, och raden går till Granska ändå
      const text = `Jämkningen misslyckades: ${err instanceof Error ? err.message : String(err)}`;
      konteringar = konteringar.map((k) => ({ ...k, flaggor: [...k.flaggor, { typ: 'jamkning', allvar: 'granskning', text }], omdome: k.omdome === 'gron' ? 'gul' : k.omdome }));
    }
  }
  if (torrkorning) return { transaktionId: t.id, konteringar };

  const { error } = await supabase.from('konteringar').upsert(
    konteringar.map((k) => ({
      transaktion_id: t.id,
      user_id: t.user_id,
      modell: k.modell,
      konto: k.konto,
      momssats: k.momssats,
      momsdelar: k.momsdelar,
      motivering: k.motivering,
      regler: k.regler,
      granskning: k.granskning ? { ...k.granskning, svarade: k.svarade } : { svarade: k.svarade },
      flaggor: k.flaggor,
      omdome: k.omdome,
      // När konteringen gjordes — upserten skriver annars inte om tiden
      created_at: new Date().toISOString(),
    })),
    { onConflict: 'transaktion_id,modell' },
  );
  if (error) return { transaktionId: t.id, konteringar, fel: `Kunde inte spara konteringen: ${error.message}` };

  // En ny kontering ersätter ett konto byrån valt förut, och de 14 dagarna
  // till verifikation börjar om (se ./preliminar)
  const { error: tFel } = await supabase.from('transaktioner')
    .update({ vald_kontering: null, preliminar_at: new Date().toISOString() }).eq('id', t.id);
  if (tFel) return { transaktionId: t.id, konteringar, fel: `Kunde inte spara konteringen: ${tFel.message}` };
  return { transaktionId: t.id, konteringar };
}

export const TRANSAKTION_KOLUMNER =
  'id, user_id, customer_email, underlag_id, datum, beskrivning, motpart, belopp, moms, valuta, riktning, anteckning, detaljer, vat_nummer, uppgifter, komplettering, dublettkoll, tillrackligt, kalla';

/**
 * Erik väljer konto för hand — ett av modellernas förslag eller ett eget.
 * Betalkontot följer kunden, utom när kunden betalar från båda hållen; då
 * skickas det med.
 *
 * Valet är preliminärt som allt annat: det sparas på transaktionen och blir
 * verifikation 14 dagar senare (./preliminar). Till dess går det att ändra.
 */
export async function valjKonto(
  supabase: SupabaseClient,
  userId: string,
  transaktionId: string,
  konto: string,
  momssats: number,
  motkonto?: string,
  /** Från ett förslag med flera momssatser. */
  momsdelar?: Momsdel[] | null,
) {
  const { data: t, error } = await supabase
    .from('transaktioner').select(TRANSAKTION_KOLUMNER).eq('id', transaktionId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa transaktionen: ${error.message}`);
  if (!t) throw new Error('Transaktionen finns inte');
  const { data: profil } = await supabase.from('profiles').select('har_foretagskonto').eq('id', userId).maybeSingle();
  const betalsatt = tolkaBetalsatt(profil?.har_foretagskonto ?? null);
  if (!betalsatt) throw new Error('Välj först om kunden betalar via företagskonto eller privatkonto');
  if (motkonto && !['1930', '2013', '2017'].includes(motkonto)) throw new Error(`${motkonto} är inget betalkonto`);
  const { count } = await supabase
    .from('verifikationer').select('id', { count: 'exact', head: true }).eq('transaktion_id', transaktionId);
  if (count) throw new Error('Transaktionen är redan bokförd — ångra först');
  if (![0, 6, 12, 25].includes(momssats)) throw new Error('Momssatsen måste vara 0, 6, 12 eller 25');
  if (!slaUppKonto(konto)) throw new Error(`${konto} finns inte bland K1-kontona`);
  for (const d of momsdelar ?? []) {
    if (d.konto && !slaUppKonto(d.konto)) throw new Error(`${d.konto} finns inte bland K1-kontona`);
  }
  if (!motkonto && !betalkonto(betalsatt, (t as Transaktion).riktning)) throw new Error('Kunden betalar från båda hållen — välj betalkonto');
  const nu = new Date().toISOString();
  const vald: ValdKontering = { konto, momssats, momsdelar: rensaMomsdelar(momsdelar), motkonto: motkonto ?? null, at: nu };
  const { error: uFel } = await supabase.from('transaktioner').update({ vald_kontering: vald, preliminar_at: nu }).eq('id', transaktionId);
  if (uFel) throw new Error(`Kunde inte spara valet: ${uFel.message}`);
}

/** Kontot byrån valt för hand, i `transaktioner.vald_kontering`. */
export interface ValdKontering {
  konto: string;
  momssats: number;
  momsdelar: Momsdel[] | null;
  /** Betalkontot, bara när kunden betalar från båda hållen. */
  motkonto: string | null;
  at: string;
}

// ---------- rätta transaktionen ----------

export interface Andringar {
  datum?: string;
  belopp?: number;
  moms?: number;
  valuta?: string;
  riktning?: 'in' | 'ut';
}

const FALTNAMN: Record<keyof Andringar, string> = {
  datum: 'datum', belopp: 'belopp', moms: 'moms', valuta: 'valuta', riktning: 'riktning',
};

/** Transaktionen, så länge den inte är bokförd. En bokförd rad ändras inte under verifikationen. */
async function obokford(supabase: SupabaseClient, userId: string, transaktionId: string): Promise<Transaktion> {
  const { data: t, error } = await supabase
    .from('transaktioner').select(TRANSAKTION_KOLUMNER).eq('id', transaktionId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa transaktionen: ${error.message}`);
  if (!t) throw new Error('Transaktionen finns inte');
  const { count } = await supabase
    .from('verifikationer').select('id', { count: 'exact', head: true }).eq('transaktion_id', transaktionId);
  if (count) throw new Error('Transaktionen är redan bokförd — ångra bokföringen först');
  return t as Transaktion;
}

/**
 * Skriver ändringarna på transaktionen. Det gamla värdet sparas i anteckningen,
 * så att det syns vad underlaget sa och vad som ändrats — och konteringen läser
 * anteckningen.
 */
async function sparaAndringar(supabase: SupabaseClient, t: Transaktion, andringar: Andringar, notering?: string) {
  const ny = { ...andringar };
  if (ny.datum !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(ny.datum)) throw new Error('Datumet ska skrivas ÅÅÅÅ-MM-DD');
  if (ny.belopp !== undefined && !(ny.belopp > 0)) throw new Error('Beloppet måste vara större än noll');
  if (ny.valuta !== undefined) {
    ny.valuta = ny.valuta.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(ny.valuta)) throw new Error('Valutan ska vara en kod på tre bokstäver, t.ex. SEK eller DKK');
  }
  if (ny.riktning !== undefined && ny.riktning !== 'in' && ny.riktning !== 'ut') throw new Error('Riktningen är in eller ut');
  const belopp = ny.belopp ?? Number(t.belopp);
  if (ny.moms !== undefined && (ny.moms < 0 || ny.moms >= belopp)) throw new Error('Momsen måste vara mindre än beloppet');

  const fore: Record<string, unknown> = { ...t, valuta: t.valuta || 'SEK' };
  const byten = (Object.keys(ny) as (keyof Andringar)[])
    .filter((k) => ny[k] !== undefined && String(ny[k]) !== String(fore[k] ?? ''))
    .map((k) => `${FALTNAMN[k]} ${fore[k] ?? '—'} → ${ny[k]}`);
  if (!byten.length && !notering) return;

  const rad = [`${svenskDag(new Date())}: ${notering ?? 'Ändrat av byrån'}`, byten.length ? `(${byten.join(', ')})` : '']
    .filter(Boolean).join(' ');
  const { error } = await supabase.from('transaktioner').update({
    ...Object.fromEntries(Object.entries(ny).filter(([, v]) => v !== undefined)),
    anteckning: [t.anteckning, rad].filter(Boolean).join('\n'),
    // En ändring startar om de 14 dagarna till verifikation
    preliminar_at: new Date().toISOString(),
  }).eq('id', t.id);
  if (error) throw new Error(`Kunde inte spara ändringen: ${error.message}`);
}

/** Erik rättar datum, belopp, moms, valuta eller riktning för hand. Förslagen ligger kvar. */
export async function andraTransaktion(supabase: SupabaseClient, userId: string, transaktionId: string, andringar: Andringar) {
  await sparaAndringar(supabase, await obokford(supabase, userId, transaktionId), andringar);
}

/**
 * Erik skriver vad som är fel, och AI:n gör om konteringen utifrån det.
 *
 * Först rättar en modell transaktionens uppgifter om instruktionen kräver det
 * — ett belopp i fel valuta, fel datum. Instruktionen sparas i anteckningen
 * och följer därmed med när båda modellerna sedan konterar om från början.
 */
export async function konteraMedInstruktion(
  supabase: SupabaseClient,
  userId: string,
  transaktionId: string,
  instruktion: string,
): Promise<{ kommentar: string; utfall: Utfall | undefined }> {
  const t = await obokford(supabase, userId, transaktionId);
  const { data: profil } = await supabase.from('profiles').select('har_foretagskonto').eq('id', userId).maybeSingle();
  const betalsatt = tolkaBetalsatt(profil?.har_foretagskonto ?? null);
  if (!betalsatt) throw new Error('Välj först om kunden betalar via företagskonto eller privatkonto (Kundkontext).');

  const { data: r } = await fraga<{
    datum: string | null; belopp: number | null; moms: number | null;
    valuta: string | null; riktning: 'in' | 'ut' | null; kommentar: string;
  }>('gpt-6-astra', {
    system: { fast: RATTELSE_FAST, kund: '' },
    user: `TRANSAKTIONEN:\n${transaktionText(t, betalsatt)}\n\nBYRÅNS INSTRUKTION:\n${instruktion}`,
    namn: 'rattelse',
    schema: RATTELSE_SCHEMA,
  });

  const andringar: Andringar = {
    datum: r.datum ?? undefined,
    belopp: r.belopp ?? undefined,
    moms: r.moms ?? undefined,
    valuta: r.valuta ?? undefined,
    riktning: r.riktning ?? undefined,
  };
  await sparaAndringar(supabase, t, andringar, `Instruktion från byrån: ${instruktion}`);

  // Förslagen gällde de gamla uppgifterna — konteringen görs om från början
  const { error } = await supabase.from('konteringar').delete().eq('transaktion_id', transaktionId).eq('user_id', userId);
  if (error) throw new Error(`Kunde inte ta bort de gamla förslagen: ${error.message}`);
  const [utfall] = await konteraTransaktioner(supabase, userId, [transaktionId]);
  return { kommentar: r.kommentar, utfall };
}

/**
 * Raderna en kontering blir i verifikationen, debet positivt. Samma räkning
 * när den bokförs som när en ny kontering jämförs med en bokförd (./ersatt).
 */
export function verifikationsrader(
  t: Transaktion,
  konto: string,
  momssats: number,
  betalsatt: Betalsatt,
  motkontoOverride?: string,
  momsdelar?: Momsdel[] | null,
): { konto: string; belopp: number }[] {
  if (!slaUppKonto(konto)) throw new Error(`${konto} finns inte bland K1-kontona`);
  const motkonto = motkontoOverride ?? betalkonto(betalsatt, t.riktning);
  if (!motkonto) throw new Error('Betalkonto saknas');
  const uppdelad = rensaMomsdelar(momsdelar);
  for (const d of uppdelad ?? []) {
    if (d.konto && !slaUppKonto(d.konto)) throw new Error(`${d.konto} finns inte bland K1-kontona`);
  }
  const delar: Momsdel[] = uppdelad ?? [{ konto, momssats, belopp: Number(t.belopp), moms: null }];
  const { delar: bokdelar } = raknaMoms(t, delar, momssats || uppdelad ? 'svensk' : 'ingen', konto);
  return byggRader(t, bokdelar, motkonto);
}

/**
 * Bokför en transaktion som verifikation. Används både när modellerna är
 * överens och när Erik väljer ett förslag. Momsen räknas på samma sätt som i
 * konteringen, så att det som bokförs är det som visades.
 */
export async function bokfor(
  supabase: SupabaseClient,
  t: Transaktion,
  konto: string,
  momssats: number,
  betalsatt: Betalsatt,
  signatur: string,
  motkontoOverride?: string,
  momsdelar?: Momsdel[] | null,
) {
  if (!t.datum) throw new Error('Transaktionen saknar datum');
  const rader = verifikationsrader(t, konto, momssats, betalsatt, motkontoOverride, momsdelar);

  const id = crypto.randomUUID();
  const { error } = await supabase.from('verifikationer').insert({
    id,
    user_id: t.user_id,
    customer_email: t.customer_email,
    underlag_id: t.underlag_id,
    transaktion_id: t.id,
    kalla: 'ai',
    serie: 'AI',
    datum: t.datum,
    text: [t.motpart, t.beskrivning].filter(Boolean).join(' — ') || null,
    registrerad: svenskDag(new Date()),
    signatur,
    summa: rader.filter((r) => r.belopp > 0).reduce((s, r) => s + r.belopp, 0),
    balanserad: true,
  });
  if (error) throw new Error(`Kunde inte spara verifikationen: ${error.message}`);

  const { error: radFel } = await supabase.from('verifikation_rader').insert(rader.map((r, radnr) => ({
    verifikation_id: id,
    radnr,
    konto: r.konto,
    kontonamn: slaUppKonto(r.konto)?.namn ?? null,
    belopp: r.belopp,
    datum: t.datum,
    text: null,
    objekt: [],
    borttagen: false,
    tillagd: false,
  })));
  if (radFel) {
    await supabase.from('verifikationer').delete().eq('id', id);
    throw new Error(`Kunde inte spara konteringsraderna: ${radFel.message}`);
  }
}
