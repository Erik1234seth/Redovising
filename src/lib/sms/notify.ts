import { Resend } from 'resend';
import { INTERNAL_NOTICE_TO } from '@/lib/email-log';
import type { Sender } from '@/lib/sms/identify';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Mejlar oss när ett SMS kommer in, med texten och en länk till personen i
 * adminpanelen. Länken går på telefonnumret — personvyn slår upp nummer som
 * alias, så den hittar rätt även när kontot egentligen är nycklat på mejl.
 */
export async function notifyIncomingSms({ from, body, sender }: { from: string; body: string; sender: Sender }) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://enklabokslut.se').replace(/\/+$/, '');
  const link = `${siteUrl}/admin/person/${encodeURIComponent(`p:${from}`)}`;
  const who = sender.name ? `${sender.name} (${from})` : from;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'Enkla Bokslut <noreply@enklabokslut.se>',
    to: INTERNAL_NOTICE_TO,
    subject: `SMS från ${who}`,
    html: `
      <h2>Nytt SMS</h2>
      <p><strong>Från:</strong> ${escape(who)}</p>
      <p style="white-space:pre-wrap;background:#f4f4f5;border-radius:8px;padding:12px 16px">${escape(body)}</p>
      <p><a href="${escape(link)}">Öppna i adminpanelen</a></p>
    `,
  });
  if (error) console.error('[sms] kunde inte mejla notis om inkommande SMS:', error.message);
}
