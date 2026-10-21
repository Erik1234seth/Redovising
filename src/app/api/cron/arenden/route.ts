import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { kollaArenden } from '@/lib/arenden/ai-koll';

/**
 * Går igenom alla öppna ärenden en gång om dygnet: stänger det som redan är
 * gjort och skriver mejlutkast för det som passerat sitt datum. Fångar det
 * som inte kom in som mejl eller sms, till exempel underlag uppladdade i appen
 * eller mejl vi skickat själva.
 *
 * Schemat i vercel.json står i UTC: 05:00 UTC är 07:00 svensk sommartid, så
 * utkasten ligger klara i inkorgen när dagen börjar.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  try {
    const resultat = await kollaArenden({ supabase: createServerClient(), skrivMejl: true });
    return NextResponse.json(resultat);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
