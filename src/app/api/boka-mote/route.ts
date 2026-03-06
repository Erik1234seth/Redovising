import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, date, time, message } = await req.json();

    if (!name || !email || !date || !time) {
      return NextResponse.json({ error: 'Namn, email, datum och tid krävs' }, { status: 400 });
    }

    const supabase = getSupabase();
    await supabase.from('meetings').insert({ name, email, phone: phone || null, date, time, message: message || null });

    const formattedDate = formatDate(date);

    // Notify Erik
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to: 'erik@enklabokslut.se',
      subject: `Nytt möte bokat – ${formattedDate} ${time}`,
      html: `
        <h2>Nytt möte bokat</h2>
        <p><strong>Namn:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || '—'}</p>
        <p><strong>Datum:</strong> ${formattedDate}</p>
        <p><strong>Tid:</strong> ${time}</p>
        ${message ? `<p><strong>Meddelande:</strong> ${message}</p>` : ''}
      `,
    });

    // Confirm to customer
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      replyTo: 'erik@enklabokslut.se',
      to: email,
      subject: `Mötesbekräftelse – ${formattedDate} kl. ${time}`,
      html: `
        <!DOCTYPE html>
        <html lang="sv">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background-color:#173b57;padding:32px 40px;text-align:center;">
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td style="background-color:#E95C63;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                          <span style="color:#ffffff;font-size:20px;font-weight:bold;line-height:36px;">✓</span>
                        </td>
                        <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;vertical-align:middle;">
                          Enkla Bokslut
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;">
                    <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#173b57;">
                      Möte bokat, ${name.split(' ')[0]}!
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;color:#5a6a7a;line-height:1.6;">
                      Vi ses på utsatt tid. Hör gärna av dig om du behöver ändra.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                      <tr><td style="padding:20px;">
                        <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Din bokning</p>
                        <p style="margin:0 0 4px;font-size:15px;color:#173b57;"><strong>Datum:</strong> ${formattedDate}</p>
                        <p style="margin:0;font-size:15px;color:#173b57;"><strong>Tid:</strong> ${time}</p>
                      </td></tr>
                    </table>
                    <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.6;">
                      Vi ringer upp dig på utsatt tid. Svara direkt på detta mail om du har frågor eller behöver byta tid.
                    </p>
                    <p style="margin:0;font-size:15px;color:#173b57;">
                      Med vänlig hälsning,<br>
                      <strong>Erik</strong><br>
                      <span style="color:#8fa3b1;">Enkla Bokslut</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#8fa3b1;">
                      Enkla Bokslut · <a href="https://enklabokslut.se" style="color:#E95C63;text-decoration:none;">enklabokslut.se</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Booking error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
