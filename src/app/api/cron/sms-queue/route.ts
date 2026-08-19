import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms/twilio';
import { isQuietHours } from '@/lib/sms/lead';

/**
 * Skickar välkomst-SMS som köats över natten. Körs av Vercel Cron enligt
 * schemat i vercel.json (07:00 UTC = 08 på vintern, 09 på sommaren).
 *
 * Vercel skickar `Authorization: Bearer $CRON_SECRET` när CRON_SECRET finns
 * bland miljövariablerna. Utan den kan vem som helst trigga körningen.
 */
export const maxDuration = 300;

/** Tak per körning, så en oväntad ansamling inte blir ett massutskick. */
const MAX_PER_RUN = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  // Skyddsnät: körs jobbet manuellt mitt i natten ska köade SMS ändå ligga kvar
  if (isQuietHours()) {
    return NextResponse.json({ skipped: 'utanför utskicksfönstret' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: queued, error } = await supabase
    .from('sms_messages')
    .select('id, phone, body')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[sms-queue] kunde inte läsa kön:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!queued?.length) return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });

  // Alla avregistreringar hämtas i ett svep istället för en fråga per rad
  const { data: optouts } = await supabase
    .from('sms_optouts')
    .select('phone')
    .in('phone', queued.map((m) => m.phone));
  const optedOut = new Set((optouts ?? []).map((o) => o.phone));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const message of queued) {
    if (optedOut.has(message.phone)) {
      await supabase
        .from('sms_messages')
        .update({ status: 'skipped', error: 'Avregistrerad innan utskick' })
        .eq('id', message.id);
      skipped++;
      continue;
    }

    try {
      const sid = await sendSms({ to: message.phone, body: message.body });
      await supabase
        .from('sms_messages')
        .update({ status: 'sent', twilio_sid: sid })
        .eq('id', message.id);
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sms-queue] kunde inte skicka till ${message.phone}:`, msg);
      await supabase
        .from('sms_messages')
        .update({ status: 'failed', error: msg })
        .eq('id', message.id);
      failed++;
    }
  }

  console.log(`[sms-queue] ${sent} skickade, ${failed} misslyckade, ${skipped} överhoppade`);
  return NextResponse.json({ sent, failed, skipped });
}
