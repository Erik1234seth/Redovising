import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Ändrade texter för stegen i flödesschemat, och anteckningarna under det.
 * Stegen och pilarna ligger i koden — här sparas bara det man skrivit om i
 * beskrivning och "finns i systemet", och om steget är klart.
 *
 * GET                                 → { texter: { [stegId]: { beskrivning, finns, status } }, anteckningar }
 * PUT { id, beskrivning, finns, status } → sparar texterna för ett steg (status null = som i koden)
 * POST { rubrik, text }               → ny anteckning
 * PATCH { anteckning, rubrik, text }  → ändrar en anteckning
 * DELETE { anteckning }               → tar bort en anteckning
 */

const STATUS = ['klar', 'delvis', 'inte'];
const text = (t: unknown, max = 2000) => (typeof t === 'string' ? t.trim().slice(0, max) : '');

export async function GET() {
  const supabase = createServerClient();
  const [texter, anteckningar] = await Promise.all([
    supabase.from('flodesschema_texter').select('steg_id, beskrivning, finns, status'),
    supabase.from('flodesschema_anteckningar').select('id, rubrik, text, created_at, updated_at').order('created_at'),
  ]);
  const fel = texter.error ?? anteckningar.error;
  if (fel) return NextResponse.json({ error: fel.message }, { status: 500 });
  return NextResponse.json({
    texter: Object.fromEntries((texter.data ?? []).map((r) => [r.steg_id, { beskrivning: r.beskrivning, finns: r.finns, status: r.status }])),
    anteckningar: (anteckningar.data ?? []).map((a) => ({ id: a.id, rubrik: a.rubrik, text: a.text, at: a.updated_at })),
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Steg saknas' }, { status: 400 });

  const { error } = await createServerClient().from('flodesschema_texter').upsert({
    steg_id: body.id,
    beskrivning: text(body.beskrivning),
    finns: text(body.finns),
    status: STATUS.includes(body.status) ? body.status : null,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { data, error } = await createServerClient().from('flodesschema_anteckningar')
    .insert({ rubrik: text(body.rubrik, 200), text: text(body.text, 20000) })
    .select('id, rubrik, text, updated_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ anteckning: { id: data.id, rubrik: data.rubrik, text: data.text, at: data.updated_at } });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.anteckning !== 'string' || !body.anteckning) return NextResponse.json({ error: 'Anteckning saknas' }, { status: 400 });
  const at = new Date().toISOString();
  const { error } = await createServerClient().from('flodesschema_anteckningar')
    .update({ rubrik: text(body.rubrik, 200), text: text(body.text, 20000), updated_at: at })
    .eq('id', body.anteckning);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, at });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.anteckning !== 'string' || !body.anteckning) return NextResponse.json({ error: 'Anteckning saknas' }, { status: 400 });
  const { error } = await createServerClient().from('flodesschema_anteckningar').delete().eq('id', body.anteckning);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
