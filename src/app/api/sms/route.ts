import { after } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateTwilioSignature, resolveWebhookUrl, sendSms, emptyTwiml } from '@/lib/sms/twilio';
import { normalizePhone } from '@/lib/sms/phone';
import { identifySender } from '@/lib/sms/identify';
import { generateSmsReply } from '@/lib/sms/answer';

// o3 plus två vektorsökningar tar längre tid än Twilios webhook-timeout på 15 s.
// Därför kvitteras webhooken direkt och svaret genereras och skickas efteråt,
// via Twilios REST-API istället för TwiML.
export const maxDuration = 120;

/** Ord som stänger av utskick. Twilios inbyggda opt-out är på engelska. */
const STOP_WORDS = ['stopp', 'stop', 'avsluta', 'avregistrera', 'sluta', 'unsubscribe'];
const START_WORDS = ['start', 'starta', 'ja tack'];

/** Tak för utgående SMS per nummer och rullande timme — hindrar loopar och rusningar. */
const MAX_OUT_PER_HOUR = 10;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function log(
  supabase: SupabaseClient,
  row: {
    phone: string;
    direction: 'in' | 'out';
    body: string;
    twilio_sid?: string | null;
    user_id?: string | null;
    status?: string | null;
    error?: string | null;
  },
) {
  const { error } = await supabase.from('sms_messages').insert(row);
  if (error) console.error('[sms] kunde inte logga meddelande:', error.message);
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[sms] TWILIO_AUTH_TOKEN saknas — webhooken är avstängd');
    return emptyTwiml();
  }

  // Twilio postar form-encoded, inte JSON
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = typeof v === 'string' ? v : '';

  const valid = validateTwilioSignature({
    signature: request.headers.get('x-twilio-signature'),
    url: resolveWebhookUrl(request),
    body: params,
    authToken,
  });

  if (!valid) {
    console.warn('[sms] ogiltig Twilio-signatur, requesten slängd');
    return new Response('Forbidden', { status: 403 });
  }

  const from = normalizePhone(params.From);
  const body = (params.Body ?? '').trim();
  const messageSid = params.MessageSid || params.SmsSid || null;

  if (!from || !body) return emptyTwiml();

  // Svara aldrig på oss själva — ett SMS från vårt eget nummer betyder att något
  // gått i loop, och att svara på det gör loopen självgående.
  if (from === normalizePhone(process.env.TWILIO_PHONE_NUMBER)) {
    console.warn('[sms] meddelande från vårt eget nummer, ignoreras');
    return emptyTwiml();
  }

  const supabase = getSupabase();

  // Twilio gör om leveransen om vi svarar långsamt eller med fel. Utan dedupe
  // skulle samma fråga besvaras flera gånger.
  if (messageSid) {
    const { data: seen } = await supabase
      .from('sms_messages')
      .select('id')
      .eq('twilio_sid', messageSid)
      .maybeSingle();
    if (seen) {
      console.log(`[sms] ${messageSid} redan hanterat, hoppar över`);
      return emptyTwiml();
    }
  }

  const sender = await identifySender(supabase, from);
  await log(supabase, {
    phone: from,
    direction: 'in',
    body,
    twilio_sid: messageSid,
    user_id: sender.userId,
  });

  // Avregistrering och återregistrering hanteras här, aldrig av AI:n
  const normalized = body.toLowerCase().replace(/[.!?]/g, '').trim();

  if (STOP_WORDS.includes(normalized)) {
    await supabase.from('sms_optouts').upsert({ phone: from });
    console.log(`[sms] ${from} har avregistrerat sig`);
    return emptyTwiml();
  }

  if (START_WORDS.includes(normalized)) {
    await supabase.from('sms_optouts').delete().eq('phone', from);
    after(async () => {
      const reply = 'Hej igen. Du får SMS fran oss igen. Skriv STOPP nar du vill sluta.';
      try {
        const sid = await sendSms({ to: from, body: reply });
        await log(getSupabase(), { phone: from, direction: 'out', body: reply, twilio_sid: sid, status: 'sent' });
      } catch (err) {
        console.error('[sms] kunde inte skicka opt-in-bekräftelse:', err);
      }
    });
    return emptyTwiml();
  }

  const { data: optout } = await supabase
    .from('sms_optouts')
    .select('phone')
    .eq('phone', from)
    .maybeSingle();

  if (optout) {
    console.log(`[sms] ${from} är avregistrerad, inget svar skickas`);
    return emptyTwiml();
  }

  // Kvittera Twilio direkt, gör resten efteråt
  after(async () => {
    const sb = getSupabase();
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await sb
        .from('sms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('phone', from)
        .eq('direction', 'out')
        .gte('created_at', since);

      if ((count ?? 0) >= MAX_OUT_PER_HOUR) {
        console.warn(`[sms] taket på ${MAX_OUT_PER_HOUR} svar/timme nått för ${from}`);
        await log(sb, {
          phone: from, direction: 'out', body: '(ej skickat)',
          user_id: sender.userId, status: 'rate_limited',
        });
        return;
      }

      const reply = await generateSmsReply({ supabase: sb, phone: from, message: body, sender });

      if (!reply) {
        console.warn(`[sms] tomt AI-svar för ${from}`);
        return;
      }

      const sid = await sendSms({ to: from, body: reply });
      await log(sb, {
        phone: from, direction: 'out', body: reply,
        twilio_sid: sid, user_id: sender.userId, status: 'sent',
      });
      console.log(`[sms] svarade ${from} (${sender.kind}, ${reply.length} tecken)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sms] kunde inte svara ${from}:`, msg);
      await log(sb, {
        phone: from, direction: 'out', body: '(inget svar skickat)',
        user_id: sender.userId, status: 'failed', error: msg,
      });
    }
  });

  return emptyTwiml();
}
