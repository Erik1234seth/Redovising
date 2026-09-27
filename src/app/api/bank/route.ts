import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { synkaBank } from '@/lib/bank/sync';

/**
 * GET: kundens bankkopplingar, konton och de senaste transaktionerna.
 * POST: hämta nu, i stället för att vänta på morgonens körning.
 */

export const maxDuration = 300;

export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  const [kopplingar, konton, senaste] = await Promise.all([
    supabase
      .from('bank_kopplingar')
      .select('session_id, aspsp_name, status, giltig_till, kopplad_at, senast_synkad_at, senaste_fel')
      .eq('user_id', user.id)
      .order('kopplad_at'),
    supabase.from('bank_konton').select('konto_hash, session_id, iban, namn, valuta').eq('user_id', user.id),
    supabase
      .from('bank_transaktioner')
      .select('transaktion_id, bokforingsdag, belopp_ore, valuta, text, motpart')
      .eq('user_id', user.id)
      .order('bokforingsdag', { ascending: false })
      .limit(10),
  ]);
  if (kopplingar.error || konton.error || senaste.error) {
    return NextResponse.json({ error: 'Kunde inte läsa bankkopplingen' }, { status: 500 });
  }

  return NextResponse.json({
    kopplingar: (kopplingar.data ?? []).map((k) => ({
      ...k,
      konton: (konton.data ?? []).filter((a) => a.session_id === k.session_id),
    })),
    senaste: senaste.data ?? [],
  });
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  try {
    return NextResponse.json(await synkaBank(createServerClient(), user.id));
  } catch (err) {
    console.error('[bank] synk', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hämtningen misslyckades' }, { status: 500 });
  }
}
