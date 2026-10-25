import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { bokforForfallna } from '@/lib/kontering/preliminar';

/**
 * Gör preliminära konteringar som legat orörda i 14 dagar till verifikationer,
 * en gång om dygnet. Se `@/lib/kontering/preliminar`.
 *
 * 04:00 UTC är 06:00 svensk sommartid.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  try {
    const resultat = await bokforForfallna(createServerClient());
    if (resultat.fel.length) console.error('[cron/verifikationer]', resultat.fel.join('\n'));
    return NextResponse.json(resultat);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
