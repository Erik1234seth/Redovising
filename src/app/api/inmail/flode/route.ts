import { NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { korUnderlagsomgang, type UnderlagsJobb } from '@/lib/underlag-kontroll';

/**
 * En omgång av underlagsflödet (se korUnderlagsomgang). Svarar direkt och gör
 * jobbet efteråt, så att omgången innan inte behöver vänta. Varje omgång får
 * egna 300 sekunder och postar själv nästa hit.
 */
export const maxDuration = 300;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  if (request.headers.get('x-inmail-secret') !== process.env.INMAIL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobb = (await request.json()) as UnderlagsJobb;
  if (!jobb?.profilId || !jobb.messageId || !jobb.avsandare) {
    return NextResponse.json({ error: 'profilId, messageId och avsandare krävs' }, { status: 400 });
  }

  const bas = new URL(request.url).origin;
  after(() => korUnderlagsomgang(getSupabase(), bas, jobb));
  return NextResponse.json({ ok: true, steg: jobb.steg ?? 'las', omgang: jobb.omgang ?? 0 });
}
