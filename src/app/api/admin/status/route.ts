import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StatusCheck, StatusGroup, StatusReport } from '@/lib/admin-types';

/**
 * Systemstatus för adminpanelen: går flödena fram just nu?
 *
 * Två sorters kontroller, och skillnaden är viktig:
 *
 *  - UPPKOPPLINGAR frågar tjänsterna direkt, här och nu. De svarar på "skulle
 *    ett utskick gå fram om ett lead kom in i det här ögonblicket?" — vilket
 *    databasen inte kan svara på, för där syns bara det som redan hänt. Det var
 *    precis den luckan som gjorde att OpenAI-krediterna kunde ta slut utan att
 *    något syntes förrän någon undrade varför AI:n tystnat.
 *
 *  - FLÖDEN läser loggarna och visar det senaste som faktiskt hände i varje
 *    steg, och om det gick bra. Grön bock betyder "senaste försöket lyckades",
 *    inte "det här händer ofta".
 *
 * Inga hemligheter lämnar routen. Nycklar redovisas som satt/saknas, aldrig med
 * värde, och felmeddelanden från tredje part kapas till en rad.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Live-kontrollerna får inte hänga kvar och göra sidan seg. */
const PING_TIMEOUT_MS = 8000;

function trim(text: string, max = 160): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('timeout') || message.includes('aborted')
    ? `Svarade inte inom ${PING_TIMEOUT_MS / 1000} sekunder`
    : trim(message);
}

// ─── Uppkopplingar ────────────────────────────────────────────────────────────

async function checkSupabase(supabase: SupabaseClient): Promise<StatusCheck> {
  const base = { id: 'supabase', label: 'Databasen (Supabase)' };
  try {
    const { error } = await supabase.from('contact_requests').select('id', { head: true, count: 'exact' });
    if (error) {
      return { ...base, level: 'fail', detail: trim(error.message), hint: 'Kontrollera SUPABASE_SERVICE_ROLE_KEY och att projektet inte är pausat.' };
    }
    return { ...base, level: 'ok', detail: 'Svarar på frågor.' };
  } catch (err) {
    return { ...base, level: 'fail', detail: errorText(err), hint: 'Kontrollera SUPABASE_SERVICE_ROLE_KEY och att projektet inte är pausat.' };
  }
}

/**
 * Postar till Apps Script med rätt hemlighet men avsiktligt tom brödtext.
 *
 * Scriptet svarar då "to, subject och html krävs", vilket bevisar tre saker på
 * en gång: webbappen är publicerad, den är nåbar, och hemligheten stämmer. Och
 * inget mejl går i väg. Svarar det "Unauthorized" eller "Fel hemlighet" är det
 * hemligheten som glidit isär mellan Vercel och Script Properties.
 */
async function checkGmailScript(): Promise<StatusCheck> {
  const base = { id: 'gmail', label: 'Mejlutskick (Apps Script → Gmail)' };
  const url = process.env.GMAIL_SCRIPT_URL;
  const secret = process.env.GMAIL_SCRIPT_SECRET;

  if (!url || !secret) {
    return { ...base, level: 'fail', detail: 'GMAIL_SCRIPT_URL eller GMAIL_SCRIPT_SECRET saknas.', hint: 'Lägg in båda i Vercel och deploya om.' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    const text = await res.text();

    let parsed: { ok?: boolean; error?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ...base, level: 'fail', detail: 'Fick en inloggningssida i stället för ett svar.', hint: 'Publicera om webbappen med åtkomst "Alla" (Distribuera → Hantera distributioner → pennan → Ny version).' };
    }

    const error = parsed.error ?? '';
    if (/krävs/i.test(error)) {
      return { ...base, level: 'ok', detail: 'Webbappen svarar och hemligheten stämmer.' };
    }
    if (/unauthorized|hemlighet/i.test(error)) {
      return { ...base, level: 'fail', detail: 'Scriptet nekade hemligheten.', hint: 'GMAIL_SCRIPT_SECRET i Vercel och GMAIL_SCRIPT_SECRET i Script Properties måste vara samma sträng.' };
    }
    if (/saknas i Script Properties/i.test(error)) {
      return { ...base, level: 'fail', detail: trim(error), hint: 'Sätt GMAIL_SCRIPT_SECRET under Project Settings → Script Properties.' };
    }
    return { ...base, level: 'unknown', detail: trim(error || text) };
  } catch (err) {
    return { ...base, level: 'fail', detail: errorText(err), hint: 'Kontrollera att GMAIL_SCRIPT_URL pekar på den publicerade webbappen.' };
  }
}

/**
 * Ett riktigt anrop, inte bara en nyckelkoll. En modellista hade sagt att
 * nyckeln finns även när saldot är slut — och det var saldot som tog slut.
 */
async function checkOpenAI(): Promise<StatusCheck> {
  const base = { id: 'openai', label: 'AI-svaren (OpenAI)' };
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return { ...base, level: 'fail', detail: 'OPENAI_API_KEY saknas.', hint: 'Lägg in nyckeln i Vercel och deploya om.' };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_completion_tokens: 1,
      }),
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });

    if (res.ok) return { ...base, level: 'ok', detail: 'Nyckeln fungerar och det finns saldo.' };

    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      return { ...base, level: 'fail', detail: 'Nyckeln avvisades (401).', hint: 'Nyckeln är återkallad eller felkopierad. Skapa en ny på platform.openai.com och byt i Vercel.' };
    }
    if (/insufficient_quota/i.test(body)) {
      return { ...base, level: 'fail', detail: 'Saldot är slut (insufficient_quota).', hint: 'Fyll på krediter på platform.openai.com. Utan saldo slutar mejl- och SMS-AI:n att svara.' };
    }
    if (res.status === 429) {
      return { ...base, level: 'unknown', detail: 'Hastighetsbegränsad just nu (429). Nyckeln fungerar.' };
    }
    // Kontot kanske inte når just den här modellen. Att vi över huvud taget
    // fick ett modellfel betyder att nyckeln godtogs.
    if (/model/i.test(body)) {
      return { ...base, level: 'unknown', detail: 'Nyckeln godtas, men testmodellen gpt-4o-mini är inte tillgänglig.' };
    }
    return { ...base, level: 'fail', detail: trim(`${res.status}: ${body}`) };
  } catch (err) {
    return { ...base, level: 'fail', detail: errorText(err) };
  }
}

async function checkTwilio(): Promise<StatusCheck> {
  const base = { id: 'twilio', label: 'SMS-utskick (Twilio)' };
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return { ...base, level: 'fail', detail: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN eller TWILIO_PHONE_NUMBER saknas.', hint: 'Lägg in alla tre i Vercel och deploya om.' };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });

    if (res.status === 401) {
      return { ...base, level: 'fail', detail: 'Twilio avvisade inloggningen (401).', hint: 'TWILIO_AUTH_TOKEN stämmer inte längre. Hämta aktuell token i Twilio-konsolen.' };
    }
    if (!res.ok) {
      return { ...base, level: 'fail', detail: trim(`${res.status}: ${await res.text().catch(() => '')}`) };
    }

    const account = await res.json() as { status?: string };
    if (account.status && account.status !== 'active') {
      return { ...base, level: 'fail', detail: `Kontot har status "${account.status}".`, hint: 'Ett stängt eller spärrat konto skickar inga SMS.' };
    }
    return { ...base, level: 'ok', detail: `Kontot är aktivt. Avsändare ${from}.` };
  } catch (err) {
    return { ...base, level: 'fail', detail: errorText(err) };
  }
}

// ─── Flöden ───────────────────────────────────────────────────────────────────

/** Senaste raden i en tabell, med valfria likhetsfilter. */
async function latest(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  filters: Record<string, string> = {},
): Promise<Record<string, unknown> | null> {
  let query = supabase.from(table).select(columns).order('created_at', { ascending: false }).limit(1);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data } = await query.maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Gemensam tolkning: hittades ingen rad är det inte ett fel, bara tomt. Grönt
 * betyder att det SENASTE försöket gick fram — panelen ska inte påstå att allt
 * är bra bara för att det var bra i förrgår.
 */
function fromLastAttempt(params: {
  id: string;
  label: string;
  row: Record<string, unknown> | null;
  failed: boolean;
  okText: string;
  emptyText: string;
  hint?: string;
}): StatusCheck {
  const { id, label, row, failed, okText, emptyText, hint } = params;
  if (!row) return { id, label, level: 'unknown', detail: emptyText, at: null };

  const at = (row.created_at as string) ?? null;
  if (failed) {
    return { id, label, level: 'fail', detail: trim((row.error as string) || 'Senaste försöket misslyckades.'), hint, at };
  }
  return { id, label, level: 'ok', detail: okText, at };
}

async function checkFlows(supabase: SupabaseClient): Promise<StatusCheck[]> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [lead, email, smsOut, smsIn, smsAi, thread, queued, failedEmails, failedSms] = await Promise.all([
    latest(supabase, 'contact_requests', 'id, created_at, name, ref'),
    latest(supabase, 'email_log', 'id, created_at, status, error, to_email', { kind: 'lead_valkomst' }),
    latest(supabase, 'sms_messages', 'id, created_at, status, error, phone', { kind: 'lead_welcome', direction: 'out' }),
    latest(supabase, 'sms_messages', 'id, created_at, phone', { direction: 'in' }),
    supabase.from('sms_messages').select('id, created_at, status, error').is('kind', null).eq('direction', 'out')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('email_threads').select('id, updated_at, state')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sms_messages').select('id', { head: true, count: 'exact' }).eq('status', 'queued'),
    supabase.from('email_log').select('id', { head: true, count: 'exact' }).eq('status', 'failed').gte('created_at', dayAgo),
    supabase.from('sms_messages').select('id', { head: true, count: 'exact' }).eq('status', 'failed').gte('created_at', dayAgo),
  ]);

  const aiRow = smsAi.data as Record<string, unknown> | null;
  const threadRow = thread.data as { updated_at?: string; state?: string | null } | null;
  const queuedCount = queued.count ?? 0;
  const failCount = (failedEmails.count ?? 0) + (failedSms.count ?? 0);

  return [
    fromLastAttempt({
      id: 'lead_in',
      label: 'Lead kommer in',
      row: lead,
      failed: false,
      okText: `Senaste leadet: ${(lead?.name as string) || 'utan namn'} (${(lead?.ref as string) || 'okänd källa'}).`,
      emptyText: 'Inga leads i databasen än.',
    }),
    fromLastAttempt({
      id: 'welcome_email',
      label: 'Välkomstmejl skickas',
      row: email,
      failed: email?.status === 'failed',
      okText: `Gick fram till ${email?.to_email as string}.`,
      emptyText: 'Inget välkomstmejl loggat än.',
      hint: 'Se uppkopplingen mot Apps Script ovan.',
    }),
    fromLastAttempt({
      id: 'welcome_sms',
      label: 'Välkomst-SMS skickas',
      row: smsOut,
      failed: smsOut?.status === 'failed',
      okText: `Gick fram till ${smsOut?.phone as string}.`,
      emptyText: 'Inget välkomst-SMS loggat än.',
      hint: 'Se uppkopplingen mot Twilio ovan.',
    }),
    fromLastAttempt({
      id: 'sms_in',
      label: 'Svar-SMS kommer in',
      row: smsIn,
      failed: false,
      okText: `Senaste svaret kom från ${smsIn?.phone as string}.`,
      emptyText: 'Ingen har svarat på ett SMS än. Webhooken kan alltså inte bekräftas härifrån.',
    }),
    fromLastAttempt({
      id: 'sms_ai',
      label: 'SMS-AI:n svarar',
      row: aiRow,
      failed: aiRow?.status === 'failed',
      // AI-svaren går inte ut av sig själva längre. Att det senaste ligger som
      // utkast betyder att AI:n gjort sitt jobb — inte att något gått fram.
      okText: aiRow?.status === 'draft' || aiRow?.status === 'sending'
        ? 'Senaste AI-svaret ligger som utkast och väntar på godkännande på /admin/sms.'
        : aiRow?.status === 'discarded'
          ? 'Senaste AI-svaret slängdes utan att skickas.'
          : 'Senaste AI-svaret gick fram.',
      emptyText: 'AI:n har inte behövt svara på något SMS än.',
    }),
    {
      id: 'mail_ai',
      label: 'Mejl-AI:n arbetar i trådar',
      level: threadRow ? 'ok' : 'unknown',
      detail: threadRow
        ? `Senast berörda tråd: ${threadRow.state || 'utan märkning'}.`
        : 'Ingen mejltråd har hanterats än.',
      at: threadRow?.updated_at ?? null,
    },
    {
      id: 'queue',
      label: 'Inget ligger kvar i SMS-kön',
      level: queuedCount === 0 ? 'ok' : 'fail',
      detail: queuedCount === 0 ? 'Kön är tom.' : `${queuedCount} SMS väntar med status queued.`,
      hint: 'Cron-jobbet /api/cron/sms-queue tömmer kön. Ligger de kvar har jobbet inte kört.',
    },
    {
      id: 'failures',
      label: 'Inga misslyckade utskick senaste dygnet',
      level: failCount === 0 ? 'ok' : 'fail',
      detail: failCount === 0
        ? 'Alla mejl och SMS det senaste dygnet gick fram.'
        : `${failedEmails.count ?? 0} mejl och ${failedSms.count ?? 0} SMS misslyckades.`,
      hint: 'Öppna personen i listan för att se vilket utskick som fallerade och varför.',
    },
  ];
}

// ─── Nycklar ──────────────────────────────────────────────────────────────────

/**
 * Bara satt eller saknas. Värdena lämnar aldrig servern — det här är en öppen
 * panel, och en hemlighet som visas i en webbläsare är ingen hemlighet.
 */
function checkSecrets(): StatusCheck[] {
  const required: Array<[string, string]> = [
    ['LEAD_WEBHOOK_SECRET', 'Skyddar lead-webhooken från Zapier'],
    ['INMAIL_SECRET', 'Skyddar mejl-AI:ns route'],
    ['CRON_SECRET', 'Skyddar cron-jobben'],
    ['NEXT_PUBLIC_SITE_URL', 'Bygger registreringslänkarna'],
    ['RESEND_API_KEY', 'Övriga utskick som inte går via Gmail'],
    ['STRIPE_SECRET_KEY', 'Betalningarna'],
    ['STRIPE_WEBHOOK_SECRET', 'Verifierar Stripes anrop'],
  ];

  return required.map(([name, purpose]) => ({
    id: `env_${name}`,
    label: name,
    level: process.env[name] ? 'ok' : 'fail',
    detail: purpose,
    hint: 'Lägg in variabeln i Vercel och deploya om. Nya variabler slår inte igenom förrän nästa deploy.',
  }));
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const [supabaseCheck, gmail, openai, twilio, flows] = await Promise.all([
    checkSupabase(supabase),
    checkGmailScript(),
    checkOpenAI(),
    checkTwilio(),
    checkFlows(supabase).catch((err): StatusCheck[] => [{
      id: 'flows',
      label: 'Flödena kunde inte läsas',
      level: 'fail',
      detail: errorText(err),
    }]),
  ]);

  const groups: StatusGroup[] = [
    {
      title: 'Uppkopplingar',
      note: 'Frågar tjänsterna just nu. Grönt betyder att ett utskick skulle gå fram i det här ögonblicket.',
      checks: [supabaseCheck, gmail, openai, twilio],
    },
    {
      title: 'Flöden',
      note: 'Läser loggarna. Grönt betyder att det senaste försöket i steget gick bra.',
      checks: flows,
    },
    {
      title: 'Nycklar i miljön',
      note: 'Bara satt eller saknas. Inga värden visas.',
      checks: checkSecrets(),
    },
  ];

  const report: StatusReport = { groups, checkedAt: new Date().toISOString() };
  return NextResponse.json(report);
}
