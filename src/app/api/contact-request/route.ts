import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, packageType } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email saknas' }, { status: 400 });
    }

    const packageName = packageType === 'komplett' ? 'Komplett tjänst' : 'NE-bilaga';

    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to: 'erik@enklabokslut.se',
      subject: `Ny kontaktförfrågan – ${packageName}`,
      html: `
        <h2>Ny kontaktförfrågan</h2>
        <p><strong>Paket:</strong> ${packageName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>Kunden vill bli kontaktad via mail.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Contact request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
