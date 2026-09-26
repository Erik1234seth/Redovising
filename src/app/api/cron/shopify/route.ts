import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { synkaAllaShopify } from '@/lib/shopify/sync';

/**
 * Shopify-synken för alla kopplade kunder — för hand.
 *
 * Körs varje morgon av /api/cron/sms-queue. Står medvetet inte i vercel.json,
 * av samma skäl som lead-påminnelserna: Hobby-planens två jobb är tagna.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  try {
    return NextResponse.json(await synkaAllaShopify(createServerClient()));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/shopify] körningen avbröts:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
