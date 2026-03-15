import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, phone, name, packageType, meetingDate, meetingTime, sessionId, qualificationAnswers, contactMethod } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email saknas' }, { status: 400 });
    }

    const packageName = packageType === 'komplett' ? 'Komplett tjänst' : 'NE-bilaga';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await supabase.from('contact_requests').insert({ email, phone: phone || null, name: name || null, package_type: packageType });

    // Save meeting booking if a time was selected
    if (meetingDate && meetingTime) {
      await supabase.from('meetings').insert({
        name: name || null,
        email,
        phone: phone || null,
        date: meetingDate,
        time: meetingTime,
        message: `Via flödet – ${packageName}`,
        session_id: sessionId || null,
      });
    }

    const formattedMeeting = meetingDate && meetingTime
      ? new Date(meetingDate + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' kl. ' + meetingTime
      : null;

    // Notify Erik
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to: 'erik@enklabokslut.se',
      subject: `Ny kontaktförfrågan – ${packageName}`,
      html: `
        <h2>Ny kontaktförfrågan</h2>
        <p><strong>Paket:</strong> ${packageName}</p>
        <p><strong>Namn:</strong> ${name || '—'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || '—'}</p>
        ${formattedMeeting ? `<p><strong>Möte bokat:</strong> ${formattedMeeting}</p>` : '<p>Kunden vill bli kontaktad via mail.</p>'}
        ${qualificationAnswers ? `
        <hr>
        <h3>Svar från kvalificeringsfrågor</h3>
        <p><strong>Separat bankkonto:</strong> ${qualificationAnswers.hasSeparateAccount === true ? 'Ja' : qualificationAnswers.hasSeparateAccount === false ? 'Nej' : '—'}</p>
        <p><strong>Har anställda:</strong> ${qualificationAnswers.hasEmployees === true ? 'Ja' : qualificationAnswers.hasEmployees === false ? 'Nej' : '—'}</p>
        <p><strong>Inbetalningar till Skatteverket:</strong> ${qualificationAnswers.hasTaxPayments === true ? 'Ja' : qualificationAnswers.hasTaxPayments === false ? 'Nej' : '—'}</p>
        <p><strong>Första året med enskild firma:</strong> ${qualificationAnswers.isFirstYear === true ? 'Ja' : qualificationAnswers.isFirstYear === false ? 'Nej' : '—'}</p>
        <p><strong>Momspliktig:</strong> ${qualificationAnswers.isMomspliktig === true ? 'Ja' : qualificationAnswers.isMomspliktig === false ? 'Nej' : '—'}</p>
        ` : ''}
      `,
    });

    const firstName = name ? name.split(' ')[0] : '';
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
        <span style="display:none;max-height:0;overflow:hidden;">Vi ringer upp dig ${formattedMeeting} — hör av dig om du behöver ändra.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
          <tr><td align="center">
            ${emailHeader}
            <tr><td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#173b57;">Möte bokat${firstName ? ', ' + firstName : ''}!</p>
              <p style="margin:0 0 24px;font-size:16px;color:#5a6a7a;line-height:1.6;">Vi ringer upp dig <strong style="color:#173b57;">${formattedMeeting}</strong> för en kort genomgång av ditt ärende.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr><td style="padding:20px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Din bokning</p>
                  <p style="margin:0;font-size:15px;color:#173b57;"><strong>Paket:</strong> ${packageName}</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#173b57;"><strong>Tid:</strong> ${formattedMeeting}</p>
                  ${phone ? `<p style="margin:4px 0 0;font-size:15px;color:#173b57;"><strong>Vi ringer:</strong> ${phone}</p>` : ''}
                </td></tr>
              </table>
              <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.6;">Behöver du ändra tid? Svara direkt på detta mail.</p>
              <p style="margin:0;font-size:15px;color:#173b57;">Med vänlig hälsning,<br><strong>Erik</strong><br><span style="color:#8fa3b1;">Enkla Bokslut</span></p>
            </td></tr>
            ${emailFooter}
          </td></tr>
        </table>
      </body></html>
    ` : `
      <!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <span style="display:none;max-height:0;overflow:hidden;">Tack för att du valde oss — här är allt du behöver för att komma igång.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
          <tr><td align="center">
            ${emailHeader}
            <tr><td style="padding:40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#173b57;font-weight:600;">Hej${firstName ? ' ' + firstName : ''},</p>
              ${packageType === 'komplett' ? `
              <p style="margin:0 0 16px;font-size:15px;color:#5a6a7a;line-height:1.7;">Tack för att du valt Komplett tjänst — kul att du hoppade ombord! Det betyder att vi tar hand om allt åt dig: bokföring, momsredovisning, bokslut och NE-bilaga. Vi sköter även inlämningen till Skatteverket som ditt ombud, så du slipper hålla koll på det själv.</p>
              <p style="margin:0 0 12px;font-size:15px;color:#5a6a7a;line-height:1.7;">Innan vi sätter igång undrar jag ett par saker för att få en bra bild av läget:</p>
              <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#5a6a7a;line-height:1.9;">
                <li>Har du bokfört under året — och i så fall hur? (program, Excel, eller inte kommit igång med det ännu?)</li>
                <li>Hur länge har du haft firman?</li>
                <li>Har du haft några större inköp eller investeringar under året?</li>
                <li>Fakturerar du via något system, som Fortnox, eller gör du det manuellt?</li>
              </ul>
              <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Det spelar absolut ingen roll vad svaret är — vi hjälper till oavsett. Jag frågar bara för att vi ska kunna lägga upp arbetet på bästa sätt från start.</p>
              ` : `
              <p style="margin:0 0 16px;font-size:15px;color:#5a6a7a;line-height:1.7;">Tack för att du valt NE-bilaga — roligt att du valt oss! Vi tar fram din NE-bilaga inför deklarationen, så lämnar du sedan in den till Skatteverket själv.</p>
              <p style="margin:0 0 12px;font-size:15px;color:#5a6a7a;line-height:1.7;">För att vi ska komma igång på rätt sätt undrar jag ett par saker:</p>
              <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#5a6a7a;line-height:1.9;">
                <li>Har du bokfört under året — och i så fall hur? (program, Excel, eller har det inte blivit gjort än?)</li>
                <li>Hur länge har du haft firman?</li>
                <li>Har du haft några större inköp eller investeringar under året?</li>
                <li>Fakturerar du via något system, som Fortnox, eller gör du det manuellt?</li>
              </ul>
              <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Inget rätt eller fel svar — vi löser det oavsett. Jag frågar bara för att kunna ge dig rätt info direkt.</p>
              `}
              <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Svara gärna direkt på detta mail med dina svar — eller om du har egna frågor är det bara att ställa dem där, det är jag som läser det.</p>
              <p style="margin:0;font-size:15px;color:#173b57;">Med vänlig hälsning,<br><strong>Erik</strong><br><span style="color:#8fa3b1;">Enkla Bokslut</span></p>
            </td></tr>
            ${emailFooter}
          </td></tr>
        </table>
      </body></html>
    `;

    // Send confirmation to customer
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      replyTo: 'erik@enklabokslut.se',
      to: email,
      subject: contactMethod === 'meeting' ? `Möte bokat – ${formattedMeeting}` : 'Välkommen – ett par snabba frågor',
      html: customerHtml,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Contact request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
