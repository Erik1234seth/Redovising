import type { SupabaseClient } from '@supabase/supabase-js';
import { isSieFile } from '@/lib/sie/parse';
import { importSieUnderlag } from '@/lib/sie/import';
import { sorteringVidUppladdning } from './sortering';

/**
 * Zip-arkiv packas upp när de kommer in, och varje fil i arkivet blir ett eget
 * underlag — precis som om kunden bifogat filerna en och en. Kunder zippar ofta
 * en hel mapp med kvitton (Google Drive gör det av sig själv när man laddar ner
 * en mapp), och utan uppackningen läste vi aldrig en enda av dem.
 *
 * Filerna sorteras var för sig: kvitton och fakturor blir underlag, en Word-fil
 * hamnar bland övriga filer. Själva arkivet sparas kvar som övrig fil, så att
 * originalet finns, men det läses aldrig ut — då hade allt räknats två gånger.
 *
 * Arkiv i arkivet packas upp i samma veva. Mappstrukturen plattas till; finns
 * samma filnamn i två mappar får det andra mappen framför sig i namnet.
 */

const BUCKET = 'bokforing-underlag';

/** Skydd mot zip-bomber och arkiv som inte är kvitton. */
const MAX_FILER = 200;
const MAX_FIL_BYTES = 50 * 1024 * 1024; // bucketens gräns
const MAX_TOTALT_BYTES = 300 * 1024 * 1024;
const MAX_DJUP = 2;

/** Skräp som datorer lägger i arkiv utan att någon bett om det. */
const SKRAP = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|\._)/i;

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
};

const ext = (namn: string) => namn.split('.').pop()?.toLowerCase() ?? '';

/** Det som är gemensamt för arkivet och filerna i det: ägare, avsändare, mejlet. */
export interface ZipRad {
  id: string;
  user_id: string | null;
  sender_email: string | null;
  source: string | null;
  gmail_message_id: string | null;
  file_path: string;
  file_name: string;
}

interface Fil { namn: string; bytes: Buffer }

async function lasArkiv(bytes: Buffer, djup: number, prefix: string, ut: Fil[], totalt: { bytes: number }) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(bytes);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || SKRAP.test(entry.name)) continue;
    if (ut.length >= MAX_FILER) throw new Error(`Arkivet har fler än ${MAX_FILER} filer`);
    const innehall = await entry.async('nodebuffer');
    if (!innehall.length) continue;
    if (innehall.length > MAX_FIL_BYTES) throw new Error(`${entry.name} är större än 50 MB`);
    totalt.bytes += innehall.length;
    if (totalt.bytes > MAX_TOTALT_BYTES) throw new Error('Arkivet är större än 300 MB uppackat');

    const namn = prefix + entry.name;
    if (ext(namn) === 'zip' && djup < MAX_DJUP) {
      await lasArkiv(innehall, djup + 1, namn.replace(/\.zip$/i, '') + '/', ut, totalt);
    } else {
      ut.push({ namn, bytes: innehall });
    }
  }
}

/** Filnamnet utan mappar, utom när två filer annars skulle heta likadant. */
function filnamn(filer: Fil[]): string[] {
  const bas = filer.map((f) => f.namn.split('/').pop() || f.namn);
  return bas.map((b, i) => (bas.indexOf(b) !== i || bas.lastIndexOf(b) !== i ? filer[i].namn.replace(/\//g, ' – ') : b));
}

/**
 * Packar upp arkivet och sparar varje fil som eget underlag. Svarar med id:na
 * på de nya raderna, så att anroparen kan definiera dem. Filer som redan finns
 * (samma mejl, namn och storlek) hoppas över, så en omkörning sparar bara det
 * som saknas. Går arkivet inte att öppna står felet som varning på arkivet.
 */
export async function packaUppZip(supabase: SupabaseClient, arkiv: ZipRad): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(arkiv.file_path);
    if (error || !data) throw new Error(`Arkivet finns inte i lagringen: ${error?.message ?? 'okänt fel'}`);

    const filer: Fil[] = [];
    await lasArkiv(Buffer.from(await data.arrayBuffer()), 1, '', filer, { bytes: 0 });
    const namn = filnamn(filer);
    const mapp = arkiv.file_path.slice(0, arkiv.file_path.lastIndexOf('/'));

    const nya: string[] = [];
    for (const [i, fil] of filer.entries()) {
      const fileName = namn[i];
      const mimeType = MIME[ext(fileName)] ?? 'application/octet-stream';
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-60) || 'fil';
      const path = `${mapp}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

      const { error: uppFel } = await supabase.storage.from(BUCKET).upload(path, fil.bytes, { contentType: mimeType, upsert: false });
      if (uppFel) throw new Error(`Kunde inte spara ${fileName}: ${uppFel.message}`);

      const { data: rad, error: radFel } = await supabase.from('bokforing_underlag').insert({
        user_id: arkiv.user_id,
        sender_email: arkiv.sender_email,
        source: arkiv.source,
        gmail_message_id: arkiv.gmail_message_id,
        file_name: fileName,
        file_path: path,
        file_size: fil.bytes.length,
        mime_type: mimeType,
        ...sorteringVidUppladdning(fileName, mimeType, arkiv.sender_email),
      }).select('id').single();

      if (radFel) {
        await supabase.storage.from(BUCKET).remove([path]);
        // Samma fil ur samma mejl finns redan — arkivet har packats upp förut
        if (radFel.code === '23505') continue;
        throw new Error(`Kunde inte spara ${fileName}: ${radFel.message}`);
      }
      if (isSieFile(fileName)) {
        await importSieUnderlag(supabase, rad.id).catch((err) =>
          console.error(`[zip] SIE-import av ${fileName}:`, err instanceof Error ? err.message : err));
      }
      nya.push(rad.id);
    }

    console.log(`[zip] ${arkiv.file_name}: ${filer.length} filer, ${nya.length} nya underlag`);
    return nya;
  } catch (err) {
    const fel = err instanceof Error ? err.message : String(err);
    console.error(`[zip] ${arkiv.file_name} gick inte att packa upp:`, fel);
    await supabase.from('bokforing_underlag').update({ varningar: [`Zip-arkivet gick inte att packa upp: ${fel}`] }).eq('id', arkiv.id);
    return [];
  }
}
