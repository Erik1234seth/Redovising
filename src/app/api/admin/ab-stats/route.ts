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
      .from('funnel_events')
      .select('step, session_id, created_at')
      .like('step', 'ab_popup_%')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const shown = data.filter(e => e.step === 'ab_popup_popup');
    const hidden = data.filter(e => e.step === 'ab_popup_no-popup');
    const clicks = data.filter(e => e.step === 'ab_popup_cta_click');

    // Unique sessions that converted (clicked CTA)
    // Sessions per variant
    const shownSessions = new Set(shown.map(e => e.session_id));
    const hiddenSessions = new Set(hidden.map(e => e.session_id));
    const clickSessions = new Set(clicks.map(e => e.session_id));
    const convertedFromPopup = [...clickSessions].filter(s => shownSessions.has(s)).length;

    // Fetch all funnel_events with step=confirmation to find who ordered
    const { data: orders } = await supabase
      .from('funnel_events')
      .select('session_id')
      .eq('step', 'confirmation');

    // Fetch meetings with session_id
    const { data: meetings } = await supabase
      .from('meetings')
      .select('session_id')
      .not('session_id', 'is', null);

    const meetingSessions = new Set((meetings || []).map((m: { session_id: string }) => m.session_id));
    const bookedWithPopup = [...meetingSessions].filter(s => shownSessions.has(s)).length;
    const bookedWithoutPopup = [...meetingSessions].filter(s => hiddenSessions.has(s)).length;

    const orderSessions = new Set((orders || []).map((e: { session_id: string }) => e.session_id));
    const orderedWithPopup = [...orderSessions].filter(s => shownSessions.has(s)).length;
    const orderedWithoutPopup = [...orderSessions].filter(s => hiddenSessions.has(s)).length;

    return NextResponse.json({
      shown: shown.length,
      hidden: hidden.length,
      clicks: clicks.length,
      conversionRate: shown.length > 0 ? ((convertedFromPopup / shown.length) * 100).toFixed(1) : '0',
      orderedWithPopup,
      orderedWithoutPopup,
      orderConversionWithPopup: shownSessions.size > 0 ? ((orderedWithPopup / shownSessions.size) * 100).toFixed(1) : '0',
      orderConversionWithoutPopup: hiddenSessions.size > 0 ? ((orderedWithoutPopup / hiddenSessions.size) * 100).toFixed(1) : '0',
      bookedWithPopup,
      bookedWithoutPopup,
      recentEvents: data.slice(0, 50),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
