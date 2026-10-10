import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Det översikten behöver som inte redan finns i andra routes: kunderna som
 * väntar på att vi lägger in ombudsuppgifterna. Resten (inkorg, ärenden,
 * inlämning, leads) hämtar sidan från sina egna routes.
 */
export async function GET() {
  const { data, error } = await createServerClient()
    .from('profiles')
    .select('id, full_name, company_name, email, created_at')
    .is('ombud_klart_at', null)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    saknarOmbud: (data ?? []).map((p) => ({
      profileId: p.id,
      namn: p.full_name?.trim() || p.company_name?.trim() || p.email || 'Okänd',
      email: p.email,
      sedan: p.created_at,
    })),
  });
}
