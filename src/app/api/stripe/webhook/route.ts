import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const price = subscription.items.data[0].price;

    await supabase.from('subscriptions').upsert(
      {
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        email: session.customer_email,
        status: subscription.status,
        price_id: price.id,
        billing_period: price.recurring?.interval === 'year' ? 'yearly' : 'monthly',
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        metadata: session.metadata,
      },
      { onConflict: 'stripe_subscription_id' }
    );
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  return NextResponse.json({ received: true });
}
