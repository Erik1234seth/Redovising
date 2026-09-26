import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { synkaShopify } from '@/lib/shopify/sync';

/**
 * GET: kundens Shopify-koppling för integrationssidan. Tokens lämnar aldrig servern.
 * POST: hämta nu, i stället för att vänta på morgonens körning.
 */

export const maxDuration = 300;

async function butikFor(userId: string) {
  return createServerClient()
    .from('shopify_butiker')
    .select('shop, status, kopplad_at, senast_synkad_at, senaste_fel')
    .eq('user_id', userId)
    .maybeSingle();
}

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { data, error } = await butikFor(user.id);
  if (error) return NextResponse.json({ error: 'Kunde inte läsa kopplingen' }, { status: 500 });

  return NextResponse.json({
    kopplad: !!data,
    shop: data?.shop ?? null,
    status: data?.status ?? null,
    kopplad_at: data?.kopplad_at ?? null,
    senast_synkad_at: data?.senast_synkad_at ?? null,
    senaste_fel: data?.senaste_fel ?? null,
  });
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { data: butik } = await butikFor(user.id);
  if (!butik) return NextResponse.json({ error: 'Ingen Shopify-butik kopplad' }, { status: 400 });

  try {
    return NextResponse.json(await synkaShopify(createServerClient(), butik.shop));
  } catch (err) {
    console.error('[shopify] synk', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hämtningen misslyckades' }, { status: 500 });
  }
}
