import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmails } from '@/lib/welcome-email';
import { packages } from '@/data/packages';
import { formateraPris } from '@/lib/kundpris';
import { TIDIGARE_PRIS } from '@/lib/tidigare-pris';

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
    .select('id, subscription_status, tidigare_pris')
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

  // Kundens årspris låses första gången. Går en befintlig årskund igenom
  // flödet igen ska hen inte hamna på ett höjt pris.
  const { data: befintlig } = await supabase
    .from('subscriptions')
    .select('pris_kr')
    .eq('stripe_subscription_id', `yearly_${userId}`)
    .maybeSingle();
  const prisKr: number = befintlig?.pris_kr
    ?? (profile.tidigare_pris ? TIDIGARE_PRIS.yearlyPrice : packages[0].yearlyPrice);

  // Registrera årsabonnemanget så det syns på konto-sidan (idempotent via syntetiskt id)
  await supabase.from('subscriptions').upsert(
    {
      stripe_subscription_id: `yearly_${userId}`,
      email,
      status: 'invoice',
      billing_period: 'yearly',
      pris_kr: prisKr,
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
        planLabel: `${formateraPris(prisKr, 'yearly')} (exkl. moms) – faktureras när ditt årsbokslut lämnats in`,
      });
    } catch (err) {
      console.error('[yearly-signup] välkomstmejl misslyckades:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
