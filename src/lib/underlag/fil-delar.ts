import * as XLSX from 'xlsx';

/**
 * Gör ett underlag till delar som en AI kan läsa.
 *
 * Underlagen ser ut hur som helst: ett fotograferat kvitto, en faktura som
 * PDF, ett kontoutdrag på tjugo sidor eller en Excel-export från banken.
 * Bilder och PDF:er skickas som de är — modellen tittar på sidan, precis som
 * när man släpper filen i ett chattfönster. Kalkylblad har inga sidor att se
 * på och görs om till text.
 *
 * Långa underlag delas upp. Hela listan i ett enda anrop gör att modellen
 * tappar rader eller slår i taket för svarslängden, och då blir bokföringen
 * ofullständig utan att någon märker det.
 */

// Hur mycket varje AI-anrop får
export const ROWS_PER_CALL = 40;
export const PAGES_PER_CALL = 3;
const MAX_HEADER_ROWS = 25;

export function isPdf(mimeType: string, fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';
}

export function isImage(mimeType: string, fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg'].includes(ext) || mimeType === 'image/png' || mimeType === 'image/jpeg';
}

export function imageMimeType(mimeType: string, fileName: string): string {
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
export async function spreadsheetToText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
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

export function buildTextParts(text: string, instruktion = 'Analysera dessa transaktioner:'): unknown[] {
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

  return chunks.map((chunk) => `${instruktion}\n\n${chunk}`);
}

const PDF_INSTRUKTION = 'Läs av varje transaktionsrad i tabellen, uppifrån och ner. Ta med alla rader.';

// PDF:en skickas till AI:n som PDF — den skannar sidorna själv. Långa underlag
// delas upp i mindre PDF:er så att inga rader tappas på vägen.
export async function buildPdfParts(
  buffer: Buffer,
  fileName: string,
  instruktion = PDF_INSTRUKTION,
): Promise<unknown[]> {
  const { PDFDocument } = await import('pdf-lib');
  const source = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  const pageCount = source.getPageCount();

  function part(data: Buffer, name: string, label: string): unknown[] {
    return [
      { type: 'file', file: { filename: name, file_data: `data:application/pdf;base64,${data.toString('base64')}` } },
      { type: 'text', text: `${label} ${instruktion}` },
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

/** En bild är alltid en del — modellen ser hela kvittot på en gång. */
export function buildImageParts(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  instruktion = 'Läs av varje transaktionsrad på bilden, uppifrån och ner. Ta med alla rader.',
): unknown[] {
  return [
    [
      { type: 'image_url', image_url: { url: `data:${imageMimeType(mimeType, fileName)};base64,${buffer.toString('base64')}` } },
      { type: 'text', text: instruktion },
    ],
  ];
}
