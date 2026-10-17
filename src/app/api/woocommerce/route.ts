import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { WooFel } from '@/lib/woocommerce/api';
import { synkaWoo } from '@/lib/woocommerce/sync';

/**
 * GET: kundens WooCommerce-koppling för integrationssidan. Nycklarna lämnar aldrig servern.
 * POST: hämta nu, i stället för att vänta på morgonens körning.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { data, error } = await createServerClient()
    .from('woocommerce_butiker')
    .select('url, status, kopplad_at, senast_synkad_at, senaste_fel')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Kunde inte läsa kopplingen' }, { status: 500 });

  return NextResponse.json({
    kopplad: !!data,
    url: data?.url ?? null,
    kopplad_at: data?.kopplad_at ?? null,
    senast_synkad_at: data?.senast_synkad_at ?? null,
    senaste_fel: data?.senaste_fel ?? null,
  });
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  try {
    return NextResponse.json(await synkaWoo(createServerClient(), user.id));
  } catch (err) {
    if (!(err instanceof WooFel)) console.error('[woocommerce] synk', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hämtningen misslyckades' }, { status: err instanceof WooFel ? 400 : 500 });
  }
}
