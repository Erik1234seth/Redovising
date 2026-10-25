import type { SupabaseClient } from '@supabase/supabase-js';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';
import { svenskDag } from '@/lib/dagskassa';
import { byggMejlkontext } from '@/lib/mejlkontext';
import { kompletteringText, type Komplettering } from '@/lib/transaktioner/komplettera';
import { regelText, reglerAttValja, type Kundregel } from '@/lib/transaktioner/kundregler';
import { hamtaInstruktioner, kontextFor, reglerFor } from '@/lib/transaktioner/instruktioner';
import { tolkaBetalsatt, type Betalsatt } from './betalsatt';
import { MODELLER, fraga, type Modell, type System } from './modeller';
import { momsText, rensaMomsdelar, sammaMoms, slaIhopDelar, type Momsdel } from './momsdelar';
import { kontoBlock, kontolista, provaKonto, slaUppKonto, type Flagga } from './regelverk';

/**
 * Konterar utlästa transaktioner enligt K1.
 *
 * Varje transaktion konteras av båda modellerna, var för sig och med samma
 * prompter:
 *
 *   Pass 1     Modellen delar upp transaktionen per konto ur K1-kontoplanen
 *              och momssats — livsmedel på 4000 och diskmedel på 5400, eller
 *              livsmedel 6 % och förpackningar 25 % — och väljer vilka
 *              kundregler (`@/lib/transaktioner/kundregler`) som gäller. Ett
 *              konto utanför K1 ger modellen ett nytt försök, en gång.
 *   Kod        Varje konto prövas: får det väljas automatiskt, håller
 *              beloppsgränserna.
 *   Pass 2     Per konto: modellen får kontots hela regeltext — beskrivning,
 *              använd när, använd inte när, beslutsregler — och prövar om
 *              delen stämmer. Pekar granskningen ut ett annat konto prövas
 *              det också; går det igenom byts kontot, annars behålls det
 *              första och raden blir gul.
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

interface Pass1 {
  /** En del per konto och momssats — en enda när hela beloppet har samma konto och sats. */
  delar: { konto: string; momssats: 0 | 6 | 12 | 25; belopp: number; moms: number | null }[];
  momshantering: Momshantering;
  sakerhet: 'hog' | 'medel' | 'lag';
  motivering: string;
  regler: string[];
}

interface Pass2 {
  stammer: boolean;
  battre_konto: string | null;
  brutna_regler: string[];
  granskning_kravs: boolean;
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
  /** Granskningen av huvudkontot, med alla konton i `konton`. */
  granskning: (Pass2 & { forstaKonto: string; konton: GranskatKonto[] }) | null;
  flaggor: Flagga[];
  omdome: Omdome;
}

/** Pass 2 för ett konto. `forstaKonto` är kontot pass 1 valde, `konto` det som gäller efter granskningen. */
interface GranskatKonto extends Pass2 {
  konto: string;
  forstaKonto: string;
}

export interface Utfall {
  transaktionId: string;
  konteringar: Kontering[];
  fel?: string;
}

// ---------- prompter ----------

/** Reglerna att välja bland skiljer mellan kunder, så schemat byggs per kund. */
const pass1Schema = (regelIdn: string[]) => ({
  type: 'object',
  additionalProperties: false,
  required: ['delar', 'momshantering', 'sakerhet', 'motivering', 'regler'],
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
  },
});

const PASS2_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['stammer', 'battre_konto', 'brutna_regler', 'granskning_kravs', 'motivering'],
  properties: {
    stammer: { type: 'boolean' },
    battre_konto: { type: ['string', 'null'] },
    brutna_regler: { type: 'array', items: { type: 'string' } },
    granskning_kravs: { type: 'boolean' },
    motivering: { type: 'string' },
  },
};

const PASS1_FAST = `Du konterar transaktioner åt en svensk enskild näringsidkare som upprättar förenklat årsbokslut (K1) och bokför enligt kontantmetoden.

Du får EN transaktion. Välj konto för vad transaktionen avser: kostnad, intäkt, tillgång, skuld eller eget kapital. Välj aldrig betalkontot — bank- eller privatsidan bokförs av systemet.

Regler:
- Välj bara konton ur K1-kontoplanen nedan. Inga andra konton, inte heller BAS-underkonton som 3001 eller 5410.
- delar: en rad per konto och momssats, med beloppet inklusive moms. Hör allt till samma konto och har samma momssats blir det en enda rad med hela beloppet.
- Hör delar av transaktionen till olika konton, dela upp den — även när en del är liten. Ett kvitto med livsmedel till försäljning och diskmedel blir t.ex. en rad på 4000 och en på 5400. Ta beloppen ur underlagets rader.
- Har underlaget flera momssatser — t.ex. livsmedel på 6 % och förpackningar på 25 % — blir det en rad per sats, även när satserna har samma konto. Ta beloppen ur underlagets momsspecifikation när den finns.
- momssats: svensk moms som ingår i delens belopp (25, 12, 6 eller 0). 0 när ingen avdragsgill eller utgående moms finns.
- moms: delens moms enligt underlaget. Anger underlaget bara momsen per sats och satsen delas på flera konton, räkna ut varje dels andel. null när underlaget inte visar någon moms.
- En del kan vara negativ, t.ex. returnerad pant på 0 %. Delarna ska tillsammans bli transaktionens belopp.
- momshantering: "svensk" vid vanlig svensk moms, "ingen" när momsen inte hanteras (momsfritt, privat, lån, överföringar, skatter), "omvand" vid omvänd skattskyldighet, EU-förvärv eller import.
- sakerhet: "hog" bara när underlaget tydligt visar vad det är. "lag" när du gissar.
- motivering: en eller två meningar om varför, på svenska.
- Använd kundens verksamhet för att avgöra vad ett köp är till för. Har kunden i ett mejl förklarat vad ett köp eller en inbetalning avser, väger det tyngre än en gissning — säg det i motiveringen.
- Står det en instruktion från byrån i anteckningen följer du den. Den väger tyngst av allt.
- Står det BYRÅNS KONTEXT vid transaktionen följer du den på samma sätt som anteckningen.
- regler: id på de KUNDREGLER (sist i instruktionen) som gäller transaktionen. Ta bara med en regel när underlaget, uppgifterna, mejlen eller byråns kontext visar att den gäller — tom lista annars. En regel du tar med följer du: dess instruktion är byråns och väger lika tungt som anteckningen. Nämn regeln i motiveringen.
- Kontot väljs bara utifrån K1-kontoplanen och kontobeskrivningarna nedan — byråns egen dokumentation. Använd ingen annan källa. Hur kunden eller andra kunder bokfört liknande saker tidigare är en ledtråd om vad affären är, inte om vilket konto som är rätt: tidigare bokföringar kan vara gjorda i ett annat program, med BAS-underkonton eller fel. Stämmer historiken inte med kontobeskrivningarna gäller beskrivningarna.

K1-KONTOPLAN (konto namn — beskrivning [sökord]):
${kontolista()}`;

const PASS2_FAST = `Du granskar en kontering åt en svensk enskild näringsidkare som upprättar förenklat årsbokslut (K1) och bokför enligt kontantmetoden.

Du får en transaktion, kontot som valts och kontots regler ur K1-kontobeskrivningarna. Pröva transaktionen mot kontots beskrivning, "Använd när", "Använd INTE när" och beslutsreglerna.

En transaktion kan vara uppdelad på flera konton. Då prövar du bara delen som ligger på kontot du får — de andra delarna prövas för sig, och det som hör till dem gör inte ditt konto fel.

- stammer: true om delen passar kontot. false om beskrivningen inte passar eller om någon punkt under "Använd INTE när" stämmer på delen.
- battre_konto: när stammer är false, kontot som reglerna pekar på för hela delen (fyrsiffrigt K1-konto), annars null. Gissa inte — null om reglerna inte pekar ut något. Innehåller delen saker som hör till olika konton ska den delas upp: sätt stammer till false, battre_konto till null och skriv i motiveringen vad som ska delas ut till vilket konto.
- brutna_regler: de regler eller punkter som inte stämmer, citerade ur texten.
- granskning_kravs: true om någon punkt under "Kräver manuell granskning när" stämmer på transaktionen, eller om underlaget inte räcker för att avgöra.
- motivering: en eller två meningar på svenska.

Gränsprövningarna är uträknade i kod. Godta siffrorna.

Transaktionen konteras direkt från underlaget, inte från en tidigare bokföring. Punkter som handlar om vilket BAS-konto en post tidigare bokförts på stämmer därför aldrig — bortse från dem.

Bokslutsjusteringar — t.ex. lagerinventering, periodiseringar och avskrivningar — görs i bokslutet, inte när en transaktion konteras. Punkter som tydligt gäller bokslutsjusteringar är därför irrelevanta här: de bryter inga regler och kräver ingen manuell granskning.

Står det en instruktion från byrån i anteckningen och kontot följer den, är kontot rätt om inte reglerna uttryckligen förbjuder det. Detsamma gäller KUNDREGLER SOM GÄLLER och BYRÅNS KONTEXT.`;

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
 * Delarna ur pass 1, ihopslagna per konto och sats och med största beloppet
 * först — det kontot är transaktionens huvudkonto. Är det bara en del gäller
 * transaktionens belopp, oavsett vad modellen skrev.
 */
function delarUrPass1(t: Transaktion, p: Pass1): Momsdel[] {
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

async function konteraMedModell(
  modell: Modell,
  t: Transaktion,
  betalsatt: Betalsatt,
  kund: string,
  { allaRegler, kontext }: Byran,
): Promise<Kontering> {
  const user = [transaktionText(t, betalsatt), kontext].filter(Boolean).join('\n\n');
  const flaggor: Flagga[] = [];
  const regelIdn = allaRegler.map((r) => r.id);
  // Reglerna skiljer mellan kunder och ligger därför i kunddelen, efter den cachade
  const system: System = { fast: PASS1_FAST, kund: [kund, `KUNDREGLER:\n${reglerAttValja(allaRegler)}`].filter(Boolean).join('\n\n') };
  const schema = pass1Schema(regelIdn);

  // Pass 1, och ett nytt försök om något konto inte finns i K1
  const saknas = (p: Pass1) => (Array.isArray(p.delar) ? p.delar : []).map((d) => d.konto).filter((k) => !slaUppKonto(k));
  let svar = await fraga<Pass1>(modell, { system, user, namn: 'kontering', schema });
  if (saknas(svar.data).length) {
    svar = await fraga<Pass1>(modell, {
      system,
      user: `${user}\n\nDitt förra svar hade ${saknas(svar.data).join(', ')}, som inte finns i K1-kontoplanen. Välj konton ur listan.`,
      namn: 'kontering',
      schema,
    });
  }
  const p1 = svar.data;
  const svarade = new Set([svar.modell]);
  // Bara regler som finns, en gång var
  const regler = [...new Set((Array.isArray(p1.regler) ? p1.regler : []).filter((id) => regelIdn.includes(id)))];

  const forstaDelar = delarUrPass1(t, p1);
  if (!forstaDelar.length) throw new Error(`${modell} gav inget konto`);
  const huvudkonto = forstaDelar[0].konto ?? '';
  const { delar: bokdelar, flaggor: momsflaggor } = raknaMoms(t, forstaDelar, p1.momshantering, huvudkonto);
  flaggor.push(...momsflaggor);

  // Pass 2 per konto. Underkänns kontot och granskningen pekar ut ett annat,
  // prövas det också — går det igenom byts kontot, annars behålls det första.
  const konton = [...new Set(bokdelar.map((d) => d.konto))];
  const uppdelning = konton.length > 1
    ? `Transaktionen är uppdelad: ${konton.map((k) => `${k} ${ore(bokdelar.filter((d) => d.konto === k).reduce((s, d) => s + d.belopp, 0))} kr`).join(', ')}.`
    : '';
  const granskade = await Promise.all(konton.map(async (forsta) => {
    const del = bokdelar.filter((d) => d.konto === forsta);
    const brutto = ore(del.reduce((s, d) => s + d.belopp, 0));
    const netto = ore(del.reduce((s, d) => s + d.belopp - d.moms, 0));
    const prova = (konto: string) => provaKonto({ konto, netto, brutto, datum: t.datum });
    const granska = async (provning: ReturnType<typeof prova>) => {
      const g = await fraga<Pass2>(modell, {
        system: { fast: PASS2_FAST, kund },
        user: [
          `TRANSAKTIONEN:\n${user}`,
          uppdelning,
          `VALT KONTO: ${provning.rad!.konto} ${provning.rad!.namn}${konton.length > 1 ? ` för ${brutto} kr inklusive moms` : ''}, momssats ${momsText(del[0].sats, del.length > 1 ? del.map((d) => ({ momssats: d.sats, belopp: d.belopp, moms: d.moms })) : null)}\nMotivering: ${p1.motivering}`,
          regelText(regler, allaRegler),
          `KONTOTS REGLER:\n${kontoBlock(provning)}`,
        ].filter(Boolean).join('\n\n'),
        namn: 'granskning',
        schema: PASS2_SCHEMA,
      });
      svarade.add(g.modell);
      return g.data;
    };

    const provning = prova(forsta);
    // Pass 2 bara när kontot alls finns att pröva mot
    if (!provning.rad) return { konto: forsta, provning, granskning: null, egna: [] as Flagga[] };
    const g = await granska(provning);
    const nytt = g.battre_konto?.trim();
    if (g.stammer || !nytt || nytt === forsta || !slaUppKonto(nytt)) {
      return {
        konto: forsta, provning, granskning: { ...g, konto: forsta, forstaKonto: forsta },
        egna: g.stammer ? [] : [{ typ: 'granskning', allvar: 'granskning', text: `Granskningen av ${forsta}: ${g.motivering}` } as Flagga],
      };
    }
    const andraProvning = prova(nytt);
    const g2 = await granska(andraProvning);
    if (g2.stammer) return { konto: nytt, provning: andraProvning, granskning: { ...g2, konto: nytt, forstaKonto: forsta }, egna: [] as Flagga[] };
    return {
      konto: forsta, provning, granskning: { ...g, konto: forsta, forstaKonto: forsta },
      egna: [{ typ: 'granskning', allvar: 'granskning', text: `Granskningen av ${forsta}: ${g.motivering} Förslaget ${nytt} underkändes också: ${g2.motivering}` } as Flagga],
    };
  }));

  for (const x of granskade) {
    flaggor.push(...x.egna, ...x.provning.flaggor);
    if (x.granskning?.granskning_kravs) {
      flaggor.push({ typ: 'manuell-granskning', allvar: 'granskning', text: `Reglerna för ${x.konto} kräver manuell granskning för den här transaktionen.` });
    }
  }
  // Byten från granskningen slås in i delarna. Två delar kan hamna på samma konto.
  const byte = new Map(granskade.map((x, i) => [konton[i], x.konto]));
  const slutdelar = slaIhopDelar(forstaDelar.map((d) => ({ ...d, konto: byte.get(d.konto ?? huvudkonto) ?? d.konto ?? huvudkonto })));
  const huvud = granskade.find((x) => x.konto === slutdelar[0]?.konto) ?? granskade[0];
  const konton2 = granskade.flatMap((x) => (x.granskning ? [x.granskning] : []));

  // Det som gör en rad osäker oavsett konto
  const motkonto = betalkonto(betalsatt, t.riktning);
  if (!motkonto) flaggor.push({ typ: 'betalsatt', allvar: 'granskning', text: 'Kunden betalar via både företags- och privatkonto — välj betalkonto.' });
  if (motkonto && slutdelar.some((d) => d.konto === motkonto)) flaggor.push({ typ: 'samma-konto', allvar: 'stopp', text: `${motkonto} är också betalkontot.` });
  if (!t.datum) flaggor.push({ typ: 'datum', allvar: 'granskning', text: 'Transaktionen saknar datum.' });
  // Dublettkollen var osäker — då bokförs den inte förrän någon tittat
  if (t.dublettkoll?.status === 'tveksam') {
    flaggor.push({ typ: 'dublett', allvar: 'granskning', text: `Kan vara en dubblett${t.dublettkoll.avFil ? ` av en transaktion i ${t.dublettkoll.avFil}` : ''}: ${t.dublettkoll.motivering}` });
  }
  if (t.valuta && t.valuta !== 'SEK') flaggor.push({ typ: 'valuta', allvar: 'granskning', text: `Beloppet är i ${t.valuta} och måste räknas om till kronor.` });
  if (p1.sakerhet !== 'hog') flaggor.push({ typ: 'osaker', allvar: 'granskning', text: `Modellens säkerhet: ${p1.sakerhet === 'lag' ? 'låg' : 'medel'}.` });

  const svensk = p1.momshantering === 'svensk';
  const sparade = slutdelar.map((d) => (svensk ? d : { ...d, momssats: 0, moms: null }));
  const omdome: Omdome = flaggor.some((f) => f.allvar === 'stopp') ? 'rod' : flaggor.length ? 'gul' : 'gron';
  return {
    modell,
    svarade: [...svarade].join(', '),
    konto: slutdelar[0]?.konto ?? null,
    momssats: svensk ? slutdelar[0]?.momssats ?? 0 : 0,
    momsdelar: rensaMomsdelar(sparade),
    motivering: p1.motivering,
    regler,
    granskning: huvud?.granskning ? {
      ...huvud.granskning,
      // Med flera konton står varje kontos granskning i motiveringen
      motivering: konton2.length > 1 ? konton2.map((g) => `${g.konto}: ${g.motivering}`).join(' ') : huvud.granskning.motivering,
      konton: konton2,
    } : null,
    flaggor,
    omdome,
  };
}

// ---------- flera transaktioner ----------

/** Så många transaktioner i taget. Varje transaktion kör båda modellerna samtidigt. */
const SAMTIDIGA = 3;

export async function konteraTransaktioner(
  supabase: SupabaseClient,
  userId: string,
  transaktionIds: string[],
  { torrkorning = false }: { torrkorning?: boolean } = {},
): Promise<Utfall[]> {
  const { data: profil, error: profilFel } = await supabase
    .from('profiles').select(KUND_KOLUMNER).eq('id', userId).maybeSingle();
  if (profilFel) throw new Error(`Kunde inte läsa kunden: ${profilFel.message}`);
  const betalsatt = tolkaBetalsatt((profil as unknown as Kund | null)?.har_foretagskonto ?? null);
  if (!betalsatt) throw new Error('Välj först om kunden betalar via företagskonto eller privatkonto (Kundkontext).');
  const kund = [
    byggKundkontext(profil as unknown as Kund | null),
    await byggMejlkontext(supabase, { userId, emails: [(profil as unknown as Kund | null)?.email] }),
  ].filter(Boolean).join('\n\n');

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
  const kvar = (rader as Transaktion[]).filter((t) => !klara.has(t.id) && Number(t.belopp) > 0);

  // Byråns kontext och regler från flödesschemat
  const instruktioner = await hamtaInstruktioner(supabase, {
    userId, underlagIds: [...new Set(kvar.map((t) => t.underlag_id).filter((x): x is string => !!x))],
  });
  const allaRegler = reglerFor(instruktioner, userId);

  const utfall: Utfall[] = [];
  for (let i = 0; i < kvar.length; i += SAMTIDIGA) {
    utfall.push(...await Promise.all(kvar.slice(i, i + SAMTIDIGA).map(async (t) => {
      const kontext = kontextFor(instruktioner, t);
      try {
        if (kontext && !torrkorning) t = await rattaEfterKontext(supabase, t, betalsatt, kontext);
      } catch (err) {
        return { transaktionId: t.id, konteringar: [], fel: err instanceof Error ? err.message : String(err) };
      }
      return konteraEn(supabase, t, betalsatt, kund, { allaRegler, kontext }, torrkorning);
    })));
  }
  return utfall;
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

/** Det byrån lagt till i flödesschemat: alla regler kunden har, och kontexten för transaktionen. */
interface Byran {
  allaRegler: Kundregel[];
  kontext: string;
}

/** En torrkörning konterar men sparar ingenting — för att prova prompter och modeller. */
async function konteraEn(
  supabase: SupabaseClient,
  t: Transaktion,
  betalsatt: Betalsatt,
  kund: string,
  byran: Byran,
  torrkorning: boolean,
): Promise<Utfall> {
  let konteringar: Kontering[];
  try {
    konteringar = await Promise.all(MODELLER.map((m) => konteraMedModell(m, t, betalsatt, kund, byran)));
  } catch (err) {
    return { transaktionId: t.id, konteringar: [], fel: err instanceof Error ? err.message : String(err) };
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
  const k1 = slaUppKonto(konto);
  if (!k1) throw new Error(`${konto} finns inte bland K1-kontona`);
  const motkonto = motkontoOverride ?? betalkonto(betalsatt, t.riktning);
  if (!motkonto) throw new Error('Betalkonto saknas');
  if (!t.datum) throw new Error('Transaktionen saknar datum');

  const uppdelad = rensaMomsdelar(momsdelar);
  for (const d of uppdelad ?? []) {
    if (d.konto && !slaUppKonto(d.konto)) throw new Error(`${d.konto} finns inte bland K1-kontona`);
  }
  const delar: Momsdel[] = uppdelad ?? [{ konto, momssats, belopp: Number(t.belopp), moms: null }];
  const { delar: bokdelar } = raknaMoms(t, delar, momssats || uppdelad ? 'svensk' : 'ingen', konto);
  const rader = byggRader(t, bokdelar, motkonto);

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
