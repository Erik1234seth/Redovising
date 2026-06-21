import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/inmail-register?token=xxx&email=xxx
// Validates a registration token and returns the associated email
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  if (!token || !email) {
    return NextResponse.json({ error: 'Saknar token eller email' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('pending_registrations')
    .select('email, expires_at, used_at')
    .eq('token', token)
    .eq('email', email)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Ogiltig eller utgången länk' }, { status: 404 });
  }

  if (data.used_at) {
    return NextResponse.json({ error: 'Den här länken har redan använts' }, { status: 410 });
  }

  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Länken har gått ut' }, { status: 410 });
  }

  return NextResponse.json({ email: data.email, valid: true });
}

// POST /api/inmail-register
// Mark token as used after successful signup
export async function POST(request: Request) {
  const body = await request.json() as { token: string; email: string };
  const { token, email } = body;

  if (!token || !email) {
    return NextResponse.json({ error: 'Saknar token eller email' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from('pending_registrations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .eq('email', email)
    .is('used_at', null);

  if (error) {
    return NextResponse.json({ error: 'Kunde inte uppdatera token' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
