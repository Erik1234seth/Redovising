import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms/twilio';
import { runLeadReminders, type ReminderRun } from '@/lib/leads/reminders';

/**
 * Morgonens utskick: tömmer SMS-kön och skickar dagens lead-påminnelser.
 *
 * Två saker i ett jobb, och det är en planbegränsning som styr det. Vercels
 * Hobby-plan tillåter två schemalagda jobb, och de är tagna av det här och
 * mötespåminnelserna. Lead-påminnelserna behöver bara väckas en gång om dygnet,
 * så de åker med här i stället för att få ett eget schema. Själva logiken bor i
 * `src/lib/leads/reminders.ts` och går även att trigga för hand via
 * /api/cron/lead-reminders.
 *
 * Kön i sig är ett skyddsnät: sedan nattspärren togs bort går lead-SMS ut
 * direkt och inget nytt hamnar här, så den delen har normalt ingenting att
 * göra. Den finns kvar som utgång om ett utskick behöver skjutas upp.
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

  // Alla avregistreringar hämtas i ett svep istället för en fråga per rad
  const { data: optouts } = queued?.length
    ? await supabase.from('sms_optouts').select('phone').in('phone', queued.map((m) => m.phone))
    : { data: [] as { phone: string }[] };
  const optedOut = new Set((optouts ?? []).map((o) => o.phone));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const message of queued ?? []) {
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

  if (sent || failed || skipped) {
    console.log(`[sms-queue] ${sent} skickade, ${failed} misslyckade, ${skipped} överhoppade`);
  }

  // Påminnelserna sist, och med egen felhantering: en trasig mejlkoppling ska
  // inte få det att se ut som om kön inte tömdes.
  let reminders: ReminderRun | { error: string };
  try {
    reminders = await runLeadReminders(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sms-queue] lead-påminnelserna avbröts:', message);
    reminders = { error: message };
  }

  return NextResponse.json({ sent, failed, skipped, reminders });
}
