import { NextResponse, after } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { skrivAllaFragemejl } from '@/lib/transaktioner/fragemejl';

/**
 * Dygnets frågemejl: ett utkast i inkorgen per kund med alla transaktioner vi
 * har frågor om och inte frågat om än.
 *
 * Anropas kl 18 av Apps Script (fragemejl.gs) — Vercel-planens två cron-jobb
 * är tagna. Svarar direkt och skriver mejlen efteråt, eftersom Apps Script
 * inte väntar så länge som AI:n behöver.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  if (request.headers.get('x-inmail-secret') !== process.env.INMAIL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  after(async () => {
    try {
      const res = await skrivAllaFragemejl(createServerClient());
      console.log(`[fragemejl] ${res.kunder} utkast med ${res.transaktioner} transaktioner${res.fel.length ? `, fel: ${res.fel.join(' | ')}` : ''}`);
    } catch (e) {
      console.error('[fragemejl] körningen avbröts:', e instanceof Error ? e.message : e);
    }
  });
  return NextResponse.json({ ok: true });
}
