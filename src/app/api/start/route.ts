import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { arsoversikt, bankoversikt, checklista } from '@/lib/startsida';

/**
 * GET: allt startsidan visar — checklistan, bankkontona med de senast
 * kopplade raderna, och året hittills ur huvudboken.
 * POST { ombud: true }: kunden har lagt in oss som ombud hos Skatteverket.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  try {
    const [lista, bank, ar] = await Promise.all([
      checklista(supabase, user.id),
      bankoversikt(supabase, user.id),
      arsoversikt(supabase, user.id),
    ]);
    return NextResponse.json({ checklista: lista, ...bank, ar });
  } catch (err) {
    console.error('[start]', err);
    return NextResponse.json({ error: 'Kunde inte läsa översikten' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.ombud !== true) return NextResponse.json({ error: 'Okänd ändring' }, { status: 400 });
  const { error } = await createServerClient()
    .from('profiles').update({ ombud_klart_at: new Date().toISOString() }).eq('id', user.id).is('ombud_klart_at', null);
  if (error) return NextResponse.json({ error: 'Kunde inte spara' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
