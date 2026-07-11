import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Logs a QR-code landing visit. Fire-and-forget from the landing page.
export async function POST(request: NextRequest) {
  try {
    const { ref } = await request.json();

    // Basic sanity: only short, simple codes (e.g. "brev-a")
    if (!ref || typeof ref !== 'string' || ref.length > 40) {
      return NextResponse.json({ ok: true });
    }
    const code = ref.trim().toLowerCase().slice(0, 40);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabase.from('qr_visits').insert({ code });

    return NextResponse.json({ ok: true });
  } catch {
    // Silent fail - never block the user
    return NextResponse.json({ ok: true });
  }
}
