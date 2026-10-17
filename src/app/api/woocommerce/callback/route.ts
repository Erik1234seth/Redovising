import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { encrypt } from '@/lib/woocommerce/api';

/**
 * Hit skickar kundens WooCommerce den nya API-nyckeln när kunden godkänt
 * kopplingen. Det är butikens server som anropar, inte kunden — kunden skickas
 * sedan vidare till return_url (integrationssidan).
 *
 * user_id är staten vi skickade med; den säger vilket konto och vilken
 * butiksadress nyckeln hör till.
 */

const STATE_MAX_AGE_MS = 30 * 60 * 1000;

export async function POST(request: Request) {
  const text = await request.text();
  let body: { user_id?: string; consumer_key?: string; consumer_secret?: string; key_permissions?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Äldre versioner kan skicka formulärdata
    body = Object.fromEntries(new URLSearchParams(text));
  }

  const { user_id: state, consumer_key: key, consumer_secret: secret } = body;
  if (!state || !key || !secret) return NextResponse.json({ error: 'Uppgifter saknas' }, { status: 400 });

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from('woocommerce_states')
    .delete()
    .eq('state', state)
    .select('user_id, url, created_at')
    .maybeSingle();
  if (!row || Date.now() - new Date(row.created_at).getTime() > STATE_MAX_AGE_MS) {
    return NextResponse.json({ error: 'Okänd eller för gammal koppling' }, { status: 400 });
  }

  const { error } = await supabase.from('woocommerce_butiker').upsert({
    user_id: row.user_id,
    url: row.url,
    consumer_key: encrypt(key),
    consumer_secret: encrypt(secret),
    status: 'aktiv',
    kopplad_at: new Date().toISOString(),
    synkad_till: null,
    senaste_fel: null,
  });
  if (error) {
    console.error('[woocommerce/callback]', error.message);
    return NextResponse.json({ error: 'Kunde inte spara nyckeln' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
