import { createClient } from '@supabase/supabase-js';
import type { Resend } from 'resend';

/**
 * Skickar mejl och antecknar att de gick ut.
 *
 * Resend har ingen historik vi kan slå upp per mottagare, så utan raderna i
 * `email_log` går det inte att se i adminpanelen om en person fått mejl.
 * Loggen är alltså till för tidslinjen — inte för leverans.
 *
 * Två saker är medvetna:
 *  - Vi loggar bara mejl som går till kunden eller prospektet. Notiserna till
 *    info@enklabokslut.se hör inte hemma på någons tidslinje.
 *  - Ett misslyckat mejl kastar inte vidare. Resend-SDK:n returnerar fel som
 *    ett fält istället för ett undantag, och anropande routes har aldrig
 *    kollat det. Att börja kasta nu hade gett besökaren ett 500-svar på ett
 *    formulär som i övrigt gick bra. Felet hamnar i loggen med status
 *    'failed' istället, där det syns i panelen.
 */

/** Vilket utskick det rör sig om. Syns som etikett i tidslinjen. */
export type EmailKind =
  | 'lead_valkomst'
  | 'lead_bekraftelse'
  | 'kontakt_bekraftelse'
  | 'motebokning'
  | 'valkommen';

/** Vem som faktiskt bar iväg mejlet. */
export type EmailProvider = 'resend' | 'gmail';

interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Loggningen får aldrig vara anledningen till att ett utskick fallerar. */
export async function logEmail(entry: {
  to: string;
  subject: string;
  kind: EmailKind;
  provider: EmailProvider;
  providerId?: string | null;
  error?: string | null;
}): Promise<void> {
  try {
    await getSupabase().from('email_log').insert({
      // Alltid gemener: uppslag sker skiftlägesokänsligt och indexet ligger
      // på lower(to_email)
      to_email: entry.to.trim().toLowerCase(),
      subject: entry.subject,
      kind: entry.kind,
      provider: entry.provider,
      provider_id: entry.providerId || null,
      status: entry.error ? 'failed' : 'sent',
      error: entry.error || null,
    });
  } catch (err) {
    console.error('[email-log] kunde inte logga utskicket:', err);
  }
}

export async function sendAndLog(
  resend: Resend,
  payload: EmailPayload,
  kind: EmailKind,
): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send(payload);
    if (error) console.error(`[email-log] ${kind} till ${payload.to} misslyckades:`, error.message);
    await logEmail({
      to: payload.to,
      subject: payload.subject,
      kind,
      provider: 'resend',
      providerId: data?.id,
      error: error?.message,
    });
    return !error;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email-log] ${kind} till ${payload.to} kastade:`, message);
    await logEmail({ to: payload.to, subject: payload.subject, kind, provider: 'resend', error: message });
    return false;
  }
}
