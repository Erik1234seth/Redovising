import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, phone, packageType } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email saknas' }, { status: 400 });
    }

    const packageName = packageType === 'komplett' ? 'Komplett tjänst' : 'NE-bilaga';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await supabase.from('contact_requests').insert({ email, phone: phone || null, package_type: packageType });

    await resend.emails.send({
      from: 'Enkla Bokslut <noreply@enklabokslut.se>',
      to: 'erik@enklabokslut.se',
      subject: `Ny kontaktförfrågan – ${packageName}`,
      html: `
        <h2>Ny kontaktförfrågan</h2>
        <p><strong>Paket:</strong> ${packageName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || '—'}</p>
        <p>Kunden vill bli kontaktad via mail.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Contact request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
