import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  const { data } = await supabase
    .from('subscriptions')
    .select('status, billing_period, current_period_end, price_id')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ subscription: data ?? null });
}
