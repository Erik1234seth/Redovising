import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { accessTokenFor, authorizeUrl, avinstallera, markeraAvinstallerad, normaliseraShop } from '@/lib/shopify/auth';

/**
 * POST { shop }: startar installationen från vår sida — sparar en state och
 * svarar med adressen till Shopifys godkännande, dit appen skickar kunden.
 *
 * DELETE: kopplar bort butiken och avinstallerar appen. Redan bokförda
 * dagskassor ligger kvar — de är en del av kundens bokföring.
 */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { shop: input } = (await request.json().catch(() => ({}))) as { shop?: string };
  const shop = normaliseraShop(input ?? '');
  if (!shop) return NextResponse.json({ error: 'Skriv butikens adress, t.ex. din-butik.myshopify.com' }, { status: 400 });

  const supabase = createServerClient();
  const state = randomBytes(24).toString('base64url');
  await supabase.from('shopify_oauth_states').delete().lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const { error } = await supabase.from('shopify_oauth_states').insert({ state, user_id: user.id, shop });
  if (error) return NextResponse.json({ error: 'Kunde inte starta kopplingen' }, { status: 500 });

  try {
    return NextResponse.json({ url: authorizeUrl(shop, state) });
  } catch (err) {
    console.error('[shopify/koppla]', err);
    return NextResponse.json({ error: 'Shopify-kopplingen är inte konfigurerad' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  const { data: butik } = await supabase.from('shopify_butiker').select('shop').eq('user_id', user.id).maybeSingle();
  if (!butik) return NextResponse.json({ ok: true });

  const token = await accessTokenFor(supabase, butik.shop).catch(() => null);
  if (token) await avinstallera(butik.shop, token);
  await markeraAvinstallerad(supabase, butik.shop);

  const { error } = await supabase.from('shopify_butiker').update({ user_id: null, kopplad_at: null }).eq('shop', butik.shop);
  if (error) return NextResponse.json({ error: 'Kunde inte koppla bort Shopify' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
