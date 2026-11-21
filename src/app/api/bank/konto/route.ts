import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { kontotsRader } from '@/lib/startsida';

/** GET ?hash=…: ett av kundens bankkonton med alla rader och vad varje rad är kopplad till. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const hash = new URL(request.url).searchParams.get('hash');
  if (!hash) return NextResponse.json({ error: 'Kontot saknas' }, { status: 400 });
  try {
    const svar = await kontotsRader(createServerClient(), user.id, hash);
    if (!svar) return NextResponse.json({ error: 'Kontot finns inte' }, { status: 404 });
    return NextResponse.json(svar);
  } catch (err) {
    console.error('[bank/konto]', err);
    return NextResponse.json({ error: 'Kunde inte läsa kontot' }, { status: 500 });
  }
}
