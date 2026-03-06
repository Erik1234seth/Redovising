import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from('meetings')
    .select('date, time');

  if (error) return NextResponse.json({ slots: [] });

  const slots: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!slots[row.date]) slots[row.date] = [];
    slots[row.date].push(row.time);
  }

  return NextResponse.json({ slots });
}
