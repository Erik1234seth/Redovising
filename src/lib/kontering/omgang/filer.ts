import type { SupabaseClient } from '@supabase/supabase-js';
import { spreadsheetToText } from '@/lib/underlag/fil-delar';

/**
 * Filkontrollen före en omgång: varje underlag laddas ner och prövas innan
 * det skickas till OpenAI. Går en enda fil inte att läsa där misslyckas hela
 * anropet, och då blir alla kundens underlag i det utan kontering. Det som
 * inte klarar kontrollen skickas därför inte, och byrån får en varning.
 *
 *   bild      PNG, JPEG, WEBP, GIF — skickas som bild
 *   dokument  PDF och Word — skickas som fil, OpenAI läser texten (och PDF:ens sidor som bild)
 *   text      Excel, CSV, TSV, TXT — görs om till text här, som i dagens flöde
 *
 * Mejl (.eml), zip-arkiv och SIE-filer skickas inte och ger ingen varning:
 * mejlen spelar ingen roll, arkivets filer är redan egna underlag och SIE
 * tolkas med kod.
 */

const BUCKET = 'bokforing-underlag';
/** OpenAIs gräns per fil. */
export const MAX_FIL_BYTE = 50 * 1024 * 1024;
/** Kalkylblad som text: längre än så kortas, och modellen får veta det. */
const MAX_TEXTTECKEN = 150_000;

const BILD: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const DOKUMENT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
};
const TEXT = ['csv', 'tsv', 'txt', 'xls', 'xlsx', 'xlsm'];
const TYSTA = ['eml', 'zip', 'se', 'si', 'sie'];

export interface Underlagsrad {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  source: string | null;
  gmail_message_id: string | null;
}

export type Forberedd =
  | { typ: 'bild'; mime: string; bytes: Buffer }
  | { typ: 'dokument'; mime: string; bytes: Buffer; sidor: number | null }
  | { typ: 'text'; text: string };

export type Kontroll =
  | { ok: true; fil: Forberedd }
  /** tyst: filen ska inte med, men det är inget fel att säga till om. */
  | { ok: false; tyst: boolean; orsak: string };

const ext = (namn: string) => namn.split('.').pop()?.toLowerCase() ?? '';

/** Filtypen ur namnet, och ur mimetypen när namnet saknar ändelse. */
function filtyp(u: Underlagsrad): string {
  const e = ext(u.file_name);
  if (e && e !== u.file_name.toLowerCase()) return e;
  const mime = u.mime_type ?? '';
  const ur = Object.entries({ ...BILD, ...DOKUMENT }).find(([, m]) => m === mime)?.[0];
  if (ur) return ur;
  if (mime === 'text/csv') return 'csv';
  if (mime === 'message/rfc822') return 'eml';
  if (mime.includes('zip')) return 'zip';
  return e;
}

/** Bildens första byte stämmer med filtypen. Ett trasigt foto upptäcks här i stället för hos OpenAI. */
function arBild(bytes: Buffer, typ: string): boolean {
  if (typ === 'png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (typ === 'jpg' || typ === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (typ === 'webp') return bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP';
  if (typ === 'gif') return bytes.subarray(0, 3).toString('latin1') === 'GIF';
  return false;
}

/** En JPEG som egentligen är en PNG (eller tvärtom) är vanligt. Då gäller innehållet. */
function bildtypUrInnehall(bytes: Buffer): string | null {
  return Object.keys(BILD).find((t) => arBild(bytes, t)) ?? null;
}

async function pdfInfo(bytes: Buffer): Promise<{ sidor: number; krypterad: boolean }> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
  return { sidor: pdf.getPageCount(), krypterad: pdf.isEncrypted };
}

/** Så många sidor av en krypterad PDF görs om. Längre än så är sällan ett underlag. */
const KRYPTERAD_MAX_SIDOR = 30;

/**
 * En krypterad PDF — oftast låst mot ändringar och utskrift men öppen att
 * läsa, som många bankers och myndigheters — kan OpenAI inte läsa, och då
 * misslyckas hela anropet med alla filer i det. Sidorna ritas därför om till
 * bilder och läggs i en ny PDF utan kryptering. Kräver filen ett lösenord för
 * att öppnas går det inte, och då skickas den inte.
 */
async function avkryptera(bytes: Buffer): Promise<{ ok: true; bytes: Buffer; sidor: number } | { ok: false; orsak: string }> {
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs'); // eslint-disable-line @typescript-eslint/no-explicit-any
  // Samma arbetare som avläsningen av inmejlade PDF:er (@/lib/inmail/handlers/new-transaction)
  const { resolve } = await import('path');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')}`;
  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), password: '' }).promise;
  } catch (err) {
    if ((err as { name?: string })?.name === 'PasswordException') return { ok: false, orsak: 'PDF:en är lösenordsskyddad — be kunden skicka den utan lösenord' };
    return { ok: false, orsak: `Den krypterade PDF:en går inte att öppna: ${err instanceof Error ? err.message : err}` };
  }
  try {
    // Duken måste komma från pdfjs egen fabrik: pdfjs har en egen version av
    // @napi-rs/canvas, och dess Path2D går inte att rita på en duk från vår.
    const { PDFDocument } = await import('pdf-lib');
    const ny = await PDFDocument.create();
    const sidor = Math.min(Number(doc.numPages), KRYPTERAD_MAX_SIDOR);
    for (let i = 1; i <= sidor; i++) {
      const sida = await doc.getPage(i);
      const bas = sida.getViewport({ scale: 1 });
      // Längsta sidan som en bild vi skickar annars
      const skala = Math.min(BILD_MAX_PX / Math.max(bas.width, bas.height), 3);
      const vy = sida.getViewport({ scale: skala });
      const { canvas, context: ctx } = doc.canvasFactory.create(Math.ceil(vy.width), Math.ceil(vy.height));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await sida.render({ canvasContext: ctx as any, viewport: vy }).promise; // eslint-disable-line @typescript-eslint/no-explicit-any
      const jpg = await ny.embedJpg(canvas.toBuffer('image/jpeg', 85));
      ny.addPage([bas.width, bas.height]).drawImage(jpg, { x: 0, y: 0, width: bas.width, height: bas.height });
    }
    return { ok: true, bytes: Buffer.from(await ny.save()), sidor };
  } catch (err) {
    return { ok: false, orsak: `Den krypterade PDF:en gick inte att göra om: ${err instanceof Error ? err.message : err}` };
  } finally {
    await doc.destroy?.();
  }
}

/** Längsta sidan på en bild som skickas. OpenAI skalar ändå ner till 2048 px vid detail high. */
const BILD_MAX_PX = 2048;

/**
 * Mobilfoton är 3–5 MB, och ett anrop tar högst 50 MB filer — utan
 * nedskalning fick bara 16 foton plats, och sidorna i samma köpnota hamnade i
 * olika anrop. Nedskalade till 2048 px blir de några hundra kB, utan att
 * modellen ser mindre. Går det inte skickas originalet.
 */
async function skalaNer(bytes: Buffer, mime: string): Promise<{ bytes: Buffer; mime: string }> {
  if (mime === 'image/gif') return { bytes, mime };
  try {
    const sharp = (await import('sharp')).default;
    const ut = await sharp(bytes).rotate()
      .resize({ width: BILD_MAX_PX, height: BILD_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 }).toBuffer();
    return ut.length < bytes.length ? { bytes: ut, mime: 'image/jpeg' } : { bytes, mime };
  } catch (err) {
    console.warn('[omgang] kunde inte skala ner bilden, skickar originalet:', err instanceof Error ? err.message : err);
    return { bytes, mime };
  }
}

/** Filtyper AI:n kan läsa. SIE-filer, mejl och zip-arkiv skickas aldrig. */
export function kanSkickas(u: Pick<Underlagsrad, 'file_name' | 'mime_type'>): boolean {
  const typ = filtyp(u as Underlagsrad);
  return typ in BILD || typ in DOKUMENT || TEXT.includes(typ);
}

/** Laddar ner och prövar ett underlag. */
export async function kontrolleraFil(supabase: SupabaseClient, u: Underlagsrad): Promise<Kontroll> {
  const typ = filtyp(u);
  if (TYSTA.includes(typ)) return { ok: false, tyst: true, orsak: typ === 'eml' ? 'Mejl skickas inte' : typ === 'zip' ? 'Zip-arkivets filer är egna underlag' : 'SIE-filer tolkas med kod' };
  const kanda = typ in BILD || typ in DOKUMENT || TEXT.includes(typ);
  if (!kanda) return { ok: false, tyst: false, orsak: `Filtypen .${typ || '?'} kan inte läsas av AI:n` };
  if (u.file_size && u.file_size > MAX_FIL_BYTE) return { ok: false, tyst: false, orsak: 'Filen är större än 50 MB' };

  const { data, error } = await supabase.storage.from(BUCKET).download(u.file_path);
  if (error || !data) return { ok: false, tyst: false, orsak: `Filen finns inte i lagringen${error?.message ? `: ${error.message}` : ''}` };
  const bytes = Buffer.from(await data.arrayBuffer());
  if (!bytes.length) return { ok: false, tyst: false, orsak: 'Filen är tom' };
  if (bytes.length > MAX_FIL_BYTE) return { ok: false, tyst: false, orsak: 'Filen är större än 50 MB' };

  if (typ in BILD) {
    const riktig = bildtypUrInnehall(bytes);
    if (!riktig) return { ok: false, tyst: false, orsak: 'Bilden går inte att öppna — filen är trasig eller inte en bild' };
    return { ok: true, fil: { typ: 'bild', ...(await skalaNer(bytes, BILD[riktig])) } };
  }

  if (typ === 'pdf') {
    if (!bytes.subarray(0, 1024).toString('latin1').includes('%PDF')) return { ok: false, tyst: false, orsak: 'PDF:en går inte att öppna — filen är inte en PDF' };
    try {
      const { sidor, krypterad } = await pdfInfo(bytes);
      if (!sidor) return { ok: false, tyst: false, orsak: 'PDF:en har inga sidor' };
      if (krypterad) {
        const ny = await avkryptera(bytes);
        if (!ny.ok) return { ok: false, tyst: false, orsak: ny.orsak };
        return { ok: true, fil: { typ: 'dokument', mime: DOKUMENT.pdf, bytes: ny.bytes, sidor: ny.sidor } };
      }
      return { ok: true, fil: { typ: 'dokument', mime: DOKUMENT.pdf, bytes, sidor } };
    } catch (err) {
      return { ok: false, tyst: false, orsak: `PDF:en går inte att öppna: ${err instanceof Error ? err.message : err}` };
    }
  }

  if (typ in DOKUMENT) {
    const borjan = bytes.subarray(0, 8);
    const zip = borjan[0] === 0x50 && borjan[1] === 0x4b;
    const ole = borjan.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    const rtf = borjan.toString('latin1').startsWith('{\\rtf');
    const ratt = typ === 'rtf' ? rtf : typ === 'doc' ? ole : zip;
    if (!ratt) return { ok: false, tyst: false, orsak: 'Dokumentet går inte att öppna — filen är trasig' };
    return { ok: true, fil: { typ: 'dokument', mime: DOKUMENT[typ], bytes, sidor: null } };
  }

  try {
    const text = (await spreadsheetToText(bytes, u.mime_type ?? '', u.file_name)).trim();
    if (!text) return { ok: false, tyst: false, orsak: 'Kalkylbladet är tomt' };
    const kortad = text.length > MAX_TEXTTECKEN;
    return { ok: true, fil: { typ: 'text', text: kortad ? `${text.slice(0, MAX_TEXTTECKEN)}\n(… filen är längre än så och har kortats)` : text } };
  } catch (err) {
    return { ok: false, tyst: false, orsak: `Kalkylbladet går inte att öppna: ${err instanceof Error ? err.message : err}` };
  }
}

/**
 * Ungefär så många tokens filen blir hos modellen. Bilder och PDF-sidor
 * räknas högt — bättre att dela en omgång i onödan än att gå över gränsen
 * där OpenAI tar dubbelt betalt.
 */
export function uppskattadeTokens(f: Forberedd): number {
  if (f.typ === 'bild') return 3_000;
  if (f.typ === 'text') return Math.ceil(f.text.length / 3);
  if (f.mime === DOKUMENT.pdf) return (f.sidor ?? 1) * 3_500;
  return Math.ceil(f.bytes.length / 20);
}
