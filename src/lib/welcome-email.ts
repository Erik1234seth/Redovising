import { Resend } from 'resend';
import { INTERNAL_NOTICE_TO } from './email-log';
import { sendViaGmail } from './emails/send-via-gmail';

const resend = new Resend(process.env.RESEND_API_KEY);

// Skickar välkomstmejl till kunden + notis till Erik. Återanvänds av både
// månads-checkout (Stripe-webhook) och årsvis-signup (faktureras i efterhand).
//
// Kundens mejl går via Eriks Gmail, inte via Resend. Det kommer då från
// erik@enklabokslut.se istället för noreply@, hamnar i Skickat, och svarar
// kunden landar svaret i tråden som mail-AI:n bevakar — ett noreply@ hade
// varit en återvändsgränd. Notisen till oss själva ligger kvar på Resend:
// den ska ingen svara på, och den behöver kundens adress som replyTo, vilket
// Apps Script-utskicket inte kan sätta per mejl.
export async function sendWelcomeEmails(params: {
  email: string;
  name?: string;
  contactMethod?: string;
  planLabel: string;
}): Promise<void> {
  const { email, name = '', contactMethod = 'email', planLabel } = params;
  if (!email) return;

  const firstName = name.split(' ')[0];

  const emailHeader = `
    <table width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr>
        <td style="background-color:#173b57;padding:28px 40px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="background-color:#E95C63;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                <span style="color:#ffffff;font-size:20px;font-weight:bold;line-height:36px;">✓</span>
              </td>
              <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;vertical-align:middle;">Enkla Bokslut</td>
            </tr>
          </table>
        </td>
      </tr>`;

  const emailFooter = `
      <tr>
        <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8fa3b1;">Enkla Bokslut · <a href="https://enklabokslut.se" style="color:#E95C63;text-decoration:none;">enklabokslut.se</a></p>
        </td>
      </tr>
    </table>`;

  const customerHtml = contactMethod === 'meeting' ? `
    <!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
        <tr><td align="center">
          ${emailHeader}
          <tr><td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#173b57;">Välkommen${firstName ? ', ' + firstName : ''}!</p>
            <p style="margin:0 0 24px;font-size:16px;color:#5a6a7a;line-height:1.6;">Ditt konto är aktiverat. Vi hör av oss för att boka in ett möte så att vi kan gå igenom ditt ärende tillsammans.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Din prenumeration</p>
                <p style="margin:0;font-size:15px;color:#173b57;"><strong>Plan:</strong> Enkla Bokslut</p>
                <p style="margin:4px 0 0;font-size:15px;color:#173b57;"><strong>Pris:</strong> ${planLabel}</p>
              </td></tr>
            </table>
            <p style="margin:0;font-size:15px;color:#173b57;">Med vänlig hälsning,<br><strong>Erik</strong><br><span style="color:#8fa3b1;">Enkla Bokslut</span></p>
          </td></tr>
          ${emailFooter}
        </td></tr>
      </table>
    </body></html>
  ` : `
    <!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
        <tr><td align="center">
          ${emailHeader}
          <tr><td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#173b57;">Välkommen${firstName ? ', ' + firstName : ''}!</p>
            <p style="margin:0 0 16px;font-size:16px;color:#5a6a7a;line-height:1.6;">Tack för att du valt Enkla Bokslut — kul att du hoppade ombord!</p>
            <p style="margin:0 0 16px;font-size:15px;color:#5a6a7a;line-height:1.7;">Nu är allt uppsatt och klart — du behöver inte göra något mer för att komma igång.</p>
            <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Härifrån är det enkelt: mejla in dina underlag löpande, så tar vi hand om resten. Underlagen kan bestå av till exempel text, foton, kontoutdrag, pdf-filer eller excelfiler. Huvudsaken är att vi får de uppgifter vi behöver för att kunna kontera dem på ett säkert sätt.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf3f3;border-radius:8px;border:1px solid #f5d7d9;margin-bottom:24px;">
              <tr><td style="padding:20px;text-align:center;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Skicka dina underlag till</p>
                <p style="margin:0;font-size:18px;font-weight:700;"><a href="mailto:erik@enklabokslut.se" style="color:#E95C63;text-decoration:none;">erik@enklabokslut.se</a></p>
              </td></tr>
            </table>
            <p style="margin:0 0 16px;font-size:15px;color:#5a6a7a;line-height:1.7;">I början kommer vi säkert att ställa en del frågor:)</p>
            <p style="margin:0 0 16px;font-size:15px;color:#5a6a7a;line-height:1.7;">Du använder alltid denna e-postadress när du mailar till oss oavsett om det är frågor eller underlag du skickar in.</p>
            <p style="margin:0 0 16px;font-size:15px;color:#5a6a7a;line-height:1.7;">För att vi ska komma igång får du gärna börja skicka in underlag direkt. Då kan vi se att underlagen innehåller den information vi behöver för att kunna bokföra dem rätt och om det är något vi behöver komplettera med hör vi av oss.</p>
            <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Har du några frågor är det bara att höra av dig.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Din prenumeration</p>
                <p style="margin:0;font-size:15px;color:#173b57;"><strong>Plan:</strong> Enkla Bokslut</p>
                <p style="margin:4px 0 0;font-size:15px;color:#173b57;"><strong>Pris:</strong> ${planLabel}</p>
              </td></tr>
            </table>
            <p style="margin:0;font-size:15px;color:#173b57;">Med vänlig hälsning,<br><strong>Erik</strong><br><span style="color:#8fa3b1;">Enkla Bokslut</span></p>
          </td></tr>
          ${emailFooter}
        </td></tr>
      </table>
    </body></html>
  `;

  await Promise.all([
    resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to: INTERNAL_NOTICE_TO,
      subject: `Ny prenumerant – ${name || email}`,
      html: `
        <h2>Ny prenumerant!</h2>
        <p><strong>Namn:</strong> ${name || '—'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Plan:</strong> ${planLabel}</p>
        <p><strong>Kontaktmetod:</strong> ${contactMethod === 'meeting' ? 'Möte' : 'Mail'}</p>
      `,
    }),
    sendViaGmail({
      to: email,
      subject: 'Välkommen till Enkla Bokslut!',
      html: customerHtml,
      kind: 'valkommen',
    }),
  ]);
}
