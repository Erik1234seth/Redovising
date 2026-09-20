import { buildImageParts } from '@/lib/underlag/fil-delar';
import { arBildEllerPdf, arTabellfil, kanLasasAvAi } from '@/lib/underlag/filtyp';
import { normaliseraRader, type ExtraheradTransaktion } from './normalisera';
import { lasMedSandlada } from './sandlada';

export { kanLasasAvAi };
export type { ExtraheradTransaktion };

/**
 * Läser ut transaktionerna ur ett underlag med hjälp av en AI.
 *
 * Det här är steget före konteringen: AI:n skriver bara av det som står på
 * kvittot, fakturan eller kontoutdraget. Inga konton, inga gissningar om vad
 * affärshändelsen betyder — det avgörs senare, och blir då en verifikation.
 *
 * Två vägar, efter vad filen är:
 *
 * - Bilder och PDF går hit, som de är, i ett enda anrop. De ska ses, inte
 *   tolkas som text, och en uppdelad fil ger uppdelade svar med rader som
 *   tappas i skarvarna.
 * - Kalkylblad och textlistor går till sandlådan (se `sandlada.ts`), där
 *   filen läses med pandas i stället för att skrivas av.
 *
 * SIE-filer går ingen av vägarna. De är redan bokförda och tolkas med kod i
 * `@/lib/sie/parse`.
 */

const MODELL = 'gpt-5.5';

// Taket för ett svar hos gpt-5.5. Filen delas inte upp, så hela avskriften
// ska få plats i ett svar — och modellens eget tänkande ryms i samma budget.
const MAX_TOKENS = 100000;

const SYSTEM_PROMPT = `Du läser av underlag åt en svensk bokföringsbyrå. Underlaget är ett kvitto, en faktura eller ett kontoutdrag, som bild eller PDF.

Din uppgift är att skriva av transaktionerna. Du ska INTE kontera: inga konton, ingen bedömning av vad affärshändelsen betyder bokföringsmässigt. Det görs i ett senare steg.

Returnera ett JSON-objekt med nyckeln "transaktioner" som innehåller en array. Varje transaktion ska ha exakt dessa fält:
{
  "datum": "YYYY-MM-DD" (tom sträng om datumet inte framgår),
  "beskrivning": "det som står på raden — butik, text, fakturanummer",
  "motpart": "säljare, leverantör eller kund om det framgår, annars tom sträng",
  "belopp": number (positivt tal, totalbelopp inklusive moms),
  "moms": number (momsbeloppet, 0 om det inte framgår),
  "valuta": "SEK" eller valutan som står på underlaget,
  "riktning": "in" (pengar in till företaget) eller "ut" (pengar ut från företaget),
  "anteckning": "kort notering när något är oläsligt eller osäkert, annars tom sträng"
}

Regler:
- VIKTIGAST: varje transaktionsrad i underlaget ska ge exakt en transaktion i svaret. Gå igenom hela underlaget, sida för sida, uppifrån och ner. Slå aldrig ihop rader, hoppa aldrig över rader och korta aldrig ner listan — även om den är lång och raderna liknar varandra.
- Ett kvitto eller en faktura är oftast EN transaktion: totalbeloppet. Artikelraderna på kvittot är inte egna transaktioner. Flera transaktioner blir det bara när underlaget är en lista med flera betalningar eller köp.
- Ett negativt belopp i underlaget betyder "ut", ett positivt betyder "in". Fältet "belopp" är alltid ett positivt tal.
- En kolumn med löpande saldo eller balans är INTE transaktionens belopp — använd beloppskolumnen.
- Skippa rader som är rubriker, adresser, summor, saldobesked eller tomma.
- Skriv av det som står. Framgår inte datumet lämnar du fältet tomt i stället för att gissa, och skriver varför i "anteckning".
- Innehåller underlaget inga transaktioner alls returnerar du en tom array.
- Returnera BARA JSON, ingen annan text.`;

export interface ExtraktionsResultat {
  transaktioner: ExtraheradTransaktion[];
  modell: string;
  /** Sandlådans rad om vad den läste. Tom för bilder och PDF. */
  notering: string;
}

/** Hela PDF:en i ett anrop — modellen skannar sidorna själv. */
function pdfDel(buffer: Buffer, fileName: string): unknown[] {
  return [
    { type: 'file', file: { filename: fileName, file_data: `data:application/pdf;base64,${buffer.toString('base64')}` } },
    { type: 'text', text: `Underlag: ${fileName}. Läs av varje transaktionsrad, sida för sida, uppifrån och ner. Ta med alla rader.` },
  ];
}

async function las(content: unknown, apiKey: string, fileName: string): Promise<ExtraheradTransaktion[]> {
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
    throw new Error(`Svaret för ${fileName} kapades: underlaget innehåller fler transaktioner än som får plats i ett svar`);
  }

  const raw = (choice?.message?.content ?? '').trim();
  if (!raw) return [];

  let parsed: { transaktioner?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI:n svarade inte med JSON');
    parsed = JSON.parse(match[0]);
  }
  return normaliseraRader(parsed.transaktioner ?? []);
}

export async function extraheraTransaktioner(file: {
  buffer: Buffer;
  fileName: string;
  mimeType: string | null;
}): Promise<ExtraktionsResultat> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY saknas');

  if (arTabellfil(file.fileName, file.mimeType)) {
    return lasMedSandlada(file);
  }

  if (!arBildEllerPdf(file.fileName, file.mimeType)) {
    throw new Error(`${file.fileName} är inte en filtyp vi kan läsa av`);
  }

  const del = file.fileName.toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf'
    ? pdfDel(file.buffer, file.fileName)
    : buildImageParts(file.buffer, file.mimeType ?? '', file.fileName)[0];

  return { transaktioner: await las(del, apiKey, file.fileName), modell: MODELL, notering: '' };
}
