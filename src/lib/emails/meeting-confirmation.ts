import { formatMeetingDate } from '../meetingSlots';

/**
 * Bekräftelsen som går till kunden när en tid bokats.
 *
 * Ett möte kan bokas från två håll — popupen på startsidan (som postar till
 * /api/valkommen-lead) och sidan /boka-mote — och de skickade tidigare två
 * olika mejl. Kunden ska få samma besked oavsett var knappen satt, så mejlet
 * bor här och byggs bara på ett ställe.
 *
 * Medvetet utan ikon i bokningsrutan: telefonsymbolen renderades som en grå
 * mobil-emoji i flera klienter.
 */

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatMeetingSlot(date: string, time: string) {
  return `${formatMeetingDate(date)} kl. ${time}`;
}

export function meetingConfirmationEmail({
  name,
  phone,
  date,
  time,
}: {
  name?: string | null;
  phone?: string | null;
  date: string;
  time: string;
}) {
  const formattedMeeting = formatMeetingSlot(date, time);
  const firstName = name ? String(name).split(' ')[0] : '';

  return {
    subject: `Mötesbekräftelse – ${formattedMeeting}`,
    html: `
        <!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background-color:${NAV_BG};padding:28px 40px;text-align:center;">
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td style="background-color:${CORAL};border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                          <span style="color:#ffffff;font-size:20px;font-weight:bold;line-height:36px;">&#10003;</span>
                        </td>
                        <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;vertical-align:middle;">Enkla Bokslut</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="padding:40px;">
                  <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:${NAV_BG};">Tack${firstName ? ', ' + escapeHtml(firstName) : ''}!</p>
                  <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Din tid är bokad. Vi ringer upp dig och går igenom hur allt fungerar — helt kostnadsfritt och utan bindning.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                    <tr><td style="padding:18px 20px;">
                      <table cellpadding="0" cellspacing="0"><tr>
                        <td style="font-size:14px;color:${NAV_BG};line-height:1.5;">
                          Vi ringer dig <strong>${escapeHtml(formattedMeeting)}</strong>${phone ? ' på <strong>' + escapeHtml(String(phone)) + '</strong>' : ''}.
                        </td>
                      </tr></table>
                    </td></tr>
                  </table>
                  <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Har du frågor redan nu? Svara direkt på det här mailet — vi läser det.</p>
                  <p style="margin:0;font-size:15px;color:${NAV_BG};">Med vänlig hälsning,<br><strong>Erik</strong><br><span style="color:#8fa3b1;">Enkla Bokslut</span></p>
                </td></tr>
                <tr>
                  <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#8fa3b1;">Enkla Bokslut · <a href="https://enklabokslut.se" style="color:${CORAL};text-decoration:none;">enklabokslut.se</a></p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
  };
}
