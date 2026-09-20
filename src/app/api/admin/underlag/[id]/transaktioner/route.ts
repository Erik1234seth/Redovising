import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { lasUtTransaktioner } from '@/lib/transaktioner/import';

/**
 * Läser ut transaktionerna ur ett underlag med AI.
 *
 * En fil per anrop, med flit: klienten kör filerna en i taget och kan visa
 * vilken som är på tur. Ett kontoutdrag på tjugo sidor tar en stund, och en
 * hel hög i samma anrop skulle slå i Vercels tak och ta med sig de filer som
 * redan gått bra.
 */

export const maxDuration = 300;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await lasUtTransaktioner(getSupabase(), id);
    return NextResponse.json({ ok: !result.fel, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/underlag/transaktioner]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
