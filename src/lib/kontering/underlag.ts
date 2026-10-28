import type { SupabaseClient } from '@supabase/supabase-js';
import { imageMimeType, isImage, isPdf, spreadsheetToText } from '@/lib/underlag/fil-delar';
import { arTabellfil } from '@/lib/underlag/filtyp';
import { dokumentetsSidor } from '@/lib/underlag/sidor';
import type { Del } from './modeller';

/**
 * Det konteringen ser av filen en transaktion kommer ifrån: originalet som
 * det ser ut — kvittot, fakturan, kontoutdraget — och alla transaktioner som
 * lästs ut ur filen. Avskriften räcker inte: det avläsningen inte tyckte var
 * viktigt finns annars inte för konteringen, och en rad på ett kontoutdrag
 * går ofta inte att förstå utan raderna runt den.
 *
 * Delarna är desamma för alla transaktioner i filen och ligger därför först i
 * anropet, där de cachas.
 */

const BUCKET = 'bokforing-underlag';
// Större filer skickas inte — en PDF på över 25 MB slår i taket hos leverantörerna
const MAX_BYTE = 25 * 1024 * 1024;
const MAX_TABELLTECKEN = 150_000;

interface Fil { file_name: string; file_path: string; mime_type: string | null }

async function filDel(supabase: SupabaseClient, f: Fil): Promise<Del> {
  const { data, error } = await supabase.storage.from(BUCKET).download(f.file_path);
  if (error || !data) return { typ: 'text', text: `(${f.file_name} saknas i lagringen — konteringen får nöja sig med avskriften)` };
  const buffer = Buffer.from(await data.arrayBuffer());
  const mime = f.mime_type ?? '';
  if (buffer.length > MAX_BYTE) return { typ: 'text', text: `(${f.file_name} är för stor för att visas — konteringen får nöja sig med avskriften)` };
  if (isPdf(mime, f.file_name)) return { typ: 'pdf', namn: f.file_name, data: buffer.toString('base64') };
  if (isImage(mime, f.file_name)) return { typ: 'bild', mime: imageMimeType(mime, f.file_name) as 'image/png' | 'image/jpeg', data: buffer.toString('base64') };
  if (arTabellfil(f.file_name, f.mime_type)) {
    const text = await spreadsheetToText(buffer, mime, f.file_name).catch(() => '');
    if (text) return { typ: 'text', text: `${f.file_name} som text:\n${text.slice(0, MAX_TABELLTECKEN)}` };
  }
  return { typ: 'text', text: `(${f.file_name} är en filtyp som inte kan visas — konteringen får nöja sig med avskriften)` };
}

export interface Filrad {
  id: string;
  datum: string | null;
  riktning: 'in' | 'ut';
  belopp: number;
  valuta: string | null;
  motpart: string | null;
  beskrivning: string | null;
}

/** Filens transaktioner som en lista. Numren används för att peka ut raden som konteras. */
export function filensRader(rader: Filrad[]): { text: string; nummer: Map<string, number> } {
  const nummer = new Map(rader.map((r, i) => [r.id, i + 1]));
  const text = rader.map((r, i) =>
    `F${i + 1} ${r.datum ?? 'okänt datum'} ${r.riktning === 'in' ? 'IN ' : 'UT '} ${r.belopp} ${r.valuta || 'SEK'} · ${r.motpart || '—'} · ${(r.beskrivning ?? '').slice(0, 100)}`).join('\n');
  return { text, nummer };
}

/**
 * Originaldokumentet med alla sidor, och filens transaktioner. Tom lista när
 * transaktionen inte kommer från en fil (bankkoppling, webbutik).
 */
export async function underlagetsDelar(
  supabase: SupabaseClient,
  underlagId: string,
  rader: Filrad[],
): Promise<Del[]> {
  const { data: u } = await supabase.from('bokforing_underlag')
    .select('id, file_name, file_path, mime_type').eq('id', underlagId).maybeSingle();
  if (!u) return [];
  const sidor = await dokumentetsSidor(supabase, u.id).catch(() => []);
  const filer: Fil[] = [u as Fil, ...sidor.map((s) => ({ file_name: s.file_name, file_path: s.file_path, mime_type: s.mime_type }))];
  const delar = await Promise.all(filer.map((f) => filDel(supabase, f)));
  const { text } = filensRader(rader);

  return [
    {
      typ: 'text',
      text: filer.length > 1
        ? `ORIGINALUNDERLAGET: ${u.file_name}, ${filer.length} filer som är sidor i samma dokument, i ordning.`
        : `ORIGINALUNDERLAGET: ${u.file_name}`,
    },
    ...delar,
    { typ: 'text', text: `ALLA TRANSAKTIONER SOM LÄSTS UT UR FILEN (${rader.length} st):\n${text}` },
  ];
}
