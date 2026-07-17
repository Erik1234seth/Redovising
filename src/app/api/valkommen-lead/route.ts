import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { questions } from '@/data/kvalificera-questions';

const resend = new Resend(process.env.RESEND_API_KEY);

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

// Leads from the ad/brev funnel (/valkommen, and the popups on the landing
// page). Qualified visitors only — disqualified ones are sent to /kontakt
// instead and never reach this route.
export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, ref, answers } = await request.json();
    const sourceWord = typeof ref === 'string' && ref.toLowerCase().startsWith('brev-') ? 'brev' : 'annons';

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabase.from('contact_requests').insert({
      name: name || null,
      email,
      phone: phone || null,
      package_type: 'komplett',
      ref: typeof ref === 'string' ? ref.slice(0, 40) : null,
      qualification_answers: answers || null,
    });

    const answerRows = questions
      .map((q) => {
        const a = answers?.[q.id];
        const value = a === true ? 'Ja' : a === false ? 'Nej' : a === 'unknown' ? 'Vet inte' : '—';
        return `<tr>
          <td style="padding:6px 12px 6px 0;font-size:13px;color:#5a6a7a;">${q.text}</td>
          <td style="padding:6px 0;font-size:13px;font-weight:700;color:#173b57;white-space:nowrap;">${value}</td>
        </tr>`;
      })
      .join('');
    const hasUnknownAnswer = questions.some((q) => answers?.[q.id] === 'unknown');

    // Notify Erik
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      replyTo: email,
      to: 'erik@enklabokslut.se',
      subject: `Nytt lead från ${sourceWord}${ref ? ` (${ref})` : ''} – ${name || email}`,
      html: `
        <h2 style="color:${NAV_BG};">Nytt lead från /valkommen</h2>
        <p><strong>Namn:</strong> ${name || '—'}</p>
        <p><strong>E-post:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || '—'}</p>
        <p><strong>Källa:</strong> ${ref || '— (ingen ref i länken)'}</p>
        <hr>
        <h3 style="color:${NAV_BG};">Kvalificeringssvar</h3>
        <table cellpadding="0" cellspacing="0">${answerRows}</table>
        <p style="font-size:13px;color:${hasUnknownAnswer ? '#E95C63;font-weight:700;' : '#8fa3b1;'}">${
          hasUnknownAnswer
            ? 'Osäker på minst en fråga (se "Vet inte" ovan) — dubbelkolla innan du hör av dig.'
            : 'Personen klarade alla frågor.'
        } Svara direkt på det här mailet för att nå kunden.</p>
      `,
    });

    // Confirmation to the visitor
    const firstName = name ? String(name).split(' ')[0] : '';
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      replyTo: 'erik@enklabokslut.se',
      to: email,
      subject: 'Tack — vi hör av oss inom kort',
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
                  <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:${NAV_BG};">Tack${firstName ? ', ' + firstName : ''}!</p>
                  <p style="margin:0 0 20px;font-size:15px;color:#5a6a7a;line-height:1.7;">Vi har fått dina uppgifter, och utifrån dina svar passar Enkla Bokslut din verksamhet. Jag hör av mig inom kort med hur du kommer igång.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                    <tr><td style="padding:20px;">
                      <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Så funkar det</p>
                      <p style="margin:0 0 6px;font-size:14px;color:${NAV_BG};">1. Du mejlar in dina underlag</p>
                      <p style="margin:0 0 6px;font-size:14px;color:${NAV_BG};">2. Vi sköter bokföring, moms och bokslut</p>
                      <p style="margin:0;font-size:14px;color:${NAV_BG};">3. Vi lämnar in till Skatteverket</p>
                    </td></tr>
                  </table>
                  <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Har du frågor redan nu? Svara direkt på det här mailet — det är jag som läser det.</p>
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
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Valkommen lead error:', error);
    return NextResponse.json({ error: 'Kunde inte skicka. Försök igen.' }, { status: 500 });
  }
}
