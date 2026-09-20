/**
 * Vad vi kan göra med en fil, avgjort på namnet och mimetypen.
 *
 * Ligger för sig utan beroenden, så att adminpanelen kan gråa ut en kryssruta
 * utan att dra in xlsx och pdf-lib i webbläsarpaketet.
 */

const BILD_EXT = ['png', 'jpg', 'jpeg'];
const PDF_EXT = ['pdf'];
/** Filer sandlådan kan öppna med pandas. Zip och Word säger vi nej till. */
const TABELL_EXT = ['csv', 'tsv', 'txt', 'xls', 'xlsx', 'xlsm'];
const SIE_EXT = ['se', 'si', 'sie'];

const extension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

/** Bilder och PDF går till synvägen — de ska ses, inte tolkas som text. */
export function arBildEllerPdf(fileName: string, mimeType: string | null): boolean {
  const ext = extension(fileName);
  if (BILD_EXT.includes(ext) || PDF_EXT.includes(ext)) return true;
  const mime = mimeType ?? '';
  return mime === 'application/pdf' || mime === 'image/png' || mime === 'image/jpeg';
}

/** Kalkylblad och textlistor går till sandlådan och läses med pandas. */
export function arTabellfil(fileName: string, mimeType: string | null): boolean {
  const ext = extension(fileName);
  if (SIE_EXT.includes(ext)) return false;
  if (TABELL_EXT.includes(ext)) return true;
  if (BILD_EXT.includes(ext) || PDF_EXT.includes(ext)) return false;

  const mime = mimeType ?? '';
  return mime === 'text/csv' || mime === 'text/plain'
    || mime.includes('spreadsheet') || mime.includes('excel');
}

/**
 * Filer vi kan läsa transaktioner ur: kvittobilder, PDF-fakturor, kontoutdrag
 * och kalkylblad. SIE-filer räknas inte — de är redan bokförda och tolkas med
 * kod till verifikationer.
 */
export function kanLasasAvAi(fileName: string, mimeType: string | null): boolean {
  return arBildEllerPdf(fileName, mimeType) || arTabellfil(fileName, mimeType);
}
