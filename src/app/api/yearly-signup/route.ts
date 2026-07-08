import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmails } from '@/lib/welcome-email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Årsvis-modellen: kunden får tillgång direkt utan att betala i förskott.
// Vi fakturerar dem manuellt i Stripe först när vi lämnat in årsbokslutet.
// Status 'invoice' räknas som aktiv access (se AppShell / betalning / valkommen).
export async function POST(req: NextRequest) {
  const { userId, email, name, contactMethod } = await req.json();

  if (!userId || !email) {
    return NextResponse.json({ error: 'Saknar användaruppgifter' }, { status: 400 });
  }

  // Verifiera att användaren finns och inte redan har en aktiv prenumeration
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_status')
    .eq('id', userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Användaren hittades inte' }, { status: 404 });
  }

  const alreadyActive = ['active', 'trialing', 'invoice'].includes(profile.subscription_status ?? '');

  // Ge åtkomst
  await supabase
    .from('profiles')
    .update({ subscription_status: 'invoice' })
    .eq('id', userId);

  // Registrera årsabonnemanget så det syns på konto-sidan (idempotent via syntetiskt id)
  await supabase.from('subscriptions').upsert(
    {
      stripe_subscription_id: `yearly_${userId}`,
      email,
      status: 'invoice',
      billing_period: 'yearly',
      current_period_end: null,
      metadata: { userId, name: name ?? '', plan: 'yearly_invoice' },
    },
    { onConflict: 'stripe_subscription_id' }
  );

  // Skicka välkomstmejl bara första gången
  if (!alreadyActive) {
    try {
      await sendWelcomeEmails({
        email,
        name,
        contactMethod,
        planLabel: '3 999 kr/år (exkl. moms) – faktureras när ditt årsbokslut lämnats in',
      });
    } catch (err) {
      console.error('[yearly-signup] välkomstmejl misslyckades:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
