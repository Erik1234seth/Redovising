import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { bearer, exchangeSessionToken, sparaInstallation, verifySessionToken } from '@/lib/shopify/auth';
import { synkaShopify } from '@/lib/shopify/sync';

/**
 * API för appsidan inne i Shopify-admin (/shopify). Anropen bär App Bridges
 * session token, som säger vilken butik det gäller.
 *
 * GET: butikens status. Första gången byts session token mot en access token —
 *      det är så installationen från Shopify avslutas.
 * POST { action: 'kod' }: engångslänk för att koppla butiken till ett konto hos oss.
 * POST { action: 'synka' }: hämta nu.
 * POST { action: 'koppla-bort' }: släpp kopplingen till kontot (appen ligger kvar).
 */

export const maxDuration = 300;

function kopplingsUrl(kod: string) {
  const base = process.env.SHOPIFY_APP_ORIGIN || 'https://app.enklabokslut.se';
  return `${base}/integrationer?shopify=${encodeURIComponent(kod)}`;
}

export async function GET(request: Request) {
  const sessionToken = bearer(request);
  const shop = verifySessionToken(sessionToken);
  if (!shop) return NextResponse.json({ error: 'Ogiltig session' }, { status: 401 });

  const supabase = createServerClient();
  let { data: butik } = await supabase
    .from('shopify_butiker')
    .select('user_id, status, access_token, kopplad_at, senast_synkad_at, senaste_fel')
    .eq('shop', shop)
    .maybeSingle();

  if (!butik?.access_token || butik.status !== 'aktiv') {
    try {
      await sparaInstallation(supabase, shop, await exchangeSessionToken(shop, sessionToken!));
    } catch (err) {
      console.error('[shopify/session] token exchange', err);
      return NextResponse.json({ error: 'Kunde inte slutföra installationen' }, { status: 500 });
    }
    ({ data: butik } = await supabase
      .from('shopify_butiker')
      .select('user_id, status, access_token, kopplad_at, senast_synkad_at, senaste_fel')
      .eq('shop', shop)
      .maybeSingle());
  }

  let email: string | null = null;
  if (butik?.user_id) {
    const { data } = await supabase.auth.admin.getUserById(butik.user_id);
    email = data.user?.email ?? null;
  }

  return NextResponse.json({
    shop,
    kopplad: !!butik?.user_id,
    email,
    kopplad_at: butik?.kopplad_at ?? null,
    senast_synkad_at: butik?.senast_synkad_at ?? null,
    senaste_fel: butik?.senaste_fel ?? null,
  });
}

export async function POST(request: Request) {
  const shop = verifySessionToken(bearer(request));
  if (!shop) return NextResponse.json({ error: 'Ogiltig session' }, { status: 401 });

  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  const supabase = createServerClient();

  if (action === 'kod') {
    const kod = randomBytes(24).toString('base64url');
    await supabase.from('shopify_kopplingskoder').delete().lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const { error } = await supabase.from('shopify_kopplingskoder').insert({ kod, shop });
    if (error) return NextResponse.json({ error: 'Kunde inte skapa kopplingslänken' }, { status: 500 });
    return NextResponse.json({ url: kopplingsUrl(kod) });
  }

  if (action === 'synka') {
    try {
      return NextResponse.json(await synkaShopify(supabase, shop));
    } catch (err) {
      console.error('[shopify/session] synk', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Hämtningen misslyckades' }, { status: 500 });
    }
  }

  if (action === 'koppla-bort') {
    const { error } = await supabase.from('shopify_butiker').update({ user_id: null, kopplad_at: null }).eq('shop', shop);
    if (error) return NextResponse.json({ error: 'Kunde inte koppla bort' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Okänd åtgärd' }, { status: 400 });
}
