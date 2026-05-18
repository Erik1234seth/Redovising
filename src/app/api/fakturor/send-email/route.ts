import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { to, pdfBase64, fakturaName } = await request.json();

    if (!to || !pdfBase64 || !fakturaName) {
      return NextResponse.json({ error: 'Saknar e-post, PDF eller fakturanummer' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const { error } = await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to,
      subject: `Faktura ${fakturaName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1e293b;">
          <div style="font-size: 22px; font-weight: 800; color: #173b57; margin-bottom: 16px;">Faktura ${fakturaName}</div>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Du har fått en faktura. Se bifogad PDF för detaljer.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 24px;" />
          <p style="color: #94a3b8; font-size: 12px;">Skickat via Enkla Bokslut</p>
        </div>
      `,
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
