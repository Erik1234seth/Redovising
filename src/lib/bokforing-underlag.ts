import { createClient } from '@/lib/supabase';

/**
 * Tar emot ett underlag och sparar det — utan att tolka det.
 *
 * Filen läses inte av någon AI vid uppladdningen. Kunden får kvitto på att den
 * kommit fram, och bokföringen läggs in efteråt när underlaget gåtts igenom på
 * `/admin/underlag`. Det är därför inget här returnerar transaktioner.
 *
 * Både bokföringsfliken och skicka in-flödet går genom den här funktionen, så
 * ett underlag hamnar på samma ställe oavsett var kunden laddade upp det.
 */

export const MAX_UNDERLAG_SIZE = 10 * 1024 * 1024;

const BUCKET = 'bokforing-underlag';

// Bucketen släpper bara igenom kända filtyper, och webbläsaren sätter ibland
// fel eller tom typ — så vi utgår från filändelsen.
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function contentTypeFor(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? file.type ?? 'application/octet-stream';
}

/**
 * Laddar upp filerna en i taget och skriver en rad per fil.
 *
 * `onFile` anropas med namnet innan varje fil börjar, så anropande sida kan
 * visa vilken det står och väntar på. Kastar vid första felet — halva underlag
 * är sämre än inga, eftersom kunden annars får kvitto på något som inte kom in.
 */
export async function uploadUnderlag(files: File[], onFile?: (name: string) => void): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Du måste vara inloggad för att ladda upp underlag.');

  for (const file of files) {
    onFile?.(file.name);

    if (file.size > MAX_UNDERLAG_SIZE) {
      throw new Error(`${file.name} är större än 10 MB. Dela upp filen och försök igen.`);
    }

    const contentType = contentTypeFor(file);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60);
    const path = `${user.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (uploadError) throw new Error(`Kunde inte ladda upp ${file.name}: ${uploadError.message}`);

    const { error: dbError } = await supabase.from('bokforing_underlag').insert({
      user_id: user.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: contentType,
    });
    if (dbError) throw new Error(`Kunde inte spara ${file.name}: ${dbError.message}`);
  }
}
