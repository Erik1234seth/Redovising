import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Ändrade texter för stegen i flödesschemat. Stegen och pilarna ligger i
 * koden — här sparas bara det man skrivit om i beskrivning och "finns i systemet".
 *
 * GET                               → { texter: { [stegId]: { beskrivning, finns } } }
 * PUT { id, beskrivning, finns }    → sparar texterna för ett steg
 */

export async function GET() {
  const { data, error } = await createServerClient().from('flodesschema_texter').select('steg_id, beskrivning, finns');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    texter: Object.fromEntries((data ?? []).map((r) => [r.steg_id, { beskrivning: r.beskrivning, finns: r.finns }])),
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Steg saknas' }, { status: 400 });
  const text = (t: unknown) => (typeof t === 'string' ? t.trim().slice(0, 2000) : '');

  const { error } = await createServerClient().from('flodesschema_texter').upsert({
    steg_id: body.id,
    beskrivning: text(body.beskrivning),
    finns: text(body.finns),
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
