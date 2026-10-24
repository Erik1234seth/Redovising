import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { userFromRequest } from '@/lib/auth-user';
import { TIDIGARE_PRIS_KOD } from '@/lib/tidigare-pris';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Kunden kom in via länken med det tidigare priset. Flaggan på profilen är
// det checkouten och yearly-signup läser — inte något webbläsaren skickar.
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { kod } = await req.json().catch(() => ({}));
  if (kod !== TIDIGARE_PRIS_KOD) return NextResponse.json({ ok: false });

  const { error } = await supabase.from('profiles').update({ tidigare_pris: true }).eq('id', user.id);
  if (error) {
    console.error('[tidigare-pris]', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
