import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSms } from './twilio';
import { normalizePhone } from './phone';

/**
 * SMS:et som säger till att vi nyss mejlat, när Erik skrivit ett mejl för hand.
 *
 * Mejlen kommer hit via Gmail-synken (sync-mail.gs → /api/inmail/messages/import),
 * så det är bara mejl som skickats från Gmail som ses. Utskicken systemet själv
 * gör via Gmail (välkomst, påminnelser) står i email_log med provider 'gmail'
 * och sorteras bort — de har redan ett eget SMS där det behövs.
 *
 * Å, Ä och Ö är gratis i GSM-7; tankstreck och emoji hade tvingat fram UCS-2.
 */
export const MAIL_NOTICE_SMS_KIND = 'mejl_notis';

export const MAIL_NOTICE_SMS =
  'Hej! Jag skickade precis ett mail till dig, ' +
  'kika i inkorgen (eller skräpposten om du inte hittar det).\n\n' +
  'Hälsningar\nErik på EnklaBokslut';

/**
 * Bara mejl som skickats nyligen. Synken tar med två dygns marginal och en
 * historikimport tar två år — utan gränsen skulle de ge ett SMS per gammalt mejl.
 * 90 minuter räcker även om synken bara går en gång i timmen.
 */
const MAX_AGE_MS = 90 * 60 * 1000;

/** Ett mejl som systemet självt skickat via Gmail inom så här lång tid räknas som samma. */
const AUTOMATED_WINDOW_MS = 15 * 60 * 1000;

/** Mejlar Erik fram och tillbaka med någon blir det högst ett SMS på den här tiden. */
const COOLDOWN_MS = 5 * 60 * 1000;

export async function sendMailNotices(
  supabase: SupabaseClient,
  sent: { customer_email: string; sent_at: string }[],
): Promise<void> {
  const now = Date.now();
  const recent = sent.filter((m) => now - new Date(m.sent_at).getTime() < MAX_AGE_MS);
  const emails = [...new Set(recent.map((m) => m.customer_email))];

  for (const email of emails) {
    try {
      const sentAt = Math.max(...recent.filter((m) => m.customer_email === email).map((m) => new Date(m.sent_at).getTime()));

      const { data: automated } = await supabase
        .from('email_log')
        .select('id')
        .ilike('to_email', email)
        .eq('provider', 'gmail')
        .gte('created_at', new Date(sentAt - AUTOMATED_WINDOW_MS).toISOString())
        .lte('created_at', new Date(sentAt + AUTOMATED_WINDOW_MS).toISOString())
        .limit(1);
      if (automated?.length) continue;

      const phone = await phoneFor(supabase, email);
      if (!phone) continue;

      const [{ data: optout }, { data: lately }] = await Promise.all([
        supabase.from('sms_optouts').select('phone').eq('phone', phone).maybeSingle(),
        supabase
          .from('sms_messages')
          .select('id')
          .eq('phone', phone)
          .eq('kind', MAIL_NOTICE_SMS_KIND)
          .gte('created_at', new Date(now - COOLDOWN_MS).toISOString())
          .limit(1),
      ]);
      if (optout || lately?.length) continue;

      try {
        const sid = await sendSms({ to: phone, body: MAIL_NOTICE_SMS });
        await supabase.from('sms_messages').insert({
          phone, direction: 'out', body: MAIL_NOTICE_SMS, twilio_sid: sid, status: 'sent', kind: MAIL_NOTICE_SMS_KIND,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[mejl-notis] kunde inte skicka till ${phone}:`, message);
        await supabase.from('sms_messages').insert({
          phone, direction: 'out', body: MAIL_NOTICE_SMS, status: 'failed', error: message, kind: MAIL_NOTICE_SMS_KIND,
        });
      }
    } catch (err) {
      console.error(`[mejl-notis] ${email}:`, err);
    }
  }
}

/**
 * Numret till en mejladress. Kundens profil först, sedan senaste mötesbokning
 * och kontaktförfrågan — profiles.phone är tom för de flesta.
 */
async function phoneFor(supabase: SupabaseClient, email: string): Promise<string | null> {
  const [{ data: profiles }, { data: meetings }, { data: contacts }] = await Promise.all([
    supabase.from('profiles').select('phone').ilike('email', email).not('phone', 'is', null),
    supabase.from('meetings').select('phone').ilike('email', email).not('phone', 'is', null)
      .order('created_at', { ascending: false }),
    supabase.from('contact_requests').select('phone').ilike('email', email).not('phone', 'is', null)
      .order('created_at', { ascending: false }),
  ]);
  for (const row of [...(profiles ?? []), ...(meetings ?? []), ...(contacts ?? [])]) {
    const phone = normalizePhone(row.phone as string);
    if (phone) return phone;
  }
  return null;
}
