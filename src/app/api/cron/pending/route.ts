import { NextResponse } from 'next/server';
import { send } from '@vercel/queue';
import { createServerClient } from '@/lib/supabase-server';
import { PENDING_AMNE, kunderMedPending, type PendingMeddelande } from '@/lib/kontering/pending';

/**
 * I slutet av dagen konteras pending transaktioner om när kunden mejlat eller
 * nya bankrader kommit (@/lib/kontering/pending). Varje kund läggs i kön
 * (ämnet pending), så att varje kund får en egen funktion med egen tid.
 *
 * 19:00 UTC är 20:00 svensk vintertid och 21:00 sommartid.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  try {
    const kunder = await kunderMedPending(createServerClient());
    for (const userId of kunder) await send<PendingMeddelande>(PENDING_AMNE, { userId });
    return NextResponse.json({ kunder: kunder.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/pending]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
