import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { step, packageType, bank, sessionId, userId } = await request.json();

    if (!step || !sessionId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabase.from('funnel_events').insert({
      session_id: sessionId,
      user_id: userId || null,
      step,
      package_type: packageType || null,
      bank: bank || null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Silent fail - never block the user
    return NextResponse.json({ ok: true });
  }
}
