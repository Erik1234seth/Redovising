import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms/twilio';
import type { SmsDraft } from '@/lib/admin-types';

/**
 * AI-svaren som väntar på att godkännas, och knapparna som avgör deras öde.
 *
 * `/api/sms` skriver AI:ns svar som en rad i `sms_messages` med
 * `status: 'draft'` istället för att skicka det. Den här routen är andra
 * halvan: läser utkasten, sparar ändringar i texten, skickar dem på riktigt
 * eller slänger dem.
 *
 * Utkastet lever kvar som samma rad hela vägen — den blir 'sent', 'discarded'
 * eller 'failed'. Alternativet, en egen utkasttabell, hade betytt att samma
 * meddelande fanns på två ställen och att tidslinjen i `/api/admin/people`
 * behövt läsa båda.
 *
 * OBS: routen har ingen autentisering, precis som resten av `/api/admin`.
 * Skillnaden är att de andra bara läser — den här skickar SMS. Vad en
 * utomstående kan göra är avgränsat (bara skicka en text till ett nummer som
 * redan har ett utkast liggande), men det är fortfarande mer än läsning.
 */

/** Ändras aldrig av oss, men Twilio delar långa SMS i segment som kostar var för sig. */
const MAX_BODY = 1600;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Hämtar utkastet och vägrar om det redan hunnit bli något annat. */
async function loadDraft(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('id, phone, body, status, user_id, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return { error: error.message, status: 500 as const };
  if (!data) return { error: 'Utkastet finns inte', status: 404 as const };
  // Två flikar öppna, eller ett dubbelklick: raden ska bara kunna skickas en gång.
  if (data.status !== 'draft') {
    return { error: `Utkastet är redan ${data.status === 'sent' ? 'skickat' : data.status}`, status: 409 as const };
  }
  return { draft: data };
}

function cleanBody(raw: unknown, fallback: string): string | null {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text.length > MAX_BODY) return null;
  return text;
}

/** Utkasten, äldst först — det som väntat längst har någon som väntar på svar. */
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: rows, error } = await supabase
      .from('sms_messages')
      .select('id, phone, body, created_at')
      .eq('status', 'draft')
      .eq('direction', 'out')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows?.length) return NextResponse.json({ drafts: [], count: 0 });

    const phones = [...new Set(rows.map((r) => r.phone))];

    // Frågan personen ställde, och om numret hunnit avregistrera sig medan
    // utkastet låg. Båda hämtas i ett svep för alla nummer istället för en
    // fråga per utkast.
    const [incoming, optouts] = await Promise.all([
      supabase.from('sms_messages').select('phone, body, created_at')
        .eq('direction', 'in').in('phone', phones)
        .order('created_at', { ascending: false }),
      supabase.from('sms_optouts').select('phone').in('phone', phones),
    ]);

    const optedOut = new Set((optouts.data ?? []).map((o) => o.phone));

    const drafts: SmsDraft[] = rows.map((r) => {
      // Senaste inkommande SMS:et som kom före utkastet skrevs — det är det
      // AI:n faktiskt svarade på, inte något som trillat in efteråt.
      const question = (incoming.data ?? []).find(
        (m) => m.phone === r.phone && m.created_at <= r.created_at,
      );
      return {
        id: r.id,
        phone: r.phone,
        body: r.body,
        at: r.created_at,
        question: question?.body ?? null,
        questionAt: question?.created_at ?? null,
        optedOut: optedOut.has(r.phone),
      };
    });

    return NextResponse.json({ drafts, count: drafts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internt fel';
    console.error('[admin/sms-drafts]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Sparar en ändrad text utan att skicka. */
export async function PATCH(request: Request) {
  try {
    const { id, body } = await request.json();
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });

    const supabase = getSupabase();
    const found = await loadDraft(supabase, id);
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

    const text = cleanBody(body, found.draft.body);
    if (!text) return NextResponse.json({ error: `Texten måste vara 1–${MAX_BODY} tecken` }, { status: 400 });

    const { error } = await supabase.from('sms_messages').update({ body: text }).eq('id', id).eq('status', 'draft');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, body: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Skickar utkastet på riktigt, med texten som står i rutan just nu. */
export async function POST(request: Request) {
  try {
    const { id, body } = await request.json();
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });

    const supabase = getSupabase();
    const found = await loadDraft(supabase, id);
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

    const draft = found.draft;
    const text = cleanBody(body, draft.body);
    if (!text) return NextResponse.json({ error: `Texten måste vara 1–${MAX_BODY} tecken` }, { status: 400 });

    // Kollas här och inte bara i UI:t: utkastet kan ha legat i timmar, och
    // personen kan ha skrivit STOPP under tiden.
    const { data: optout } = await supabase
      .from('sms_optouts').select('phone').eq('phone', draft.phone).maybeSingle();

    if (optout) {
      await supabase.from('sms_messages')
        .update({ status: 'skipped', body: text, error: 'Avregistrerad innan utskick' })
        .eq('id', id);
      return NextResponse.json({ error: 'Numret har avregistrerat sig — inget skickades' }, { status: 409 });
    }

    // Reservera raden först. Går sändningen igenom men uppdateringen inte,
    // vore alternativet ett utkast som ser oskickat ut och kan skickas igen.
    const { data: claimed, error: claimError } = await supabase
      .from('sms_messages')
      .update({ status: 'sending', body: text })
      .eq('id', id)
      .eq('status', 'draft')
      .select('id')
      .maybeSingle();

    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
    if (!claimed) return NextResponse.json({ error: 'Utkastet hanterades precis av någon annan' }, { status: 409 });

    try {
      const sid = await sendSms({ to: draft.phone, body: text });
      await supabase.from('sms_messages')
        .update({ status: 'sent', twilio_sid: sid, error: null })
        .eq('id', id);
      console.log(`[admin/sms-drafts] skickade utkast till ${draft.phone} (${text.length} tecken)`);
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('sms_messages').update({ status: 'failed', error: message }).eq('id', id);
      console.error(`[admin/sms-drafts] kunde inte skicka till ${draft.phone}:`, message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Slänger utkastet. Raden blir kvar med status 'discarded' — att AI:n föreslog
 * något som inte dög är värt att se i tidslinjen, och personen står fortfarande
 * utan svar.
 */
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });

    const supabase = getSupabase();
    const found = await loadDraft(supabase, id);
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

    const { error } = await supabase.from('sms_messages')
      .update({ status: 'discarded' }).eq('id', id).eq('status', 'draft');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
