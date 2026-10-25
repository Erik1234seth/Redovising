import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Vilka Gmail-meddelanden check-inbox.gs redan kört mejlflödet på.
 *
 * Förr var markeringen läst/oläst i Gmail. Öppnade någon mejlet innan skriptet
 * hann köra hoppades det över för alltid, med bilagor och allt. Nu frågar
 * skriptet här i stället, och det spelar ingen roll om mejlet är läst.
 *
 *   action: 'check' { messageIds } → { nya: [...] }  (de som inte är behandlade)
 *   action: 'mark'  { messageIds } → { ok: true }
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const MAX_IDS = 1000;

export async function POST(request: Request) {
  if (request.headers.get('x-inmail-secret') !== process.env.INMAIL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body.messageIds)
      ? [...new Set<string>(body.messageIds.filter((id: unknown) => typeof id === 'string' && id))]
      : [];
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ error: `Högst ${MAX_IDS} id per anrop` }, { status: 400 });
    }
    if (!ids.length) return NextResponse.json(body.action === 'check' ? { nya: [] } : { ok: true });

    const supabase = getSupabase();

    if (body.action === 'check') {
      const { data, error } = await supabase
        .from('inmail_behandlade')
        .select('gmail_message_id')
        .in('gmail_message_id', ids);
      if (error) throw new Error(`Kunde inte läsa inmail_behandlade: ${error.message}`);
      const klara = new Set((data ?? []).map((r) => r.gmail_message_id));
      return NextResponse.json({ nya: ids.filter((id) => !klara.has(id)) });
    }

    if (body.action === 'mark') {
      const { error } = await supabase
        .from('inmail_behandlade')
        .upsert(ids.map((id) => ({ gmail_message_id: id })), { onConflict: 'gmail_message_id', ignoreDuplicates: true });
      if (error) throw new Error(`Kunde inte spara inmail_behandlade: ${error.message}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "action måste vara 'check' eller 'mark'" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[inmail/behandlade]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
