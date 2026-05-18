import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailBody {
  to: string;
  pdfBase64: string;
  fakturaName: string;
  fakturaId: string;
  kundNamn: string;
  säljarNamn: string;
  belopp: string;
  forfalloDatum: string;
  betalningsinfo?: string | null;
}

export async function POST(request: Request) {
  try {
    const body: EmailBody = await request.json();
    const { to, pdfBase64, fakturaName, kundNamn, säljarNamn, belopp, forfalloDatum, betalningsinfo } = body;

    if (!to || !pdfBase64 || !fakturaName) {
      return NextResponse.json({ error: 'Saknar e-post, PDF eller fakturanummer' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td style="background:#173b57;border-radius:16px 16px 0 0;padding:32px 40px;">
          <div style="font-size:13px;font-weight:700;color:#93c5fd;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Faktura</div>
          <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${fakturaName}</div>
          <div style="font-size:14px;color:#94a3b8;margin-top:6px;">från ${säljarNamn}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px 40px;">
          <p style="font-size:15px;color:#334155;margin:0 0 8px;">Hej ${kundNamn},</p>
          <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 28px;">
            Du har fått en faktura från <strong style="color:#1e293b;">${säljarNamn}</strong>. Se bifogad PDF för alla detaljer.
          </p>

          <!-- Belopp-box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
            <tr>
              <td style="padding:20px 24px;border-right:1px solid #e2e8f0;">
                <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Att betala</div>
                <div style="font-size:22px;font-weight:800;color:#173b57;">${belopp}</div>
              </td>
              <td style="padding:20px 24px;">
                <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Förfallodatum</div>
                <div style="font-size:18px;font-weight:700;color:#1e293b;">${forfalloDatum}</div>
              </td>
            </tr>
          </table>

          ${betalningsinfo ? `
          <!-- Betalningsinfo -->
          <div style="background:#eff6ff;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
            <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Betalningsinfo</div>
            <div style="font-size:13px;color:#1e40af;line-height:1.7;white-space:pre-line;">${betalningsinfo}</div>
          </div>` : ''}

          <p style="font-size:13px;color:#94a3b8;margin:0;">Fakturan bifogas som PDF till detta mail.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid #e2e8f0;">
          <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">
            Skickat via <strong style="color:#64748b;">Enkla Bokslut</strong>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to,
      subject: `${fakturaName} från ${säljarNamn}`,
      html,
      attachments: [
        {
          filename: `${fakturaName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Kunde inte skicka e-post' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error in /api/fakturor/send-email:', err);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
