import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Coarse popup stages we care about — mirrors AdFunnel's `Stage` type.
const STAGES = ['hook', 'how', 'questions', 'contact', 'done', 'fail'];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Logs a QR-code/ad landing, or a popup impression (with its starting stage).
// Fire-and-forget from the landing page.
export async function POST(request: NextRequest) {
  try {
    const { ref, stage } = await request.json();

    // Basic sanity: only short, simple codes (e.g. "brev-a")
    if (!ref || typeof ref !== 'string' || ref.length > 40) {
      return NextResponse.json({ ok: true });
    }
    const code = ref.trim().toLowerCase().slice(0, 40);
    const funnelStage = typeof stage === 'string' && STAGES.includes(stage) ? stage : null;

    const supabase = getSupabase();

    const { data } = await supabase
      .from('qr_visits')
      .insert({
        code,
        funnel_stage: funnelStage,
        funnel_stage_at: funnelStage ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch {
    // Silent fail - never block the user
    return NextResponse.json({ ok: true });
  }
}

// Updates how far a visitor got in the popup funnel, for a visit already logged via POST.
export async function PATCH(request: NextRequest) {
  try {
    const { id, stage } = await request.json();

    if (!id || typeof stage !== 'string' || !STAGES.includes(stage)) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabase();
    await supabase
      .from('qr_visits')
      .update({ funnel_stage: stage, funnel_stage_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ ok: true });
  } catch {
    // Silent fail - never block the user
    return NextResponse.json({ ok: true });
  }
}
