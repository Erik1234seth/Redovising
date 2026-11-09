import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { osakraAttFraga, skrivOsakraMejl } from '@/lib/transaktioner/fragemejl';

/**
 * Mejlet om osäkra i Flöde (@/lib/transaktioner/fragemejl): ett samlat mejl
 * till kunden om de gula konteringar byrån inte godkänt.
 *
 *   GET  ?userId=   hur många som är osäkra (fragade: hur många av dem som redan varit med
 *                   i ett skickat mejl), och ett oskickat utkast om dem om det finns
 *   POST { userId } skriver mejlet. Det blir ett utkast som skickas med Skicka i
 *                   Flöde (/api/admin/inkorg, action skicka-mejl).
 */

export const maxDuration = 300;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function fel(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[admin/osakra-mejl]', message);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return fel('userId saknas', 400);
  const supabase = getSupabase();
  try {
    const rader = await osakraAttFraga(supabase, userId);
    const utkastIds = [...new Set(rader.map((t) => t.fraga_utkast_id).filter(Boolean))] as string[];
    const { data: utkast, error } = utkastIds.length
      ? await supabase.from('mejl_utkast').select('id, till_email, amne, text, created_at').in('id', utkastIds).eq('status', 'draft')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null, error: null };
    if (error) throw new Error(error.message);
    // Transaktioner som redan ligger i utkastet räknas inte som nya
    const nya = rader.filter((t) => !utkast || t.fraga_utkast_id !== utkast.id).length;
    return NextResponse.json({
      antal: rader.length,
      nya,
      // Redan med i ett skickat mejl utan att ha lösts — kunden kan ha missat frågan
      fragade: rader.filter((t) => t.fragad).length,
      utkast: utkast ? { id: utkast.id, till: utkast.till_email, amne: utkast.amne ?? '', text: utkast.text } : null,
    });
  } catch (err) {
    return fel(err);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { userId?: string };
  if (!body.userId) return fel('userId saknas', 400);
  try {
    const r = await skrivOsakraMejl(getSupabase(), body.userId);
    if (!r) return fel('Inga osäkra transaktioner att fråga om', 400);
    return NextResponse.json({ utkast: { id: r.utkastId, till: r.till, amne: r.amne, text: r.text }, antal: r.antal });
  } catch (err) {
    return fel(err);
  }
}
