import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { synkaZettle } from '@/lib/zettle/sync';

/**
 * GET: kopplingens status för appens integrationssida. Tokens lämnar aldrig servern.
 * POST: hämta nu, i stället för att vänta på morgonens körning.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { data, error } = await createServerClient()
    .from('zettle_kopplingar')
    .select('status, kopplad_at, senast_synkad_at, senaste_fel')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Kunde inte läsa kopplingen' }, { status: 500 });

  return NextResponse.json({
    kopplad: !!data,
    status: data?.status ?? null,
    kopplad_at: data?.kopplad_at ?? null,
    senast_synkad_at: data?.senast_synkad_at ?? null,
    senaste_fel: data?.senaste_fel ?? null,
  });
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  try {
    const result = await synkaZettle(createServerClient(), user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[zettle] synk', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hämtningen misslyckades' }, { status: 500 });
  }
}
