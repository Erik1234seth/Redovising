/**
 * Välkomstmejlet till nya leads från Facebooks snabbformulär.
 *
 * Skickades tidigare av Zapier, vilket gjorde det osynligt för adminpanelen.
 * Nu går det härifrån tillsammans med välkomst-SMS:et, så att båda hamnar i
 * personens tidslinje.
 *
 * SMS:et säger uttryckligen "vi har precis skickat ett mejl till dig", så det
 * här mejlet är det som bär innehållet — SMS:et pekar bara hit.
 */

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function leadWelcomeEmail(params: { name?: string | null; phone?: string | null }): {
  subject: string;
  html: string;
} {
  const firstName = params.name?.trim().split(' ')[0] ?? '';
  const greeting = firstName ? `Hej ${escapeHtml(firstName)}!` : 'Hej!';
  const willCall = !!params.phone;

  const html = `
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
              <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:${NAV_BG};">${greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">
                Tack för att du hörde av dig. Jag heter Erik och det är jag som sköter
                bokslut och NE-bilagor på Enkla Bokslut &mdash; och det är jag som läser
                det här mailet.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr><td style="padding:18px 20px;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="background-color:${NAV_BG}1a;border-radius:8px;width:34px;height:34px;text-align:center;vertical-align:middle;">
                      <span style="color:${NAV_BG};font-size:16px;line-height:34px;">${willCall ? '&#128222;' : '&#9993;'}</span>
                    </td>
                    <td style="padding-left:14px;font-size:14px;color:${NAV_BG};line-height:1.5;">
                      ${willCall
                        ? `Jag hör av mig inom kort på <strong>${escapeHtml(params.phone!)}</strong>.`
                        : 'Jag hör av mig inom kort.'}
                    </td>
                  </tr></table>
                </td></tr>
              </table>

              <p style="margin:0 0 12px;font-size:15px;color:${NAV_BG};font-weight:600;">
                Vill du snabba på det?
              </p>
              <p style="margin:0 0 12px;font-size:15px;color:#5a6a7a;line-height:1.7;">
                Svara på det här mailet med följande, så kan jag ge dig ett rakt besked direkt:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;color:#5a6a7a;line-height:1.8;">
                <li>Vilket år gäller det?</li>
                <li>Har du bokfört löpande, eller ligger allt kvar?</li>
                <li>Är du momsregistrerad?</li>
              </ul>
              <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">
                Inget svar är rätt eller fel &mdash; vi löser det oavsett. Jag frågar bara
                för att slippa gissa.
              </p>

              <p style="margin:0;font-size:15px;color:${NAV_BG};">
                Med vänlig hälsning,<br><strong>Erik</strong><br>
                <span style="color:#8fa3b1;">Enkla Bokslut</span>
              </p>
            </td></tr>

            <tr>
              <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#8fa3b1;">Enkla Bokslut &middot; <a href="https://enklabokslut.se" style="color:${CORAL};text-decoration:none;">enklabokslut.se</a></p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body></html>
  `;

  return { subject: 'Tack — här är nästa steg', html };
}
