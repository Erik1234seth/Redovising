/**
 * Själva analysen i testmiljön — delad av både CLI:t (run.mjs) och
 * webbsidan (/ai-test via /api/ai-test/analyze).
 *
 * Speglar vad de riktiga rutterna gör:
 *   kvitto        -> src/app/api/bokforing/analyze-receipt/route.ts
 *   transaktioner -> src/app/api/bokforing/analyze-transactions/route.ts
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as XLSX from 'xlsx';

export const MAX_RADER = 200; // samma gräns som analyze-transactions använder

export const KVITTO_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
export const TABELL_EXT = ['.csv', '.xlsx', '.xls', '.txt'];

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Läser en grannmodul på nytt varje gång, så att ändringar i filen slår igenom
 * direkt utan omstart av dev-servern. (Node cachar annars ESM-moduler för
 * processens livstid, och dev-servern lever länge.)
 */
function laddaFarskt(filnamn) {
  const file = pathToFileURL(path.join(HERE, filnamn));
  return import(`${file.href}?t=${Date.now()}`);
}

export async function loadPrompts() {
  return laddaFarskt('prompts.mjs');
}

export function gissaTyp(ext) {
  if (TABELL_EXT.includes(ext)) return 'transaktioner';
  if (KVITTO_EXT.includes(ext)) return 'kvitto';
  return null;
}

// ---------- filinläsning ----------

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  return pdfjsLib;
}

export async function extractPdfText(buffer) {
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str ?? '').join(' ') + '\n';
  }
  return text.trim();
}

async function pdfPageToBase64(buffer) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toBuffer('image/png').toString('base64');
}

function tabellTillCsv(buffer, ext) {
  if (ext === '.csv' || ext === '.txt') return buffer.toString('utf-8');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(sheet);
}

function truncateRows(text, maxRows = MAX_RADER) {
  const rows = text.split('\n');
  if (rows.length <= maxRows + 1) return text;
  return rows.slice(0, maxRows + 1).join('\n') + `\n... (${rows.length - maxRows - 1} rader borttagna)`;
}

function mimeFromExt(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.pdf') return 'application/pdf';
  return 'image/jpeg';
}

// ---------- OpenAI ----------

/**
 * @param {number} [o.temperatur] sätts bara när den anges. Produktionen kör med
 *   modellens standardvärde, men mätningar behöver 0 — annars är skillnaden
 *   mellan två körningar brus snarare än en effekt av det man ändrat.
 */
export async function callOpenAI({ apiKey, modell, systemPrompt, userContent, temperatur, försök = 4 }) {
  let res;
  let sistaFelet = '';

  for (let n = 1; n <= försök; n++) {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modell,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_completion_tokens: 16000,
        ...(temperatur === undefined ? {} : { temperature: temperatur }),
      }),
    });

    if (res.ok) break;

    sistaFelet = (await res.text()).slice(0, 300);
    // Takgräns och tillfälliga serverfel går över av sig själva. OpenAI anger
    // ofta hur länge man ska vänta ("try again in 10.6s") — följ det.
    const gårÖver = res.status === 429 || res.status >= 500;
    if (!gårÖver || n === försök) {
      throw new Error(`OpenAI ${res.status}: ${sistaFelet}`);
    }

    const föreslagen = Number(sistaFelet.match(/try again in ([\d.]+)s/i)?.[1]);
    const vänta = Number.isFinite(föreslagen) ? föreslagen * 1000 + 500 : 2000 * 2 ** (n - 1);
    await new Promise((r) => setTimeout(r, vänta));
  }

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${sistaFelet}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Kunde inte tolka AI-svaret:\n${raw.slice(0, 300)}`);
    parsed = JSON.parse(match[0]);
  }

  return { parsed, usage: data.usage ?? null };
}

// ---------- analyser ----------

/**
 * Tolkningen av ett kvitto eller en faktura.
 *
 * Basdokumenten söks medvetet INTE här. Steget svarar bara på vad som står på
 * papperet — vad, datum, belopp, moms, land, utfärdare — och kontovalet görs
 * först i tvapass.mjs. Mätt på sex svårlästa underlag gav sökningen exakt
 * samma 25 av 25 rätta fält som utan, till 36 215 tokens i stället för 4 965.
 * Reglerna hämtas i stället per rad i konteringssteget, där de används.
 */
async function analyseraKvitto({ buffer, ext, filnamn, haendelse, modell, prompt, apiKey, prompts, temperatur, egetNamn }) {
  const userMessage = prompts.kvittoUserMessage(haendelse);
  let userContent;
  let kalla;

  if (ext === '.pdf') {
    const text = await extractPdfText(buffer);
    if (text.length > 50) {
      kalla = 'pdf-text';
      userContent = `${userMessage}\n\nInnehåll från PDF:\n${text}`;
    } else {
      kalla = 'pdf-bild (skannad)';
      const imageBase64 = await pdfPageToBase64(buffer);
      userContent = [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ];
    }
  } else {
    kalla = 'bild';
    userContent = [
      { type: 'text', text: userMessage },
      { type: 'image_url', image_url: { url: `data:${mimeFromExt(ext)};base64,${buffer.toString('base64')}` } },
    ];
  }

  const { parsed, usage } = await callOpenAI({ apiKey, modell, systemPrompt: prompt, userContent, temperatur });

  // Vid 'auto' är det modellen som avgjort riktningen. Svaret ska säga vad den
  // landade på, inte att frågan var öppen — resten av flödet vill ha ett besked.
  let avgjord =
    haendelse === 'auto'
      ? parsed.haendelse_typ === 'kund-betalat'
        ? 'kund-betalat'
        : 'kopt-nagot'
      : haendelse;

  if (haendelse === 'auto') {
    const enligtNamn = riktningFranAvsandare(parsed.avsandare, egetNamn);
    if (enligtNamn && enligtNamn !== avgjord) {
      avgjord = enligtNamn;
      parsed.haendelse_typ = enligtNamn;
    }
  }

  return { typ: 'kvitto', modell, kalla, haendelse: avgjord, resultat: parsed, usage, basdokument: [] };
}

/** Skalar bort bolagsform och skiljetecken så två stavningar går att jämföra. */
function normaliseraNamn(v) {
  return String(v ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\b(ab|hb|kb|ekonomisk förening|ek för|enskild firma|firma)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Är underlaget utfärdat av företaget självt är det en försäljning — oavsett
 * vad modellen gissade. Namnet som står på papperet är ett hårdare besked än
 * en gissning, så koden får avgöra när den kan.
 *
 * Returnerar null när namnen inte går att jämföra, och då står modellens svar
 * kvar. Kravet på fem tecken finns för att korta namn ("Kisa") annars råkar
 * matcha en leverantör som bara delar ett ord.
 */
export function riktningFranAvsandare(avsandare, egetNamn = []) {
  const a = normaliseraNamn(avsandare);
  if (a.length < 5) return null;

  for (const namn of egetNamn) {
    const e = normaliseraNamn(namn);
    if (e.length < 5) continue;
    if (a.includes(e) || e.includes(a)) return 'kund-betalat';
  }
  return null;
}

async function analyseraTransaktioner({ buffer, ext, filnamn, modell, prompt, basdokument, apiKey, temperatur }) {
  const csvText = ext === '.pdf' ? await extractPdfText(buffer) : tabellTillCsv(buffer, ext);
  const antalRader = csvText.split('\n').length;
  const truncated = truncateRows(csvText);

  const { systemPrompt, traffar } = await medBasdokument({
    prompt,
    basdokument,
    apiKey,
    filnamn,
    text: csvText,
  });

  const { parsed, usage } = await callOpenAI({
    apiKey,
    modell,
    systemPrompt,
    userContent: `Analysera dessa transaktioner:\n\n${truncated}`,
    temperatur,
  });

  const transactions = (parsed.transactions ?? []).map((t) => ({
    datum: t.datum ?? '',
    beskrivning: t.beskrivning ?? '',
    belopp: Number(t.belopp) || 0,
    moms: Number(t.moms) || 0,
    haendelse_typ: t.haendelse_typ === 'kopt-nagot' ? 'kopt-nagot' : 'kund-betalat',
    debit_konto: t.debit_konto ?? '1930',
    debit_namn: t.debit_namn ?? 'Okänt konto',
    kredit_konto: t.kredit_konto ?? '3001',
    kredit_namn: t.kredit_namn ?? 'Okänt konto',
    // Fälten nedan finns bara i tvåpassläget; de får inte tappas här, för det
    // är radnr som håller ihop svaret med rätt rad i underlaget.
    ...(t.radnr === undefined ? {} : { radnr: Number(t.radnr) }),
    ...(t.sakerhet === undefined ? {} : { sakerhet: t.sakerhet }),
    ...(t.motivering === undefined ? {} : { motivering: t.motivering }),
  }));

  return {
    typ: 'transaktioner',
    modell,
    kalla: `${antalRader} rader i filen${antalRader > MAX_RADER ? `, ${MAX_RADER} skickade till AI:n` : ''}`,
    resultat: { transactions },
    usage,
    basdokument: traffar,
  };
}

/**
 * Söker fram relevanta utdrag ur basdokumenten och lägger dem sist i
 * systemprompten. Faller tillbaka på prompten som den är om sökningen är
 * avstängd eller inte ger något.
 */
async function medBasdokument({ prompt, basdokument, apiKey, filnamn, text }) {
  if (!basdokument) return { systemPrompt: prompt, traffar: [] };

  const { sokBasdokument, byggBasdokumentBlock, byggSokfraga } = await laddaFarskt('basdokument.mjs');

  const traffar = await sokBasdokument({
    fraga: byggSokfraga({ filnamn, text }),
    apiKey,
  });

  const block = byggBasdokumentBlock(traffar);
  return {
    systemPrompt: block ? `${prompt}\n\n${block}` : prompt,
    traffar,
  };
}

/**
 * Kör analysen på en fil.
 *
 * @param {object} o
 * @param {Buffer} o.buffer      filens innehåll
 * @param {string} o.filnamn     används för att gissa typ
 * @param {string} [o.typ]       'kvitto' | 'transaktioner' — annars gissas den
 * @param {string} [o.haendelse] 'kopt-nagot' | 'kund-betalat' | 'auto' (kvitton)
 * @param {string} [o.modell]    annars standardmodellen för typen
 * @param {string} [o.prompt]    annars prompten från prompts.mjs
 * @param {string} [o.kundkontext] verksamhetsbeskrivning m.m. som läggs till i systemprompten
 * @param {string[]} [o.egetNamn] företagets egna namn — avgör riktningen vid haendelse 'auto'
 * @param {string} o.apiKey      OpenAI-nyckel
 */
export async function analyseraFil({
  buffer,
  filnamn,
  typ,
  haendelse = 'kopt-nagot',
  modell,
  prompt,
  kundkontext,
  basdokument = false,
  temperatur,
  egetNamn,
  apiKey,
}) {
  const prompts = await loadPrompts();
  const ext = path.extname(filnamn).toLowerCase();
  const valdTyp = typ ?? gissaTyp(ext);

  if (!valdTyp) {
    throw new Error(`Vet inte hur ${ext || 'filen'} ska analyseras — välj typ manuellt.`);
  }

  const valdModell = modell || prompts.MODELLER[valdTyp];
  const standardPrompt =
    valdTyp !== 'kvitto'
      ? prompts.TRANSAKTIONER_PROMPT
      : haendelse === 'auto'
        ? prompts.KVITTO_PROMPT_AUTO
        : prompts.KVITTO_PROMPT;
  const basPrompt = prompt || standardPrompt;
  // Kundens verksamhet läggs sist i systemprompten, efter reglerna
  const valdPrompt = kundkontext ? `${basPrompt}\n\n${kundkontext}` : basPrompt;
  const start = Date.now();

  const gemensamt = { buffer, ext, filnamn, modell: valdModell, prompt: valdPrompt, basdokument, temperatur, apiKey };
  const svar =
    valdTyp === 'kvitto'
      ? await analyseraKvitto({ ...gemensamt, haendelse, prompts, egetNamn })
      : await analyseraTransaktioner(gemensamt);

  return {
    ...svar,
    filnamn,
    kundkontext: kundkontext || null,
    sekunder: Number(((Date.now() - start) / 1000).toFixed(1)),
  };
}
