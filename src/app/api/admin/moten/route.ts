import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AdminMeeting } from '@/lib/admin-types';
import { normalizePhone } from '@/lib/sms/phone';
import { REMINDER_KIND } from '@/lib/sms/meeting-reminder';
import { swedishDateOf, timeInSweden, todayInSweden } from '@/lib/meetingSlots';

/**
 * Alla bokade tider på ett ställe.
 *
 * Bokningar kommer in från fyra håll — /boka-mote, popupen på startsidan,
 * kontaktflödet och Facebooks snabbformulär — men hamnar i samma tabell. Panelen visar dem i
 * tidsordning så att dagens samtal går att se utan att leta i tre flöden.
 *
 * Två saker räknas ut här och inte i webbläsaren: vilket datum det är i Sverige
 * (servern går på UTC, mötena på väggklockan) och om påminnelse-SMS:et faktiskt
 * gick ut. Det senare är hela poängen med kolumnen — ett möte där påminnelsen
 * fastnat är ett möte kunden kanske inte dyker upp på.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Var bokningen gjordes. Nyare rader har det i klartext; för dem som skrevs
 * innan kolumnen fanns går det att läsa ut ur meddelandefältet, som
 * kontaktflödet alltid stämplade.
 */
function sourceOf(row: { source: string | null; message: string | null }): AdminMeeting['source'] {
  const known = ['boka-mote', 'popup', 'flodet', 'facebook'] as const;
  if (row.source && (known as readonly string[]).includes(row.source)) {
    return row.source as AdminMeeting['source'];
  }
  if (row.message?.includes('Facebook')) return 'facebook';
  if (row.message?.startsWith('Via flödet')) return 'flodet';
  return 'okand';
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: rows, error } = await supabase
      .from('meetings')
      .select('id, name, email, phone, date, time, message, created_at, source')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const meetings = rows ?? [];

    // Påminnelserna de senaste två månaderna räcker: äldre möten har ändå varit,
    // och kolumnen är till för att fånga det som håller på att gå fel.
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: reminders } = await supabase
      .from('sms_messages')
      .select('phone, status, created_at')
      .eq('kind', REMINDER_KIND)
      .eq('direction', 'out')
      .gte('created_at', since);

    // En påminnelse hör till ett möte när den gick till samma nummer samma dag
    // som mötet. Nyckeln är alltså nummer + datum, inte något id — påminnelsen
    // skickas från ett cron-jobb som bara känner till telefonnumret.
    const remindedBy = new Map<string, string>();
    for (const r of reminders ?? []) {
      remindedBy.set(`${r.phone}|${swedishDateOf(r.created_at)}`, r.status);
    }

    const today = todayInSweden();
    const now = timeInSweden();

    const list: AdminMeeting[] = meetings.map((m) => {
      const email = m.email?.trim() || null;
      const phone = normalizePhone(m.phone);
      const reminder = phone ? remindedBy.get(`${phone}|${m.date}`) ?? null : null;

      return {
        id: m.id,
        name: m.name?.trim() || null,
        email,
        phone: m.phone?.trim() || null,
        date: m.date,
        time: m.time,
        message: m.message?.trim() || null,
        bookedAt: m.created_at,
        source: sourceOf(m),
        // Personvyn slår upp på vilken adress som helst, så mejlnyckeln räcker.
        personKey: email ? `e:${email.toLowerCase()}` : null,
        // 'sent' | 'failed' | null. Null betyder att ingen påminnelse gått ut —
        // vilket är väntat för allt som ligger längre fram än i dag.
        reminder,
        past: m.date < today || (m.date === today && m.time <= now),
      };
    });

    return NextResponse.json({
      meetings: list,
      today: list.filter((m) => m.date === today && !m.past).length,
      upcoming: list.filter((m) => !m.past).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/moten]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Avbokar en tid. Raden tas bort helt, vilket är avsiktligt: tiden ska bli
 * ledig igen på /boka-mote, och en avbokning som ligger kvar som rad skulle
 * fortsätta blockera den. Kunden får inget besked härifrån — den som avbokar
 * har redan pratat med personen.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });

    const { error } = await getSupabase().from('meetings').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
