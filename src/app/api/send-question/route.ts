import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { name, email, message, orderId } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Namn, e-post och meddelande krävs' },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to: ['info@enklabokslut.se'],
      replyTo: email,
      subject: `Fråga från ${name}${orderId ? ` (Order: ${orderId})` : ''}`,
      html: `
        <h2>Ny fråga från kund</h2>
        <p><strong>Namn:</strong> ${name}</p>
        <p><strong>E-post:</strong> ${email}</p>
        ${orderId ? `<p><strong>Order-ID:</strong> ${orderId}</p>` : ''}
        <hr />
        <h3>Meddelande:</h3>
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Kunde inte skicka meddelandet' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    );
  }
}
