import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms/twilio';
import { normalizePhone } from '@/lib/sms/phone';

/**
 * SMS som du skriver själv och skickar direkt.
 *
 * Skiljer sig från `/api/admin/sms-drafts` på ett sätt: där finns redan en rad
 * i `sms_messages` som AI:n skrivit, och routen godkänner den. Här finns ingen
 * rad förrän du trycker skicka, så den skapas här. Resten är avsiktligt lika —
 * samma tabell, samma statusar — så att ett manuellt SMS hamnar i personens
 * tidslinje på precis samma sätt som allt annat vi skickat.
 *
 * Numret normaliseras här och inte bara i webbläsaren: det som knappas in är
 * "070-123 45 67" lika ofta som E.164, och Twilio kräver det senare.
 */

/** Twilio delar långa SMS i segment som kostar var för sig. */
const MAX_BODY = 1600;

/** Märkningen i sms_messages.kind som skiljer dessa från AI-svar och mallar. */
const MANUAL_KIND = 'manual';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  try {
    const { phone, body } = await request.json();

    const to = normalizePhone(typeof phone === 'string' ? phone : null);
    if (!to) {
      return NextResponse.json({ error: 'Telefonnumret går inte att tolka' }, { status: 400 });
    }

    const text = typeof body === 'string' ? body.trim() : '';
    if (!text || text.length > MAX_BODY) {
      return NextResponse.json({ error: `Texten måste vara 1–${MAX_BODY} tecken` }, { status: 400 });
    }

    const supabase = getSupabase();

    // Ett STOPP gäller även det vi skriver för hand. Twilio blockerar numret på
    // sin sida ändå, så alternativet vore ett SMS som ser skickat ut men aldrig
    // kommer fram.
    const { data: optout } = await supabase
      .from('sms_optouts').select('phone').eq('phone', to).maybeSingle();

    if (optout) {
      return NextResponse.json(
        { error: 'Numret har avregistrerat sig från SMS — inget skickades' },
        { status: 409 },
      );
    }

    // Raden skrivs före sändningen. Kraschar vi mitt i finns då ett spår av att
    // vi försökte, i stället för ett SMS som gått ut utan att synas någonstans.
    const { data: row, error: insertError } = await supabase
      .from('sms_messages')
      .insert({ phone: to, direction: 'out', body: text, kind: MANUAL_KIND, status: 'sending' })
      .select('id')
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    try {
      const sid = await sendSms({ to, body: text });
      await supabase.from('sms_messages')
        .update({ status: 'sent', twilio_sid: sid, error: null })
        .eq('id', row.id);
      console.log(`[admin/sms-send] skickade manuellt SMS till ${to} (${text.length} tecken)`);
      return NextResponse.json({ ok: true, phone: to });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('sms_messages').update({ status: 'failed', error: message }).eq('id', row.id);
      console.error(`[admin/sms-send] kunde inte skicka till ${to}:`, message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internt fel';
    console.error('[admin/sms-send]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
