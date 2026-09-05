import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendAndLog, INTERNAL_NOTICE_TO } from '@/lib/email-log';
import { createClient } from '@supabase/supabase-js';
import { meetingConfirmationEmail } from '@/lib/emails/meeting-confirmation';

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
    const { name, email, phone, date, time, message, sessionId } = await req.json();

    if (!name || !email || !date || !time) {
      return NextResponse.json({ error: 'Namn, email, datum och tid krävs' }, { status: 400 });
    }

    const supabase = getSupabase();
    await supabase.from('meetings').insert({ name, email, phone: phone || null, date, time, message: message || null, session_id: sessionId || null });

    const formattedDate = formatDate(date);

    // Notify oss
    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to: INTERNAL_NOTICE_TO,
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

    // Confirm to customer — samma mejl som popupen skickar, byggt på ett
    // ställe så att en bokning ser likadan ut oavsett var den gjordes.
    const booking = meetingConfirmationEmail({ name, phone, date, time });

    await sendAndLog(resend, {
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      replyTo: 'erik@enklabokslut.se',
      to: email,
      subject: booking.subject,
      html: booking.html,
    }, 'motebokning');

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Booking error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
