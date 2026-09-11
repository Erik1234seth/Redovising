import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runLeadReminders } from '@/lib/leads/reminders';

/**
 * Påminnelserna till leads som aldrig svarade — för hand.
 *
 * Själva jobbet bor i `src/lib/leads/reminders.ts` och körs varje morgon av
 * /api/cron/sms-queue. Den här routen finns kvar av två skäl: `?dry=1` visar
 * vilka som står på tur utan att skicka något, och utan `dry` går det att köra
 * ikapp direkt i stället för att vänta till nästa morgon.
 *
 * Den står medvetet inte i vercel.json. Hobby-planen tillåter två schemalagda
 * jobb och båda är upptagna, så påminnelserna åker med SMS-kön i stället.
 */
export const maxDuration = 300;

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

  try {
    const dryRun = new URL(request.url).searchParams.get('dry') === '1';
    return NextResponse.json(await runLeadReminders(supabase, { dryRun }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[lead-reminders] körningen avbröts:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
