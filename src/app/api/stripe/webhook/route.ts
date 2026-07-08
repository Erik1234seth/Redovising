import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmails } from '@/lib/welcome-email';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
    const price = subscription.items.data[0].price;
    const billingPeriod = price.recurring?.interval === 'year' ? 'yearly' : 'monthly';

    await supabase.from('subscriptions').upsert(
      {
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        email: session.customer_email,
        status: subscription.status,
        price_id: price.id,
        billing_period: billingPeriod,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        metadata: session.metadata,
      },
      { onConflict: 'stripe_subscription_id' }
    );

    // Koppla prenumerationen till användarens profil så app-låsningen släpper
    const userId = session.metadata?.userId || session.client_reference_id;
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          subscription_status: subscription.status,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        })
        .eq('id', userId);
    }

    const email = session.customer_email;
    const name = session.metadata?.name || '';
    const contactMethod = session.metadata?.contactMethod || 'email';
    const planLabel = billingPeriod === 'yearly' ? '3 999 kr/år' : '299 kr/mån';

    if (email) {
      await sendWelcomeEmails({ email, name, contactMethod, planLabel });
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = event.data.object as any;
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      })
      .eq('stripe_subscription_id', subscription.id);

    // Spegla statusen på profilen (t.ex. canceled → låser appen igen)
    await supabase
      .from('profiles')
      .update({ subscription_status: subscription.status })
      .eq('stripe_subscription_id', subscription.id);
  }

  return NextResponse.json({ received: true });
}
