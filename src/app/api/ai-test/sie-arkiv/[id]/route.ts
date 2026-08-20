import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * En enskild sparad SIE4-fil.
 *
 *   GET    – hela tolkningen, för att öppna filen i SIE4-fliken igen
 *   PATCH  – uppdaterar anteckningen
 *   DELETE – tar bort raden
 */

export const runtime = 'nodejs';

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'AI-testet är bara tillgängligt lokalt' }, { status: 404 });
  }
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('sie_files')
      .select(
        'id, created_at, filnamn, storlek_bytes, teckenkodning, anteckning, kund_id, tolkning, ' +
          'kund:kund_id (id, company_name, full_name, email)'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Filen finns inte' }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in GET /api/ai-test/sie-arkiv/[id]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const { id } = await params;
    const body = await request.json();

    // Bara de fält som faktiskt skickas med uppdateras — så att kundkopplingen
    // inte nollas när man bara sparar en anteckning, och tvärtom.
    const uppdatering: { anteckning?: string | null; kund_id?: string | null } = {};
    if ('anteckning' in body) {
      uppdatering.anteckning = typeof body.anteckning === 'string' ? body.anteckning.trim() || null : null;
    }
    if ('kundId' in body) {
      uppdatering.kund_id = typeof body.kundId === 'string' && body.kundId ? body.kundId : null;
    }

    if (Object.keys(uppdatering).length === 0) {
      return NextResponse.json({ error: 'Inget att uppdatera' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('sie_files')
      .update(uppdatering)
      .eq('id', id)
      .select('id, anteckning, kund_id, kund:kund_id (id, company_name, full_name, email)')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, fil: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in PATCH /api/ai-test/sie-arkiv/[id]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { error } = await supabase.from('sie_files').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in DELETE /api/ai-test/sie-arkiv/[id]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
