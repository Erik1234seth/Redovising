import type { SupabaseClient } from '@supabase/supabase-js';
import { arTabellfil } from './filtyp';
import { spreadsheetToText } from './fil-delar';

/**
 * Filer vi själva skickat till kunden, till exempel en Excel-fil där kunden
 * ska markera privata rader i kontoutdraget.
 *
 * De ligger bland kundens underlag så att AI:n ser vad kunden svarar på, men
 * de är inga underlag: innehållet är en kopia av något kunden redan skickat.
 * De läses därför aldrig ut till transaktioner och konteras aldrig — då
 * skulle samma rader bokföras två gånger.
 */

const BUCKET = 'bokforing-underlag';
/** Per fil. Ett kalkylblad med några hundra rader får plats. */
const MAX_TECKEN = 20000;

export function arVarAdress(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith('@enklabokslut.se');
}

/** Våra filer hos kunden, som text till en AI. Kalkylblad med innehåll, annat bara med namn. */
export async function varaFilerSomText(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from('bokforing_underlag')
    .select('file_name, file_path, mime_type, created_at, sender_email')
    .eq('user_id', userId).ilike('sender_email', '%@enklabokslut.se')
    .order('created_at');
  if (!data?.length) return '';

  const block = await Promise.all(data.map(async (f) => {
    const rubrik = `--- ${f.file_name} (skickad av oss ${String(f.created_at).slice(0, 10)})`;
    if (!arTabellfil(f.file_name, f.mime_type)) return `${rubrik}\n(innehållet visas inte, bara att vi skickat filen)`;
    try {
      const { data: fil, error } = await supabase.storage.from(BUCKET).download(f.file_path);
      if (error || !fil) throw new Error(error?.message ?? 'filen saknas');
      const text = await spreadsheetToText(Buffer.from(await fil.arrayBuffer()), f.mime_type ?? '', f.file_name);
      return `${rubrik}\n${text.length > MAX_TECKEN ? `${text.slice(0, MAX_TECKEN)}\n[…]` : text}`;
    } catch (err) {
      return `${rubrik}\n(kunde inte läsas: ${err instanceof Error ? err.message : err})`;
    }
  }));

  return `FILER VI SJÄLVA SKICKAT TILL KUNDEN. De är inga underlag och ska inte bokföras — de visar vad kunden svarar på:\n\n${block.join('\n\n')}`;
}
