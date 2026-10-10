import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/sms/phone';
import { nummerFor } from './kontext';

/**
 * Anteckningarna som skrivits i inkorgen när ett AI-svar inte blev bra.
 * Generella följer med i varje svar, kundspecifika när avsändaren matchar på
 * mejl eller telefon. Läggs sist i systemprompten och går före allt annat.
 */
export async function anteckningarForPrompt(
  supabase: SupabaseClient,
  { email, phone }: { email?: string | null; phone?: string | null },
): Promise<string> {
  try {
    const mejl = email?.trim().toLowerCase() || null;
    const nummer = new Set<string>();
    const n = normalizePhone(phone);
    if (n) nummer.add(n);
    if (mejl) for (const x of await nummerFor(supabase, mejl)) nummer.add(x);

    const villkor = [
      'omfang.eq.generell',
      ...(mejl ? [`email.eq."${mejl}"`] : []),
      ...(nummer.size ? [`telefon.in.(${[...nummer].map((x) => `"${x}"`).join(',')})`] : []),
    ].join(',');
    const { data } = await supabase.from('ai_anteckningar').select('text, omfang').or(villkor).order('created_at');
    const generella = (data ?? []).filter((a) => a.omfang === 'generell').map((a) => `- ${a.text}`);
    const kund = (data ?? []).filter((a) => a.omfang === 'kund').map((a) => `- ${a.text}`);
    if (!generella.length && !kund.length) return '';

    return [
      '',
      'ANTECKNINGAR FRÅN ERIK — följ dessa. De går före exemplen och tidigare svar om något krockar:',
      generella.length ? `Gäller alla svar:\n${generella.join('\n')}` : '',
      kund.length ? `Gäller just den här personen:\n${kund.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
  } catch {
    return '';
  }
}
