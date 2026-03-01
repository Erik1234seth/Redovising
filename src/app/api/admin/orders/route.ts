import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch orders with profile info
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        package_type,
        bank,
        status,
        created_at,
        guest_email,
        guest_name,
        guest_phone,
        guest_company,
        user_id,
        profiles (
          email,
          full_name,
          phone
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch funnel stats
    const { data: funnelData } = await supabase
      .from('funnel_events')
      .select('step, package_type');

    // Count unique sessions per step
    const { data: funnelSessions } = await supabase
      .from('funnel_events')
      .select('step, session_id, package_type');

    const stepCounts: Record<string, number> = {};
    if (funnelSessions) {
      // Count unique sessions per step
      const stepSessionMap: Record<string, Set<string>> = {};
      for (const row of funnelSessions) {
        if (!stepSessionMap[row.step]) stepSessionMap[row.step] = new Set();
        stepSessionMap[row.step].add(row.session_id);
      }
      for (const [step, sessions] of Object.entries(stepSessionMap)) {
        stepCounts[step] = sessions.size;
      }
    }

    return NextResponse.json({ orders: orders || [], stepCounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
