import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Coarse popup stages we care about — mirrors AdFunnel's `Stage` type.
const STAGES = ['hook', 'how', 'questions', 'contact', 'done', 'fail'];

// How far into the contact form a visitor got before leaving. Ordered, but the
// client is what enforces the ordering — the server only checks membership.
const CONTACT_PROGRESS = ['opened', 'name', 'email', 'method', 'phone', 'notes'];

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

// Updates how far a visitor got in the popup funnel, for a visit already logged
// via POST. Every field is optional — the client sends whichever signal changed,
// and anything unrecognised is dropped rather than written.
export async function PATCH(request: NextRequest) {
  try {
    const { id, stage, step, contactProgress, submitAttempts, isMobile, viewportH } = await request.json();

    if (!id) return NextResponse.json({ ok: true });

    const update: Record<string, unknown> = {};

    if (typeof stage === 'string' && STAGES.includes(stage)) {
      update.funnel_stage = stage;
      update.funnel_stage_at = new Date().toISOString();
    }
    if (Number.isInteger(step) && step >= 0 && step < 50) {
      update.funnel_step = step;
    }
    if (typeof contactProgress === 'string' && CONTACT_PROGRESS.includes(contactProgress)) {
      update.contact_progress = contactProgress;
    }
    // The client sends a running total rather than a "+1", so a retried or
    // duplicated request can't inflate the count.
    if (Number.isInteger(submitAttempts) && submitAttempts >= 0 && submitAttempts < 100) {
      update.submit_attempts = submitAttempts;
    }
    if (typeof isMobile === 'boolean') {
      update.is_mobile = isMobile;
    }
    if (Number.isInteger(viewportH) && viewportH > 0 && viewportH < 20000) {
      update.viewport_h = viewportH;
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

    const supabase = getSupabase();
    await supabase.from('qr_visits').update(update).eq('id', id);

    return NextResponse.json({ ok: true });
  } catch {
    // Silent fail - never block the user
    return NextResponse.json({ ok: true });
  }
}
