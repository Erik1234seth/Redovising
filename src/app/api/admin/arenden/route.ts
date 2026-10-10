import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { Arende, AdminMote } from '@/lib/admin-types';

/**
 * Ärenden: att göra-punkter, skapade för hand eller av mail-/SMS-AI:n.
 *
 * GET                      → öppna ärenden, klara de senaste 30 dagarna, och möten
 * POST   { titel, … }      → nytt ärende
 * PATCH  { id, …fält }     → ändra (status 'klar' sätter klar_at)
 * DELETE ?id=              → ta bort
 */

const FALT = 'id, titel, beskrivning, datum, status, person_key, person_namn, kalla, created_at, klar_at';

type Rad = {
  id: string; titel: string; beskrivning: string | null; datum: string | null; status: 'oppen' | 'klar';
  person_key: string | null; person_namn: string | null; kalla: Arende['kalla']; created_at: string; klar_at: string | null;
};

const tillArende = (r: Rad): Arende => ({
  id: r.id, titel: r.titel, beskrivning: r.beskrivning, datum: r.datum, status: r.status,
  personKey: r.person_key, personNamn: r.person_namn, kalla: r.kalla, skapad: r.created_at, klar: r.klar_at,
});

const datumEllerNull = (d: unknown) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const textEllerNull = (t: unknown) => (typeof t === 'string' && t.trim() ? t.trim() : null);

export async function GET() {
  const supabase = createServerClient();
  const manad = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const tvaVeckor = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

  const [oppna, klara, moten] = await Promise.all([
    supabase.from('arenden').select(FALT).eq('status', 'oppen').order('datum', { ascending: true, nullsFirst: false }),
    supabase.from('arenden').select(FALT).eq('status', 'klar').gte('klar_at', manad).order('klar_at', { ascending: false }),
    supabase.from('meetings').select('id, name, email, phone, date, time, message').gte('date', tvaVeckor).order('date').order('time'),
  ]);
  const fel = oppna.error ?? klara.error ?? moten.error;
  if (fel) return NextResponse.json({ error: fel.message }, { status: 500 });

  return NextResponse.json({
    arenden: [...(oppna.data ?? []), ...(klara.data ?? [])].map((r) => tillArende(r as Rad)),
    moten: (moten.data ?? []).map((m): AdminMote => ({
      id: m.id, namn: m.name, email: m.email, telefon: m.phone, datum: m.date, tid: m.time, meddelande: m.message,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const titel = textEllerNull(body.titel);
  if (!titel) return NextResponse.json({ error: 'Titel krävs' }, { status: 400 });

  const { data, error } = await createServerClient().from('arenden').insert({
    titel: titel.slice(0, 200),
    beskrivning: textEllerNull(body.beskrivning),
    datum: datumEllerNull(body.datum),
    person_key: textEllerNull(body.personKey),
    person_namn: textEllerNull(body.personNamn),
    kalla: 'manuell',
  }).select(FALT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ arende: tillArende(data as Rad) });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });

  const andring: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('titel' in body) {
    const titel = textEllerNull(body.titel);
    if (!titel) return NextResponse.json({ error: 'Titel krävs' }, { status: 400 });
    andring.titel = titel.slice(0, 200);
  }
  if ('beskrivning' in body) andring.beskrivning = textEllerNull(body.beskrivning);
  if ('datum' in body) andring.datum = datumEllerNull(body.datum);
  if ('personKey' in body) andring.person_key = textEllerNull(body.personKey);
  if ('personNamn' in body) andring.person_namn = textEllerNull(body.personNamn);
  if ('status' in body) {
    if (body.status !== 'oppen' && body.status !== 'klar') return NextResponse.json({ error: 'Ogiltig status' }, { status: 400 });
    andring.status = body.status;
    andring.klar_at = body.status === 'klar' ? new Date().toISOString() : null;
  }

  const { data, error } = await createServerClient().from('arenden').update(andring).eq('id', body.id).select(FALT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ arende: tillArende(data as Rad) });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });
  const { error } = await createServerClient().from('arenden').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
