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

    const [threadsRes, prospectsRes] = await Promise.all([
      supabase
        .from('email_threads')
        .select('id, gmail_thread_id, user_id, state, transaction_ids, created_at, updated_at, profiles(email, full_name)')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('pending_registrations')
        .select('id, email, source, created_at, expires_at, used_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (threadsRes.error) return NextResponse.json({ error: threadsRes.error.message }, { status: 500 });
    if (prospectsRes.error) return NextResponse.json({ error: prospectsRes.error.message }, { status: 500 });

    return NextResponse.json({
      threads: threadsRes.data ?? [],
      prospects: prospectsRes.data ?? [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
