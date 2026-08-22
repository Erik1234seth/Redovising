import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from './phone';
import { sendSms } from './twilio';
import { sendViaGmail } from '../emails/send-via-gmail';
import { leadWelcomeEmail } from '../emails/lead-welcome';

/**
 * Nya leads utifrån (Facebooks snabbformulär via Zapier) får två saker: ett
 * välkomstmejl från Eriks Gmail och ett välkomst-SMS från vårt Twilio-nummer.
 * Båda är fasta mallar och inte AI-genererade — första intrycket ska vara
 * förutsägbart. Svarar personen tar AI:n över, på mejl via `/api/inmail` och
 * på SMS via `/api/sms`, med utskicken nedan som historik.
 *
 * Mejlet gick tidigare från Zapier, vilket gjorde det osynligt för panelen.
 * Att det numera går via Gmail och inte Resend är avsiktligt: svaret landar då
 * i inkorgen som mail-AI:n redan bevakar.
 *
 * Fördröjningen ligger inte här. Zapen har ett "Delay For"-steg på 20 minuter
 * före webhook-anropet, så mejl och SMS går ut en stund efter att personen
 * fyllt i formuläret i stället för i samma sekund. Vi skickar alltså fortfarande
 * direkt när vi väl blir anropade — tar du bort delay-steget i Zapier är
 * fördröjningen borta, utan att någon rad här ändras.
 */

/** Markerar raden i sms_messages som ett lead-utskick, inte ett AI-svar. */
const WELCOME_KIND = 'lead_welcome';

/** Motsvarande märkning för mejlet, i email_log. */
const WELCOME_EMAIL_KIND = 'lead_valkomst';

/** Hur långt tillbaka dubblettspärren tittar när leadet saknar eget id. */
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  /** Om välkomstmejlet gick i väg. Utfallet nedan handlar om SMS:et. */
  emailed: boolean;
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
 * Har vi redan hälsat på den här personen det senaste dygnet? Tittar på båda
 * kanalerna: numret kan ha fått SMS:et och adressen kan ha fått mejlet, och
 * ett lead som kommer in två gånger ska inte ge dubbelt av någotdera.
 */
async function alreadyWelcomed(
  supabase: SupabaseClient,
  phone: string | null,
  email: string | null | undefined,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();

  if (phone) {
    const { count } = await supabase
      .from('sms_messages')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('direction', 'out')
      .eq('kind', WELCOME_KIND)
      .in('status', ['sent', 'queued'])
      .gte('created_at', since);
    if ((count ?? 0) > 0) return true;
  }

  if (email) {
    const { count } = await supabase
      .from('email_log')
      .select('id', { count: 'exact', head: true })
      // eq, inte ilike: understreck är vanligt i mejladresser och skulle
      // tolkas som jokertecken i ett LIKE-mönster
      .eq('to_email', email.trim().toLowerCase())
      .eq('kind', WELCOME_EMAIL_KIND)
      .eq('status', 'sent')
      .gte('created_at', since);
    if ((count ?? 0) > 0) return true;
  }

  return false;
}

/**
 * Tar emot ett lead: sparar det, mejlar välkomsthälsningen och skickar
 * välkomst-SMS:et om numret finns och personen inte avregistrerat sig.
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
      if (error.code === '23505') return { outcome: 'duplicate', phone, emailed: false };
      console.error('[lead] kunde inte spara lead:', error.message);
    }
  } else {
    console.warn('[lead] lead utan e-post, sparas inte i contact_requests');
  }

  // Reserv när leadet saknar id att haka upp dedupen på: har personen redan
  // välkomnats det senaste dygnet är det samma lead igen. Filtret på kind är
  // viktigt — utan det räknas AI:ns svar i en pågående dialog som ett tidigare
  // utskick, och den som just chattat med oss får aldrig sitt lead-SMS.
  if (!lead.externalId && (await alreadyWelcomed(supabase, phone, lead.email))) {
    console.log('[lead] personen har redan välkomnats senaste dygnet, hoppar över');
    return { outcome: 'duplicate', phone, emailed: false };
  }

  // Mejlet först. SMS:et säger "vi har precis skickat ett mejl till dig", så
  // ordningen är den enda som gör påståendet sant.
  let emailed = false;
  if (lead.email) {
    const { subject, html } = leadWelcomeEmail();
    emailed = await sendViaGmail({ to: lead.email, subject, html, kind: WELCOME_EMAIL_KIND });
  }

  if (!phone) {
    console.warn('[lead] lead utan användbart telefonnummer, inget SMS skickas');
    return { outcome: 'no_phone', phone: null, emailed };
  }

  const { data: optout } = await supabase
    .from('sms_optouts')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();

  if (optout) {
    console.log(`[lead] ${phone} är avregistrerad, inget SMS skickas`);
    return { outcome: 'optout', phone, emailed };
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
    return { outcome: 'sent', phone, emailed };
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
    return { outcome: 'failed', phone, emailed, error: message };
  }
}
