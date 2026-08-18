import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const [messagesRes, optoutsRes] = await Promise.all([
      supabase
        .from('sms_messages')
        .select('id, phone, direction, body, status, error, user_id, created_at, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('sms_optouts').select('phone, created_at').order('created_at', { ascending: false }),
    ]);

    if (messagesRes.error) {
      return NextResponse.json({ error: messagesRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      messages: messagesRes.data ?? [],
      optouts: optoutsRes.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
