import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

const SYSTEM_PROMPT = `Du är expert på svensk bokföring. Du får ett underlag — en PDF med sidor, en bild eller en textlista. Läs av ALLA transaktionsrader och returnera ett JSON-objekt med nyckeln "transactions" som innehåller en array. Varje transaktion ska ha exakt dessa fält:
{
  "datum": "YYYY-MM-DD",
  "beskrivning": "kort beskrivning av transaktionen",
  "belopp": number (positivt tal, totalt inkl moms),
  "moms": number (momsbelopp, 0 om okänt eller saknas),
  "haendelse_typ": "kund-betalat" eller "kopt-nagot",
  "debit_konto": "kontonummer",
  "debit_namn": "kontonamn",
  "kredit_konto": "kontonummer",
  "kredit_namn": "kontonamn"
}

Regler:
- VIKTIGAST: varje transaktionsrad i underlaget ska ge exakt en transaktion i svaret. Gå igenom sidan uppifrån och ner, rad för rad. Slå aldrig ihop rader, hoppa aldrig över rader och korta aldrig ner listan — även om den är lång och raderna liknar varandra.
- Ett negativt belopp i underlaget betyder utgift ("kopt-nagot"), ett positivt belopp betyder inkomst ("kund-betalat"). Fältet "belopp" ska alltid vara ett positivt tal.
- haendelse_typ "kund-betalat" = inkomst/försäljning (pengar IN till företaget)
- haendelse_typ "kopt-nagot" = utgift/inköp (pengar UT från företaget)
- En kolumn med löpande saldo/balans är INTE transaktionens belopp — använd beloppskolumnen
- Använd svenska BAS-konton. Vanliga: 1930 Företagskonto, 3001 Försäljning tjänster, 3002 Försäljning varor, 4000 Inköp varor, 5000 Lokalkostnader, 5400 Förbrukningsinventarier, 6000 Övriga rörelsekostnader
- För försäljning: debit 1930 / kredit 3001 eller 3002
- För inköp: debit relevant kostnadskonto / kredit 1930
- Om avgifter (t.ex. Zettle-provision): inkludera i beloppet och använd konto 6570 Bankkostnader för avgiften
- Skippa rader som är rubriker, adresser, summor, saldobesked eller tomma
- Returnera BARA JSON, ingen annan text`;

interface ParsedTransaction {
  datum: string;
  beskrivning: string;
  belopp: number;
  moms: number;
  haendelse_typ: string;
  debit_konto: string;
  debit_namn: string;
  kredit_konto: string;
  kredit_namn: string;
}

function isPdf(mimeType: string, fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';
}

function isImage(mimeType: string, fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg'].includes(ext) || mimeType === 'image/png' || mimeType === 'image/jpeg';
}

function imageMimeType(mimeType: string, fileName: string): string {
  if (mimeType === 'image/png' || mimeType === 'image/jpeg') return mimeType;
  return fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

// Vissa banker (t.ex. Handelsbanken) exporterar xlsx-filer där storleken står
// efter varje fil i zip-arkivet i stället för före. XLSX klarar inte det, så
// arkivet packas om till ett vanligt zip först.
async function repackXlsx(buffer: Buffer): Promise<Buffer> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Kalkylblad och CSV har inga sidor att titta på — de görs om till text
// och lämnas till samma AI.
async function spreadsheetToText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv' || mimeType === 'text/csv' || mimeType === 'text/plain') {
    return buffer.toString('utf-8');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    workbook = XLSX.read(await repackXlsx(buffer), { type: 'buffer', cellDates: true });
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

// Hur mycket varje AI-anrop får. Hela listan i ett enda anrop gör att
// modellen tappar rader eller slår i taket för svarslängd.
const ROWS_PER_CALL = 40;
const PAGES_PER_CALL = 3;
const MAX_PARALLEL_CALLS = 4;
const MAX_HEADER_ROWS = 25;

// Rubrik- och kontoinformation längst upp behövs för att tolka kolumnerna,
// så den skickas med i varje del.
function splitHeaderAndBody(rows: string[]): { header: string[]; body: string[] } {
  const columnHeader = rows.findIndex(
    (r) => /datum|date/i.test(r) && /(belopp|summa|amount|text|titel|beskrivning|transaktion)/i.test(r)
  );
  if (columnHeader >= 0 && columnHeader < MAX_HEADER_ROWS) {
    return { header: rows.slice(0, columnHeader + 1), body: rows.slice(columnHeader + 1) };
  }

  // Ingen tydlig kolumnrubrik — börja vid första raden som ser ut som en
  // transaktion (datum följt av ett belopp)
  const firstData = rows.findIndex(
    (r) => /^\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(r) && /\d[\d\s.,]*\d/.test(r.slice(10))
  );
  const cut = firstData > 0 && firstData < MAX_HEADER_ROWS ? firstData : 0;
  return { header: rows.slice(0, cut), body: rows.slice(cut) };
}

function buildTextParts(text: string): unknown[] {
  const rows = text.split('\n').filter((r) => r.trim() !== '');
  const chunks: string[] = [];

  if (rows.length <= ROWS_PER_CALL) {
    chunks.push(rows.join('\n'));
  } else {
    const { header, body } = splitHeaderAndBody(rows);
    for (let i = 0; i < body.length; i += ROWS_PER_CALL) {
      chunks.push([...header, ...body.slice(i, i + ROWS_PER_CALL)].join('\n'));
    }
  }

  return chunks.map((chunk) => `Analysera dessa transaktioner:\n\n${chunk}`);
}

// PDF:en skickas till AI:n som PDF — den skannar sidorna själv, precis som
// när man laddar upp filen i ett chattfönster. Långa underlag delas upp i
// mindre PDF:er så att inga rader tappas på vägen.
async function buildPdfParts(buffer: Buffer, fileName: string): Promise<unknown[]> {
  const { PDFDocument } = await import('pdf-lib');
  const source = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  const pageCount = source.getPageCount();

  function part(data: Buffer, name: string, label: string): unknown[] {
    return [
      { type: 'file', file: { filename: name, file_data: `data:application/pdf;base64,${data.toString('base64')}` } },
      { type: 'text', text: `${label} Läs av varje transaktionsrad i tabellen, uppifrån och ner. Ta med alla rader.` },
    ];
  }

  if (pageCount <= PAGES_PER_CALL) {
    return [part(buffer, fileName, `Underlag: ${fileName}.`)];
  }

  const parts: unknown[] = [];
  for (let start = 0; start < pageCount; start += PAGES_PER_CALL) {
    const indices = Array.from(
      { length: Math.min(PAGES_PER_CALL, pageCount - start) },
      (_, n) => start + n
    );

    const slice = await PDFDocument.create();
    const copied = await slice.copyPages(source, indices);
    copied.forEach((p) => slice.addPage(p));
    const bytes = Buffer.from(await slice.save());

    parts.push(
      part(
        bytes,
        `sida-${start + 1}-${start + indices.length}.pdf`,
        `Detta är sida ${start + 1}–${start + indices.length} av ${pageCount} ur ${fileName}.`
      )
    );
  }

  return parts;
}

type PartResult =
  | { ok: true; transactions: ParsedTransaction[] }
  | { ok: false; status: number; error: string };

async function analyzeContent(userContent: unknown, apiKey: string, fileName: string): Promise<PartResult> {
  const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_completion_tokens: 16000,
    }),
  });

  if (!openAIResponse.ok) {
    const errText = await openAIResponse.text();
    console.error('OpenAI API error:', errText);
    return { ok: false, status: 502, error: 'Fel vid kontakt med AI-tjänsten' };
  }

  const openAIData = await openAIResponse.json();
  const choice = openAIData.choices?.[0];
  const finishReason = choice?.finish_reason;
  const rawContent = (choice?.message?.content ?? '').trim();

  if (choice?.message?.refusal) {
    console.error('OpenAI refusal:', choice.message.refusal);
    return {
      ok: false,
      status: 422,
      error: `AI:n kunde inte läsa ${fileName}. Kontrollera att filen innehåller en transaktionslista.`,
    };
  }

  if (finishReason === 'length') {
    return {
      ok: false,
      status: 413,
      error: `${fileName} innehåller för många transaktioner för att läsas i en omgång. Dela upp filen och försök igen.`,
    };
  }

  // Tomt svar = AI:n hittade inget i den här delen, inte ett fel
  if (!rawContent) return { ok: true, transactions: [] };

  let parsed: { transactions?: ParsedTransaction[] };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\{[\s\S]*\}/);
    try {
      if (!match) throw new Error('no json object in response');
      parsed = JSON.parse(match[0]);
    } catch {
      console.error(`Could not parse OpenAI response (finish_reason: ${finishReason}):`, rawContent);
      return { ok: false, status: 500, error: `Kunde inte tolka AI-svaret för ${fileName}.` };
    }
  }

  const transactions: ParsedTransaction[] = (parsed.transactions ?? []).map((t) => ({
    datum: t.datum ?? '',
    beskrivning: t.beskrivning ?? '',
    belopp: Math.abs(Number(t.belopp) || 0),
    moms: Number(t.moms) || 0,
    haendelse_typ: t.haendelse_typ === 'kopt-nagot' ? 'kopt-nagot' : 'kund-betalat',
    debit_konto: t.debit_konto ?? '1930',
    debit_namn: t.debit_namn ?? 'Okänt konto',
    kredit_konto: t.kredit_konto ?? '3001',
    kredit_namn: t.kredit_namn ?? 'Okänt konto',
  }));

  return { ok: true, transactions };
}

// Delarna körs parallellt men några i taget, så ett stort underlag inte
// skickar tjugo anrop samtidigt.
async function analyzeAllParts(parts: unknown[], apiKey: string, fileName: string): Promise<PartResult[]> {
  const results: PartResult[] = [];
  for (let i = 0; i < parts.length; i += MAX_PARALLEL_CALLS) {
    const batch = parts.slice(i, i + MAX_PARALLEL_CALLS);
    results.push(...(await Promise.all(batch.map((part) => analyzeContent(part, apiKey, fileName)))));
  }
  return results;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil bifogad' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API-nyckel saknas' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parts: unknown[];

    if (isPdf(file.type, file.name)) {
      try {
        parts = await buildPdfParts(buffer, file.name);
      } catch (err) {
        console.error('Could not split PDF:', err);
        return NextResponse.json(
          { error: `Kunde inte läsa ${file.name}. Kontrollera att det är en giltig PDF.` },
          { status: 400 }
        );
      }
    } else if (isImage(file.type, file.name)) {
      const mimeType = imageMimeType(file.type, file.name);
      parts = [
        [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` } },
          { type: 'text', text: 'Läs av varje transaktionsrad på bilden, uppifrån och ner. Ta med alla rader.' },
        ],
      ];
    } else {
      let text: string;
      try {
        text = await spreadsheetToText(buffer, file.type, file.name);
      } catch {
        return NextResponse.json(
          { error: 'Kunde inte läsa filen. Kontrollera att det är en giltig CSV-, Excel-, PDF- eller bildfil.' },
          { status: 400 }
        );
      }

      if (!text.trim()) {
        return NextResponse.json({ error: `Vi hittade inget innehåll i ${file.name}.` }, { status: 422 });
      }

      parts = buildTextParts(text);
    }

    const results = await analyzeAllParts(parts, apiKey, file.name);

    // En del som fallerar ska inte ge en tyst halv lista — bokföringen måste bli komplett
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      return NextResponse.json({ error: failed.error }, { status: failed.status });
    }

    const transactions = results.flatMap((r) => (r.ok ? r.transactions : []));
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error in /api/bokforing/analyze-transactions:', error);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
