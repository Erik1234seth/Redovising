import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { authorizeUrl, encrypt, normaliseraUrl, wooGet, WooFel } from '@/lib/woocommerce/api';

/**
 * POST { url }: startar kopplingen — sparar en state och svarar med adressen
 * till godkännandet i kundens WordPress, dit appen skickar kunden.
 *
 * POST { url, key, secret }: kunden har skapat en nyckel själv. Den provas mot
 * butiken innan den sparas.
 *
 * DELETE: kopplar bort butiken. Ordrar som redan hämtats ligger kvar.
 */

const FEL_ADRESS = 'Skriv butikens adress med https, t.ex. https://dinbutik.se';

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { url?: string; key?: string; secret?: string };
  const url = normaliseraUrl(body.url ?? '');
  if (!url) return NextResponse.json({ error: FEL_ADRESS }, { status: 400 });
  const supabase = createServerClient();

  if (body.key || body.secret) {
    const key = body.key?.trim() ?? '';
    const secret = body.secret?.trim() ?? '';
    if (!key.startsWith('ck_') || !secret.startsWith('cs_')) {
      return NextResponse.json({ error: 'Nyckeln börjar med ck_ och hemligheten med cs_' }, { status: 400 });
    }
    try {
      await wooGet({ url, key, secret }, '/orders', { per_page: '1' });
    } catch (err) {
      return NextResponse.json({ error: err instanceof WooFel ? err.message : 'Kunde inte prova nyckeln' }, { status: 400 });
    }
    const { error } = await supabase.from('woocommerce_butiker').upsert({
      user_id: user.id,
      url,
      consumer_key: encrypt(key),
      consumer_secret: encrypt(secret),
      status: 'aktiv',
      kopplad_at: new Date().toISOString(),
      synkad_till: null,
      senaste_fel: null,
    });
    if (error) return NextResponse.json({ error: 'Kunde inte spara kopplingen' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const state = randomBytes(24).toString('base64url');
  await supabase.from('woocommerce_states').delete().lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const { error } = await supabase.from('woocommerce_states').insert({ state, user_id: user.id, url });
  if (error) return NextResponse.json({ error: 'Kunde inte starta kopplingen' }, { status: 500 });

  return NextResponse.json({ url: authorizeUrl(url, state) });
}

export async function DELETE(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { error } = await createServerClient().from('woocommerce_butiker').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Kunde inte koppla bort WooCommerce' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
