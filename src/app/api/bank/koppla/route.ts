import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { avslutaSession, listaBanker, startaAuth } from '@/lib/bank/enablebanking';

/**
 * POST { bank, psu_type } startar kopplingen: sparar en engångsnyckel (state)
 * och svarar med adressen till bankens inloggning.
 *
 * DELETE { session_id } kopplar bort banken. Redan hämtade transaktioner ligger kvar.
 */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const psuType = body.psu_type === 'personal' ? 'personal' : 'business';

  try {
    const aspsp = (await listaBanker('SE')).find((b) => b.name === body.bank);
    if (!aspsp) return NextResponse.json({ error: 'Välj en bank i listan' }, { status: 400 });
    if (aspsp.psu_types?.length && !aspsp.psu_types.includes(psuType)) {
      const som = psuType === 'business' ? 'företag' : 'privatperson';
      return NextResponse.json({ error: `${aspsp.name} går inte att koppla som ${som}` }, { status: 400 });
    }

    const supabase = createServerClient();
    const state = randomBytes(24).toString('base64url');
    await supabase.from('bank_oauth_states').delete().lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const { error } = await supabase
      .from('bank_oauth_states')
      .insert({ state, user_id: user.id, aspsp_name: aspsp.name, aspsp_country: aspsp.country });
    if (error) return NextResponse.json({ error: 'Kunde inte starta kopplingen' }, { status: 500 });

    return NextResponse.json({ url: await startaAuth({ aspsp, psuType, state }) });
  } catch (err) {
    console.error('[bank/koppla]', err);
    return NextResponse.json({ error: 'Kunde inte starta bankkopplingen' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { session_id } = await request.json().catch(() => ({}));
  const supabase = createServerClient();
  const { data } = await supabase
    .from('bank_kopplingar')
    .delete()
    .eq('user_id', user.id)
    .eq('session_id', session_id ?? '')
    .select('session_id')
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Kopplingen finns inte' }, { status: 404 });

  await avslutaSession(data.session_id);
  return NextResponse.json({ ok: true });
}
