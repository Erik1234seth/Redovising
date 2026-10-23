import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { INSTRUKTION_STEG, KOLUMNER } from '@/lib/transaktioner/instruktioner';

/**
 * Byråns kontext och regler, skrivna på ett steg när man följer ett underlag.
 * Se `@/lib/transaktioner/instruktioner`.
 *
 * POST { underlag, steg, typ, omfang, transaktion?, text, namn?, galler? } → { instruktion }
 *      Kund och underlag tas från underlaget, så det går inte att skriva på fel kund.
 * DELETE { id }
 */

const OMFANG = { kontext: ['transaktion', 'underlag', 'kund', 'alla'], regel: ['kund', 'alla'] } as const;
const text = (t: unknown, max = 4000) => (typeof t === 'string' ? t.trim().slice(0, max) : '');

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const typ = body.typ === 'regel' ? 'regel' : body.typ === 'kontext' ? 'kontext' : null;
  if (!typ) return NextResponse.json({ error: 'Välj kontext eller regel' }, { status: 400 });
  if (!(OMFANG[typ] as readonly string[]).includes(body.omfang)) return NextResponse.json({ error: 'Välj vad det gäller' }, { status: 400 });
  if (!INSTRUKTION_STEG.includes(body.steg)) return NextResponse.json({ error: 'Det steget tar inga instruktioner' }, { status: 400 });
  const innehall = text(body.text);
  if (!innehall) return NextResponse.json({ error: typ === 'regel' ? 'Skriv vad AI:n ska göra' : 'Skriv kontexten' }, { status: 400 });
  if (typ === 'regel' && !text(body.galler)) return NextResponse.json({ error: 'Skriv när regeln gäller' }, { status: 400 });

  const supabase = createServerClient();
  const { data: u } = await supabase.from('bokforing_underlag').select('id, user_id').eq('id', String(body.underlag ?? '')).maybeSingle();
  if (!u) return NextResponse.json({ error: 'Underlaget finns inte' }, { status: 400 });
  if (body.omfang === 'kund' && !u.user_id) return NextResponse.json({ error: 'Underlaget hör inte till något kundkonto' }, { status: 400 });

  let transaktion: string | null = null;
  if (body.omfang === 'transaktion') {
    const { data: t } = await supabase.from('transaktioner').select('id, underlag_id').eq('id', String(body.transaktion ?? '')).maybeSingle();
    if (!t || t.underlag_id !== u.id) return NextResponse.json({ error: 'Välj en av underlagets transaktioner' }, { status: 400 });
    transaktion = t.id;
  }

  const { data, error } = await supabase.from('flodes_instruktioner').insert({
    typ,
    omfang: body.omfang,
    steg: body.steg,
    // Allt utom det som gäller alla kunder hör till kunden, så att det hittas på kunden
    user_id: body.omfang === 'alla' ? null : u.user_id,
    underlag_id: body.omfang === 'underlag' || body.omfang === 'transaktion' ? u.id : null,
    transaktion_id: transaktion,
    namn: typ === 'regel' ? text(body.namn, 200) || null : null,
    galler: typ === 'regel' ? text(body.galler) : null,
    text: innehall,
  }).select(KOLUMNER).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instruktion: data });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Instruktion saknas' }, { status: 400 });
  const { error } = await createServerClient().from('flodes_instruktioner').delete().eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
