import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, phone, name, packageType } = await request.json();

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
        <p>Kunden vill bli kontaktad via mail.</p>
      `,
    });

    // Send confirmation to customer
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      replyTo: 'erik@enklabokslut.se',
      to: email,
      subject: 'Välkommen till Enkla Bokslut – Vi kontaktar dig inom kort',
      html: `
        <!DOCTYPE html>
        <html lang="sv">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Tack! Vi hör av oss inom kort med hjälp för ditt bokslut&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <!-- Header -->
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
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#173b57;">
                      Tack${name ? ', ' + name.split(' ')[0] : ''}!
                    </p>
                    <p style="margin:0 0 24px;font-size:16px;color:#5a6a7a;line-height:1.6;">
                      Vi har tagit emot din förfrågan om <strong>${packageName}</strong> och hör av oss inom kort.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                      <tr><td style="padding:20px;">
                        <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Din förfrågan</p>
                        <p style="margin:0;font-size:15px;color:#173b57;"><strong>Paket:</strong> ${packageName}</p>
                        ${phone ? `<p style="margin:4px 0 0;font-size:15px;color:#173b57;"><strong>Telefon:</strong> ${phone}</p>` : ''}
                      </td></tr>
                    </table>
                    <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.6;">
                      Har du frågor? Svara direkt på detta mail så når du mig.
                    </p>
                    <p style="margin:0;font-size:15px;color:#173b57;">
                      Med vänlig hälsning,<br>
                      <strong>Erik</strong><br>
                      <span style="color:#8fa3b1;">Enkla Bokslut</span>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
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
    console.error('Contact request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
