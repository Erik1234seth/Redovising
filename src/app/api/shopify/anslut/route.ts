import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';

/**
 * POST { kod }: kopplar en butik som installerats från Shopify till den
 * inloggade kunden. Koden kommer från appsidan inne i Shopify-admin och kan
 * bara användas en gång.
 */

const KOD_MAX_AGE_MS = 30 * 60 * 1000;

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const { kod } = (await request.json().catch(() => ({}))) as { kod?: string };
  if (!kod) return NextResponse.json({ error: 'Kod saknas' }, { status: 400 });

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from('shopify_kopplingskoder')
    .delete()
    .eq('kod', kod)
    .select('shop, created_at')
    .maybeSingle();
  if (!row || Date.now() - new Date(row.created_at).getTime() > KOD_MAX_AGE_MS) {
    return NextResponse.json({ error: 'Länken har gått ut. Öppna appen i Shopify och försök igen.' }, { status: 400 });
  }

  // En kund har en butik: en tidigare butik på samma konto släpps
  await supabase.from('shopify_butiker').update({ user_id: null, kopplad_at: null }).eq('user_id', user.id).neq('shop', row.shop);
  const { error } = await supabase
    .from('shopify_butiker')
    .update({ user_id: user.id, kopplad_at: new Date().toISOString() })
    .eq('shop', row.shop);
  if (error) return NextResponse.json({ error: 'Kunde inte koppla butiken' }, { status: 500 });

  return NextResponse.json({ ok: true, shop: row.shop });
}
