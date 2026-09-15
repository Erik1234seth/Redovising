import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Markerar misslyckade utskick som hanterade — eller ångrar det.
 *
 * Raden och felet ligger kvar; det enda som ändras är `issue_dismissed_at`.
 * Så syns utskicket fortfarande i tidslinjen, men personen lyser inte rött
 * för något Erik redan tagit hand om.
 */

const TABLES = { mejl: 'email_log', sms: 'sms_messages' } as const;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const { items, dismissed } = (await request.json()) as {
      items?: { channel: keyof typeof TABLES; id: string }[];
      dismissed?: boolean;
    };

    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'items krävs' }, { status: 400 });
    }
    if (items.some((i) => !TABLES[i.channel] || !i.id)) {
      return NextResponse.json({ error: 'varje item behöver channel (mejl/sms) och id' }, { status: 400 });
    }

    const supabase = getSupabase();
    const value = dismissed === false ? null : new Date().toISOString();

    for (const channel of Object.keys(TABLES) as (keyof typeof TABLES)[]) {
      const ids = items.filter((i) => i.channel === channel).map((i) => i.id);
      if (!ids.length) continue;
      const { error } = await supabase.from(TABLES[channel]).update({ issue_dismissed_at: value }).in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/people/issues]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
