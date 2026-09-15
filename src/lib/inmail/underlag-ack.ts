import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Bekräftar att mejlade underlag kommit fram.
 *
 * Läggs runt /api/inmail och /api/inmail/reply i stället för inne i varje
 * handler: filerna sparas innan mail-AI:n ens får mejlet, så frågan "kom det
 * underlag med det här mejlet?" går att svara på i efterhand, på ett ställe.
 *
 *  - Hade AI:n inget att säga (en ren bilaga) blir bekräftelsen hela svaret.
 *  - Svarade den på något annat i mejlet läggs en mening till på slutet, så
 *    kunden inte undrar om filen försvann.
 *
 * Svaret blir ett utkast i Gmail som alla andra AI-svar — check-inbox.gs
 * skapar det av replyBody och hänger på signaturen. Ingen signatur här.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function firstNameFor(supabase: ReturnType<typeof getSupabase>, email: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles').select('full_name').ilike('email', email).limit(1).maybeSingle();
  const { data: lead } = profile?.full_name
    ? { data: null }
    : await supabase.from('contact_requests').select('name').ilike('email', email)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const full = (profile?.full_name || lead?.name || '').trim();
  return full ? full.split(/\s+/)[0] : null;
}

function receivedPhrase(count: number): { what: string; it: string } {
  return count === 1
    ? { what: 'ditt underlag', it: 'det' }
    : { what: `dina ${count} filer`, it: 'dem' };
}

export function underlagReceivedReply(firstName: string | null, count: number): string {
  const { what, it } = receivedPhrase(count);
  return `Hej${firstName ? ` ${firstName}` : ''}!\n\n`
    + `Tack, vi har tagit emot ${what} och tittar på ${it} så snart vi kan. `
    + 'Skulle något saknas eller vara oklart hör vi av oss.';
}

export function underlagReceivedNote(count: number): string {
  const { what, it } = receivedPhrase(count);
  return `Vi har också tagit emot ${what} och tittar på ${it} så snart vi kan.`;
}

/** Tar handlerns svar och lägger till bekräftelsen när mejlet hade underlag. */
export async function withUnderlagAck(request: Request, response: Response): Promise<Response> {
  if (response.status !== 200) return response;

  try {
    const data = await response.clone().json();
    // No-reply-avsändare ska aldrig få något utkast
    if (data?.action === 'skipped') return response;

    const { senderEmail, messageId } = await request.json() as { senderEmail?: string; messageId?: string };
    if (!senderEmail || !messageId) return response;

    const supabase = getSupabase();
    const { count } = await supabase
      .from('bokforing_underlag')
      .select('id', { count: 'exact', head: true })
      .eq('gmail_message_id', messageId);
    if (!count) return response;

    const replyBody = typeof data.replyBody === 'string' && data.replyBody.trim()
      ? `${data.replyBody.replace(/\s+$/, '')}\n\n${underlagReceivedNote(count)}`
      : underlagReceivedReply(await firstNameFor(supabase, senderEmail.trim().toLowerCase()), count);

    console.log(`[inmail/underlag-ack] bekräftar ${count} filer till ${senderEmail}`);
    return NextResponse.json({ ...data, replyBody, underlagAck: count });
  } catch (err) {
    // Bekräftelsen är en extra — går den inte att bygga skickas svaret som det var
    console.error('[inmail/underlag-ack]', err instanceof Error ? err.message : err);
    return response;
  }
}
