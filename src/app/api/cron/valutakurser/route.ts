import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { hamtaValutakurser } from '@/lib/valutakurser';

/**
 * Hämtar Riksbankens valutakurser en gång om dygnet. Varje körning tar de
 * senaste två veckorna, så att en missad körning eller en kurs Riksbanken
 * rättat i efterhand kommer med nästa dag.
 *
 * Bakåt i tiden: ?fran=2020-01-01 hämtar allt därifrån till i dag, ett år per
 * anrop till Riksbanken.
 *
 * Schemat i vercel.json står i UTC: 16:00 UTC är 17:00 eller 18:00 svensk tid,
 * efter att Riksbanken publicerat dagens kurser runt 16:15.
 */
export const maxDuration = 300;

const DAGAR_BAKAT = 14;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  const idag = new Date().toISOString().slice(0, 10);
  const fran = new URL(request.url).searchParams.get('fran')
    ?? new Date(Date.now() - DAGAR_BAKAT * 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fran) || fran > idag) {
    return NextResponse.json({ error: 'fran ska vara ett datum som ÅÅÅÅ-MM-DD, inte i framtiden' }, { status: 400 });
  }

  try {
    const resultat = await hamtaValutakurser(createServerClient(), fran, idag);
    return NextResponse.json({ fran, tom: idag, ...resultat });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
