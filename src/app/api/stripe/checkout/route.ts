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
    return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/#packages`,
    metadata: metadata || {},
    locale: 'sv',
  });

  return NextResponse.json({ url: session.url });
}
