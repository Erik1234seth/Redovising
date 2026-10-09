import { buildImageParts } from '@/lib/underlag/fil-delar';
import { arBildEllerPdf, arTabellfil, kanLasasAvAi } from '@/lib/underlag/filtyp';
import {
  DETALJREGEL, GRUPPERINGSREGEL, MEJLREGEL, tolkaSvar,
  type ExtraheradTransaktion, type ExtraheradVerifikation, type TolkatSvar,
} from './normalisera';
import { lasMedSandlada } from './sandlada';

export { kanLasasAvAi };
export type { ExtraheradTransaktion, ExtraheradVerifikation };

/**
 * Läser av ett underlag med hjälp av en AI.
 *
 * Först avgör AI:n vad underlaget är:
 *
 * - Ett kvitto, en faktura eller ett kontoutdrag ger transaktioner. Det är
 *   steget före konteringen: AI:n skriver bara av det som står, utan konton.
 *   Konteringen görs senare och blir då en verifikation.
 * - Ett underlag som redan är bokfört — en verifikationslista, grundbok eller
 *   huvudbok — har konteringen i sig. Då skrivs verifikationerna av med sina
 *   konton, i stället för att kontona kastas bort och jobbet görs om.
 *
 * Två vägar, efter vad filen är:
 *
 * - Bilder och PDF går hit, som de är, i ett enda anrop. De ska ses, inte
 *   tolkas som text, och en uppdelad fil ger uppdelade svar med rader som
 *   tappas i skarvarna.
 * - Kalkylblad och textlistor går till sandlådan (se `sandlada.ts`), där
 *   filen läses med pandas i stället för att skrivas av.
 * - En PDF som visar sig vara verifikationer läses om i sandlådan, som
 *   grupperar raderna med kod. Synen klarar inte att samla ihop ett kvitto
 *   vars rader ligger på tio olika sidor.
 *
 * SIE-filer går ingen av vägarna. De tolkas med kod i `@/lib/sie/parse`.
 */

const MODELL = 'gpt-5.5';

// Taket för ett svar hos gpt-5.5. Filen delas inte upp, så hela avskriften
// ska få plats i ett svar — och modellens eget tänkande ryms i samma budget.
const MAX_TOKENS = 100000;

const SYSTEM_PROMPT = `Du läser av underlag åt en svensk bokföringsbyrå, som bild eller PDF.

Börja med att avgöra vilken sorts underlag det är:

- "transaktioner": ett kvitto, en faktura eller ett kontoutdrag. Det är det vanliga. Underlaget säger vad som köpts, sålts eller betalats, men inte hur det bokförts.
- "verifikationer": ett underlag som REDAN är bokfört — en verifikationslista, grundbok, dagbok eller huvudbok ur ett bokföringsprogram. Kännetecknet är att raderna har kontonummer (t.ex. 1930, 2641, 3001) med belopp i debet eller kredit.

Välj "verifikationer" bara när kontonumren faktiskt står i underlaget. Hitta aldrig på konton själv.

Returnera ett JSON-objekt:
{
  "typ": "transaktioner" eller "verifikationer",
  "transaktioner": [...],
  "verifikationer": [...]
}
Fyll bara listan som hör till typen. Den andra är tom.

Varje transaktion har exakt dessa fält:
{
  "datum": "YYYY-MM-DD" (tom sträng om datumet inte framgår),
  "beskrivning": "det som står på raden — butik, text, fakturanummer",
  "motpart": "säljare, leverantör eller kund om det framgår, annars tom sträng",
  "belopp": number (positivt tal, totalbelopp inklusive moms),
  "moms": number (momsbeloppet, 0 om det inte framgår),
  "valuta": "SEK" eller valutan som står på underlaget,
  "riktning": "in" (pengar in till företaget) eller "ut" (pengar ut från företaget),
  "anteckning": "kort notering när något är oläsligt eller osäkert, annars tom sträng",
  "detaljer": "allt annat som står om transaktionen på underlaget, se nedan"
}

Varje verifikation har exakt dessa fält:
{
  "serie": "verifikationsserien, t.ex. A — tom sträng om den inte framgår",
  "nummer": "verifikationsnumret som det står, tom sträng om det inte framgår",
  "datum": "YYYY-MM-DD",
  "text": "verifikationstexten",
  "rader": [
    { "konto": "kontonumret", "kontonamn": "kontots namn om det står, annars tom sträng", "debet": number, "kredit": number, "text": "radens egen text, annars tom sträng" }
  ]
}

Regler för transaktioner:
- VIKTIGAST: varje transaktionsrad i underlaget ska ge exakt en transaktion i svaret. Gå igenom hela underlaget, sida för sida, uppifrån och ner. Slå aldrig ihop rader, hoppa aldrig över rader och korta aldrig ner listan — även om den är lång och raderna liknar varandra.
- Du ska INTE kontera: inga konton, ingen bedömning av vad affärshändelsen betyder bokföringsmässigt. Det görs i ett senare steg.
- Ett kvitto eller en faktura är oftast EN transaktion: totalbeloppet. Artikelraderna på kvittot är inte egna transaktioner. Flera transaktioner blir det bara när underlaget är en lista med flera betalningar eller köp.
- Ett negativt belopp i underlaget betyder "ut", ett positivt betyder "in". Fältet "belopp" är alltid ett positivt tal.
- En kolumn med löpande saldo eller balans är INTE transaktionens belopp — använd beloppskolumnen.
- Skippa rader som är rubriker, adresser, summor, saldobesked eller tomma.
${DETALJREGEL}
- Framgår inte datumet lämnar du fältet tomt i stället för att gissa, och skriver varför i "anteckning".
${MEJLREGEL}

Regler för verifikationer:
- Ta med VARJE verifikation i underlaget, och varje konteringsrad i den. Korta aldrig ner.
- Skriv av konton och belopp exakt som de står. Debet och kredit är positiva tal i var sin kolumn; den kolumn som är tom blir 0.
- En huvudbok är ordnad per konto, inte per verifikation. Samla raderna med samma verifikationsnummer från alla konton till en verifikation.
${GRUPPERINGSREGEL}
- Ingående och utgående saldon, kontosummor och periodsummor är inte verifikationer — hoppa över dem.
- En verifikation ska gå jämnt ut: summa debet = summa kredit. Gör den inte det har du läst fel — läs om den.

Innehåller underlaget ingenting av detta returnerar du typ "transaktioner" med två tomma listor.
Returnera BARA JSON, ingen annan text.`;

export interface ExtraktionsResultat extends TolkatSvar {
  modell: string;
  /** Sandlådans rad om vad den läste. Tom för bilder och PDF. */
  notering: string;
}

/** Hela PDF:en i ett anrop — modellen skannar sidorna själv. */
function pdfDel(buffer: Buffer, fileName: string): unknown[] {
  return [
    { type: 'file', file: { filename: fileName, file_data: `data:application/pdf;base64,${buffer.toString('base64')}` } },
    { type: 'text', text: `Underlag: ${fileName}. Läs av varje rad, sida för sida, uppifrån och ner. Ta med allt.` },
  ];
}

async function las(content: unknown, apiKey: string, fileName: string): Promise<TolkatSvar> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODELL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      max_completion_tokens: MAX_TOKENS,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    console.error('[transaktioner] OpenAI-fel:', text);
    throw new Error('AI-tjänsten svarade inte');
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  if (choice?.message?.refusal) throw new Error(`AI:n kunde inte läsa ${fileName}`);
  if (choice?.finish_reason === 'length') {
    // Ett kapat svar är halv JSON — ingenting går att rädda ur det
    throw new Error(`Svaret för ${fileName} kapades: underlaget innehåller mer än som får plats i ett svar`);
  }

  const raw = (choice?.message?.content ?? '').trim();
  if (!raw) return tolkaSvar({});

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI:n svarade inte med JSON');
    parsed = JSON.parse(match[0]);
  }
  return tolkaSvar(parsed);
}

/** Det som står om filen i kundens mejl, som en del efter själva underlaget. */
function mejlDel(file: { lagradSom?: string; mejl?: string }): unknown[] {
  if (!file.mejl) return [];
  return [{
    type: 'text',
    text: `Filen är lagrad som ${file.lagradSom ?? '(okänt)'}.\n\n${file.mejl}`,
  }];
}

export async function extraheraTransaktioner(file: {
  buffer: Buffer;
  fileName: string;
  mimeType: string | null;
  /** Filens namn i lagringen — samma som bilagan heter i mejlen. */
  lagradSom?: string;
  /** Kundens mejlväxling (se `@/lib/mejlkontext`), när den finns. */
  mejl?: string;
}): Promise<ExtraktionsResultat> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY saknas');

  if (arTabellfil(file.fileName, file.mimeType)) {
    return lasMedSandlada(file);
  }

  if (!arBildEllerPdf(file.fileName, file.mimeType)) {
    throw new Error(`${file.fileName} är inte en filtyp vi kan läsa av`);
  }

  const arPdf = file.fileName.toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf';
  const del = arPdf
    ? pdfDel(file.buffer, file.fileName)
    : buildImageParts(file.buffer, file.mimeType ?? '', file.fileName)[0] as unknown[];

  const svar = await las([...del, ...mejlDel(file)], apiKey, file.fileName);

  // En PDF med verifikationer är en export ur ett system och har text. Ordnad
  // per konto ligger ett kvittos rader utspridda över många sidor, och synen
  // tar då genvägen via sammanställningen på första sidan. Sandlådan läser
  // texten med kod och grupperar på kvitto — den får göra om läsningen.
  if (arPdf && svar.typ === 'verifikationer') {
    let orsak: string;
    try {
      const omlast = await lasMedSandlada(file);
      if (omlast.typ === 'verifikationer' && omlast.verifikationer.length > 0) return omlast;
      orsak = 'den hittade inga verifikationer';
    } catch (err) {
      // Inskannad PDF eller annat fel i sandlådan — då gäller synens svar
      console.error('[transaktioner] sandlådan kunde inte läsa PDF:en:', err);
      orsak = err instanceof Error ? err.message : 'okänt fel';
    }
    svar.varningar.push(
      `Sandlådan kunde inte läsa om PDF:en (${orsak}). Synens läsning användes — kontrollera att alla sidor kom med`,
    );
  }

  return { ...svar, modell: MODELL, notering: '' };
}
