import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { exchangeCode, isValidShop, sparaInstallation, verifyQueryHmac } from '@/lib/shopify/auth';

/**
 * Hit skickar Shopify tillbaka kunden efter godkännandet, när installationen
 * startades från vår integrationssida. Frågesträngen är signerad av Shopify
 * och staten säger vilket konto butiken ska kopplas till.
 */

const STATE_MAX_AGE_MS = 30 * 60 * 1000;

function tillbaka(request: Request, resultat: string) {
  // På app-domänen skriver middleware om /integrationer till /app/integrationer
  const url = new URL(request.url);
  const path = url.hostname.startsWith('app.') ? '/integrationer' : '/app/integrationer';
  return NextResponse.redirect(new URL(`${path}?shopify_resultat=${resultat}`, url));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const shop = params.get('shop');

  if (!code || !state) return tillbaka(request, 'avbruten');
  if (!isValidShop(shop) || !verifyQueryHmac(params)) return tillbaka(request, 'fel');

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from('shopify_oauth_states')
    .delete()
    .eq('state', state)
    .select('user_id, shop, created_at')
    .maybeSingle();
  if (!row || row.shop !== shop || Date.now() - new Date(row.created_at).getTime() > STATE_MAX_AGE_MS) {
    return tillbaka(request, 'fel');
  }

  try {
    await sparaInstallation(supabase, shop, await exchangeCode(shop, code), row.user_id);
  } catch (err) {
    console.error('[shopify/callback]', err);
    return tillbaka(request, 'fel');
  }

  return tillbaka(request, 'kopplad');
}
