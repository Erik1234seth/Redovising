import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms/twilio';
import { normalizePhone } from '@/lib/sms/phone';
import {
  REMINDER_KIND,
  describeMeetingDay,
  meetingReminderSms,
  timeInSweden,
  todayInSweden,
} from '@/lib/sms/meeting-reminder';

/**
 * Påminner alla som har ett bokat möte i dag om att vi ringer, och från vilket
 * nummer.
 *
 * Körs en gång på morgonen av Vercel Cron. Att den inte går exakt en timme före
 * varje möte är ett medvetet val: Vercels schemaläggning kan bara väckas en
 * gång per dygn på nuvarande plan, och alternativen krävde antingen Pro eller
 * en Messaging Service hos Twilio. Ett SMS på morgonen når kunden i god tid,
 * vilket är det påminnelsen ska göra.
 *
 * Schemat i vercel.json står i UTC: 06:00 UTC är 08:00 svensk sommartid, alltså
 * strax före dagens första möjliga tid (09:00).
 */
export const maxDuration = 300;

/** Tak per körning, så en oväntad ansamling aldrig blir ett massutskick. */
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

  const today = todayInSweden();
  const now = timeInSweden();

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, name, phone, date, time')
    .eq('date', today)
    .order('time', { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[reminders] kunde inte läsa dagens möten:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!meetings?.length) {
    return NextResponse.json({ date: today, sent: 0, failed: 0, skipped: 0 });
  }

  // Ett möte utan telefonnummer går inte att påminna om, och ett som redan
  // varit behöver ingen påminnelse.
  const due = meetings
    .map((m) => ({ ...m, normalized: normalizePhone(m.phone) }))
    .filter((m) => m.normalized && m.time > now);

  const phones = due.map((m) => m.normalized as string);

  // Två spärrar mot dubbletter: avregistrerade nummer, och de som redan fått
  // dagens påminnelse (jobbet kan köras om utan att någon får två SMS).
  const [{ data: optouts }, { data: alreadySent }] = await Promise.all([
    supabase.from('sms_optouts').select('phone').in('phone', phones),
    supabase
      .from('sms_messages')
      .select('phone')
      .eq('kind', REMINDER_KIND)
      .eq('direction', 'out')
      .in('status', ['sent', 'queued'])
      .gte('created_at', new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()),
  ]);

  const blocked = new Set([
    ...(optouts ?? []).map((o) => o.phone),
    ...(alreadySent ?? []).map((s) => s.phone),
  ]);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const meeting of due) {
    const phone = meeting.normalized as string;

    if (blocked.has(phone)) {
      skipped++;
      continue;
    }
    // Två möten samma dag på samma nummer ger ändå bara ett SMS.
    blocked.add(phone);

    const body = meetingReminderSms(meeting.date, meeting.time);

    try {
      const sid = await sendSms({ to: phone, body });
      await supabase.from('sms_messages').insert({
        phone,
        direction: 'out',
        body,
        kind: REMINDER_KIND,
        twilio_sid: sid,
        status: 'sent',
      });
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[reminders] kunde inte skicka till ${phone}:`, message);
      await supabase.from('sms_messages').insert({
        phone,
        direction: 'out',
        body,
        kind: REMINDER_KIND,
        status: 'failed',
        error: message,
      });
      failed++;
    }
  }

  console.log(
    `[reminders] ${describeMeetingDay(today)}: ${sent} skickade, ${failed} misslyckade, ${skipped} överhoppade`,
  );
  return NextResponse.json({ date: today, sent, failed, skipped });
}
