import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from './phone';
import { sendSms } from './twilio';

/**
 * Nya leads utifrån (Facebooks snabbformulär via Zapier) får ett välkomst-SMS
 * från vårt Twilio-nummer. Meddelandet är en fast mall och inte AI-genererat —
 * första intrycket ska vara förutsägbart. Svarar personen tar `/api/sms` över
 * och AI:n sköter samtalet därifrån, med utskicket nedan som historik.
 *
 * SMS:et går ut direkt, dygnet runt. Ett lead är som varmast de första
 * minuterna, och det vägde tyngre än att undvika enstaka nattliga utskick.
 */

/** Markerar raden i sms_messages som ett lead-utskick, inte ett AI-svar. */
const WELCOME_KIND = 'lead_welcome';

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
  | 'duplicate'
  | 'no_phone'
  | 'optout'
  | 'failed';

export interface LeadResult {
  outcome: LeadOutcome;
  phone: string | null;
  error?: string;
}

/**
 * Välkomstmeddelandet, ordagrant som Erik vill ha det. Ligger på 170 tecken och
 * går alltså som två segment — under 160 hade räckt med ett, men signaturen är
 * värd skillnaden. Å, Ä och Ö är gratis i SMS; emoji och tankstreck är det inte.
 */
export const WELCOME_SMS =
  'Hej! Erik på EnklaBokslut här. Vi har precis skickat ett mejl till dig. ' +
  'Kika gärna i inkorgen och även skräpposten om du inte hittar det.\n\n' +
  'Hälsningar\nErik på EnklaBokslut';

/**
 * Tar emot ett lead: sparar det, och skickar välkomst-SMS:et om numret finns
 * och personen inte avregistrerat sig.
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
  // ett välkomst-SMS det senaste dygnet är det samma person igen. Filtret på
  // kind är viktigt — utan det räknas AI:ns svar i en pågående dialog som ett
  // tidigare utskick, och den som just chattat med oss får aldrig sitt lead-SMS.
  if (!lead.externalId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('sms_messages')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('direction', 'out')
      .eq('kind', WELCOME_KIND)
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

  const body = WELCOME_SMS;

  try {
    const sid = await sendSms({ to: phone, body });
    await supabase.from('sms_messages').insert({
      phone,
      direction: 'out',
      body,
      kind: WELCOME_KIND,
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
      kind: WELCOME_KIND,
      status: 'failed',
      error: message,
    });
    return { outcome: 'failed', phone, error: message };
  }
}
