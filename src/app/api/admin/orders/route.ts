import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, table } = await req.json();
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });
    const allowedTables = ['orders', 'contact_requests'];
    const targetTable = allowedTables.includes(table) ? table : 'orders';
    const supabase = getSupabase();
    const { error } = await supabase.from(targetTable).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });
    const supabase = getSupabase();
    const { error } = await supabase.from('orders').update(fields).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabase();
    const { data, error } = await supabase.from('orders').insert([body]).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ order: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = getSupabase();

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

    // Fetch contact requests
    const { data: contactRequests } = await supabase
      .from('contact_requests')
      .select('id, email, phone, package_type, created_at, stage, name')
      .order('created_at', { ascending: false });

    return NextResponse.json({ orders: orders || [], stepCounts, contactRequests: contactRequests || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
