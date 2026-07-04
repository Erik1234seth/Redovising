import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

const PRICE_IDS = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID!,
  yearly: process.env.STRIPE_YEARLY_PRICE_ID!,
};

export async function POST(req: NextRequest) {
  const { billingPeriod, email, metadata } = await req.json();

  const priceId = PRICE_IDS[billingPeriod as 'monthly' | 'yearly'];
  if (!priceId) {
    return NextResponse.json({ error: 'Ogiltig betalningsperiod' }, { status: 400 });
  }

  // Redirekta tillbaka till samma domän som kunden faktiskt är på (app-subdomänen),
  // inte den globala NEXT_PUBLIC_SITE_URL (som pekar på marketing-domänen).
  const origin = req.headers.get('origin') || req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      client_reference_id: metadata?.userId || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      // Räkna och ta ut moms automatiskt (kräver Stripe Tax + svensk registrering)
      automatic_tax: { enabled: true },
      // Låt företagskunder ange sitt moms-/org-nr
      tax_id_collection: { enabled: true },
      success_url: `${origin}/valkommen`,
      cancel_url: `${origin}/betalning`,
      metadata: metadata || {},
      locale: 'sv',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kunde inte starta betalningen';
    console.error('[stripe/checkout] error:', message);
    return NextResponse.json({ error: 'Kunde inte starta betalningen. Försök igen eller kontakta oss.' }, { status: 500 });
  }
}
