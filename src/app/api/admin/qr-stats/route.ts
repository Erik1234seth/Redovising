import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('qr_visits')
      .select('code, created_at, funnel_stage');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const counts: Record<string, number> = {};
    // Per code, how many visits reached each popup stage — lets us see where
    // people drop off (e.g. 40 hit "hook" but only 5 reached "contact").
    const funnels: Record<string, Record<string, number>> = {};
    for (const row of data || []) {
      counts[row.code] = (counts[row.code] || 0) + 1;
      if (row.funnel_stage) {
        funnels[row.code] = funnels[row.code] || {};
        funnels[row.code][row.funnel_stage] = (funnels[row.code][row.funnel_stage] || 0) + 1;
      }
    }

    return NextResponse.json({ counts, funnels, total: (data || []).length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
