import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from './phone';
import { sendSms } from './twilio';

/**
 * Nya leads utifrån (Facebooks snabbformulär via Zapier) får ett välkomst-SMS
 * från vårt Twilio-nummer. Meddelandet är en fast mall och inte AI-genererat —
 * första intrycket ska vara förutsägbart. Svarar personen tar `/api/sms` över
 * och AI:n sköter samtalet därifrån, med utskicket nedan som historik.
 */

/** Skickas inte mitt i natten. Lokala timmar i Sverige, gränserna inklusive/exklusive. */
const SEND_FROM_HOUR = 8;
const SEND_UNTIL_HOUR = 21;

export interface IncomingLead {
  /** Leadets id hos källan. Finns det används det för att stoppa dubbletter. */
  externalId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Vilket formulär eller vilken kampanj leadet kom från, hamnar i anteckningar. */
  formName?: string | null;
  /** Källmärkning i contact_requests.ref, t.ex. "facebook". */
  ref?: string | null;
}

export type LeadOutcome =
  | 'sent'
  | 'queued'
  | 'duplicate'
  | 'no_phone'
  | 'optout'
  | 'failed';

export interface LeadResult {
  outcome: LeadOutcome;
  phone: string | null;
  error?: string;
}

/** Är klockan utanför utskicksfönstret i svensk tid just nu? */
export function isQuietHours(now: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  return hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR;
}

/**
 * Förnamnet hämtas ur ett namn som personen skrivit i sin Facebook-profil, så
 * det kan innehålla emoji och annat som gör SMS:et dubbelt så dyrt. Hellre
 * hälsa utan namn än att skicka skräptecken.
 */
function firstName(raw: string | null | undefined): string {
  if (!raw) return '';
  const first = raw.trim().split(/\s+/)[0] ?? '';
  const clean = first.replace(/[^\p{L}\p{M}'-]/gu, '');
  if (clean.length < 2 || clean.length > 20) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Välkomstmeddelandet. Håll det under 160 tecken — då går det som ett segment.
 * Å, Ä och Ö är gratis i SMS; emoji och tankstreck halverar utrymmet.
 */
export function buildWelcomeSms(name: string | null | undefined): string {
  const first = firstName(name);
  const greeting = first ? `Hej ${first}!` : 'Hej!';
  return (
    `${greeting} Enkla Bokslut här. Tack för att du hörde av dig via Facebook. ` +
    'Har du en fråga om bokslut eller deklaration? Svara på det här SMS:et. STOPP avslutar.'
  );
}

/**
 * Tar emot ett lead: sparar det, och skickar välkomst-SMS:et om numret finns,
 * personen inte avregistrerat sig och klockan tillåter. Nattetid köas det
 * istället och skickas av cronjobbet på morgonen.
 */
export async function handleNewLead(
  supabase: SupabaseClient,
  lead: IncomingLead,
): Promise<LeadResult> {
  const phone = normalizePhone(lead.phone);
  const ref = (lead.ref ?? 'facebook').slice(0, 40);

  // Insert först: det unika indexet på external_id är det som gör dubbletter
  // omöjliga även om två Zap-körningar landar samtidigt. E-post är NOT NULL i
  // contact_requests, så saknas den kan leadet inte sparas — SMS:et går ändå ut.
  if (lead.email) {
    const { error } = await supabase.from('contact_requests').insert({
      external_id: lead.externalId || null,
      name: lead.name || null,
      email: lead.email,
      phone: lead.phone || null,
      notes: lead.formName ? `Facebook-formulär: ${lead.formName}` : null,
      package_type: 'komplett',
      ref,
    });

    if (error) {
      // 23505 = unique_violation, alltså samma lead en gång till
      if (error.code === '23505') return { outcome: 'duplicate', phone };
      console.error('[lead] kunde inte spara lead:', error.message);
    }
  } else {
    console.warn('[lead] lead utan e-post, sparas inte i contact_requests');
  }

  if (!phone) {
    console.warn('[lead] lead utan användbart telefonnummer, inget SMS skickas');
    return { outcome: 'no_phone', phone: null };
  }

  // Reserv när leadet saknar id att haka upp dedupen på: har numret redan fått
  // ett välkomst-SMS det senaste dygnet är det samma person igen.
  if (!lead.externalId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('sms_messages')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('direction', 'out')
      .in('status', ['sent', 'queued'])
      .gte('created_at', since);
    if ((count ?? 0) > 0) {
      console.log(`[lead] ${phone} har redan fått SMS senaste dygnet, hoppar över`);
      return { outcome: 'duplicate', phone };
    }
  }

  const { data: optout } = await supabase
    .from('sms_optouts')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();

  if (optout) {
    console.log(`[lead] ${phone} är avregistrerad, inget SMS skickas`);
    return { outcome: 'optout', phone };
  }

  const body = buildWelcomeSms(lead.name);

  if (isQuietHours()) {
    await supabase.from('sms_messages').insert({
      phone,
      direction: 'out',
      body,
      status: 'queued',
    });
    console.log(`[lead] ${phone} köat till morgonen`);
    return { outcome: 'queued', phone };
  }

  try {
    const sid = await sendSms({ to: phone, body });
    await supabase.from('sms_messages').insert({
      phone,
      direction: 'out',
      body,
      twilio_sid: sid,
      status: 'sent',
    });
    console.log(`[lead] välkomst-SMS skickat till ${phone}`);
    return { outcome: 'sent', phone };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lead] kunde inte skicka till ${phone}:`, message);
    await supabase.from('sms_messages').insert({
      phone,
      direction: 'out',
      body,
      status: 'failed',
      error: message,
    });
    return { outcome: 'failed', phone, error: message };
  }
}
