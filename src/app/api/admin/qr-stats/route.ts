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

    const { data, error } = await supabase
      .from('qr_visits')
      .select('code, created_at, funnel_stage, funnel_step, contact_progress, submit_attempts, is_mobile, viewport_h');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const counts: Record<string, number> = {};
    // Per code, how many visits reached each popup stage — lets us see where
    // people drop off (e.g. 40 hit "hook" but only 5 reached "contact").
    const funnels: Record<string, Record<string, number>> = {};

    // Where the qualification loses people: how many stalled on each question,
    // and which question disqualified the ones who failed.
    const stalledOnQuestion: Record<number, number> = {};
    const failedOnQuestion: Record<number, number> = {};

    // Why the contact form loses people: furthest point reached, how many
    // bounced off a failed submit, and how many were on a phone.
    const contactProgress: Record<string, number> = {};
    let contactTotal = 0;
    let contactMobile = 0;
    let contactWithFailedSubmit = 0;
    const contactViewportHeights: number[] = [];

    for (const row of data || []) {
      counts[row.code] = (counts[row.code] || 0) + 1;
      if (row.funnel_stage) {
        funnels[row.code] = funnels[row.code] || {};
        funnels[row.code][row.funnel_stage] = (funnels[row.code][row.funnel_stage] || 0) + 1;
      }

      if (typeof row.funnel_step === 'number') {
        if (row.funnel_stage === 'questions') {
          stalledOnQuestion[row.funnel_step] = (stalledOnQuestion[row.funnel_step] || 0) + 1;
        } else if (row.funnel_stage === 'fail') {
          failedOnQuestion[row.funnel_step] = (failedOnQuestion[row.funnel_step] || 0) + 1;
        }
      }

      // Only the ones who stalled in the form — those who submitted moved on
      // to 'done' and would otherwise drown out the drop-off signal.
      if (row.funnel_stage === 'contact') {
        contactTotal += 1;
        const p = row.contact_progress || 'opened';
        contactProgress[p] = (contactProgress[p] || 0) + 1;
        if (row.is_mobile) contactMobile += 1;
        if ((row.submit_attempts || 0) > 0) contactWithFailedSubmit += 1;
        if (typeof row.viewport_h === 'number') contactViewportHeights.push(row.viewport_h);
      }
    }

    const medianViewportH = contactViewportHeights.length
      ? contactViewportHeights.sort((a, b) => a - b)[Math.floor(contactViewportHeights.length / 2)]
      : null;

    return NextResponse.json({
      counts,
      funnels,
      total: (data || []).length,
      questions: { stalledOn: stalledOnQuestion, failedOn: failedOnQuestion },
      contact: {
        total: contactTotal,
        progress: contactProgress,
        mobile: contactMobile,
        failedSubmit: contactWithFailedSubmit,
        medianViewportH,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
