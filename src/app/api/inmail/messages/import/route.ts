import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cleanBody } from '@/lib/inmail/clean-body';
import { isNoReplyAddress } from '@/lib/inmail/no-reply';

// Tar emot mejl från Gmail (Apps Script: sync-mail.gs) och sparar dem i
// mail_messages, åt båda hållen. Det blir kundens mejlhistorik i adminpanelen,
// och senare kontext när AI:n konterar.
//
// Upsert på gmail_message_id, så samma mejl kan skickas upp hur många gånger
// som helst. Skriptet tar därför med marginal bakåt i tiden varje körning.

interface IncomingMessage {
  messageId: string;
  gmailThreadId: string;
  direction: 'in' | 'out';
  from?: string;
  to?: string[];
  customerEmail: string;
  subject?: string;
  body?: string;
  attachmentNames?: string[];
  sentAt: string;
}

// Ett långt nyhetsbrev eller en lång citatkedja ska inte kunna bli en rad på
// flera megabyte. Det som står först är det kunden skrev.
const MAX_RAW = 50_000;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-inmail-secret');
    if (secret !== process.env.INMAIL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages } = (await request.json()) as { messages?: IncomingMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0 });
    }

    const rows = messages
      .map((m) => {
        const customer = m.customerEmail?.trim().toLowerCase();
        const raw = (m.body ?? '').replace(/\r/g, '').slice(0, MAX_RAW);
        return {
          gmail_message_id: m.messageId,
          gmail_thread_id: m.gmailThreadId,
          direction: m.direction,
          from_email: m.from?.trim().toLowerCase() || null,
          to_emails: (m.to ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
          customer_email: customer,
          subject: m.subject?.trim() || null,
          body: cleanBody(raw),
          body_raw: raw,
          attachment_names: m.attachmentNames ?? [],
          sent_at: m.sentAt,
        };
      })
      // Systemutskick och studsar är ingen konversation med en kund
      .filter((r) =>
        r.gmail_message_id && r.gmail_thread_id && r.sent_at
        && (r.direction === 'in' || r.direction === 'out')
        && r.customer_email?.includes('@') && !isNoReplyAddress(r.customer_email));

    const skipped = messages.length - rows.length;
    if (rows.length === 0) return NextResponse.json({ imported: 0, skipped });

    const { error } = await getSupabase()
      .from('mail_messages')
      .upsert(rows, { onConflict: 'gmail_message_id' });

    if (error) {
      console.error('[inmail/messages] upsert misslyckades:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ imported: rows.length, skipped });
  } catch (err) {
    console.error('Error in /api/inmail/messages/import:', err);
    return NextResponse.json({ error: 'Internt fel' }, { status: 500 });
  }
}
