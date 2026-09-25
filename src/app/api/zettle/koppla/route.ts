import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { accessTokenFor, authorizeUrl, disconnect } from '@/lib/zettle/oauth';

/**
 * POST startar kopplingen: sparar en engångsnyckel (state) och svarar med
 * adressen till Zettles inloggning, dit appen skickar kunden.
 *
 * DELETE kopplar bort kontot. Redan hämtad data och bokförda dagskassor ligger
 * kvar — de är en del av kundens bokföring.
 */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  const state = randomBytes(24).toString('base64url');

  // Gamla, aldrig använda nycklar städas bort i samma veva
  await supabase.from('zettle_oauth_states').delete().lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const { error } = await supabase.from('zettle_oauth_states').insert({ state, user_id: user.id });
  if (error) return NextResponse.json({ error: 'Kunde inte starta kopplingen' }, { status: 500 });

  try {
    return NextResponse.json({ url: authorizeUrl(state) });
  } catch (err) {
    console.error('[zettle/koppla]', err);
    return NextResponse.json({ error: 'Zettle-kopplingen är inte konfigurerad' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  const token = await accessTokenFor(supabase, user.id).catch(() => null);
  if (token) await disconnect(token);

  const { error } = await supabase.from('zettle_kopplingar').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Kunde inte koppla bort Zettle' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
