import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('EMAIL WEBHOOK RECEIVED:', JSON.stringify(body, null, 2));

    const supabase = getSupabase();
    await supabase.from('webhook_logs').insert({ payload: body });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Email webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
