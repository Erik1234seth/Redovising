import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const firstName = name.split(' ')[0];
    const planLabel = billingPeriod === 'yearly' ? '3 999 kr/år' : '299 kr/mån';

    if (email) {
      const emailHeader = `
        <table width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#173b57;padding:28px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#E95C63;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:20px;font-weight:bold;line-height:36px;">✓</span>
                  </td>
                  <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;vertical-align:middle;">Enkla Bokslut</td>
                </tr>
              </table>
            </td>
          </tr>`;

      const emailFooter = `
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#8fa3b1;">Enkla Bokslut · <a href="https://enklabokslut.se" style="color:#E95C63;text-decoration:none;">enklabokslut.se</a></p>
            </td>
          </tr>
        </table>`;

      const customerHtml = contactMethod === 'meeting' ? `
        <!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
            <tr><td align="center">
              ${emailHeader}
              <tr><td style="padding:40px;">
                <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#173b57;">Välkommen${firstName ? ', ' + firstName : ''}!</p>
                <p style="margin:0 0 24px;font-size:16px;color:#5a6a7a;line-height:1.6;">Din prenumeration är aktiverad. Vi hör av oss för att boka in ett möte så att vi kan gå igenom ditt ärende tillsammans.</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                  <tr><td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Din prenumeration</p>
                    <p style="margin:0;font-size:15px;color:#173b57;"><strong>Plan:</strong> Enkla Bokslut</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#173b57;"><strong>Pris:</strong> ${planLabel}</p>
                  </td></tr>
                </table>
                <p style="margin:0;font-size:15px;color:#173b57;">Med vänlig hälsning,<br><strong>Erik</strong><br><span style="color:#8fa3b1;">Enkla Bokslut</span></p>
              </td></tr>
              ${emailFooter}
            </td></tr>
          </table>
        </body></html>
      ` : `
        <!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
            <tr><td align="center">
              ${emailHeader}
              <tr><td style="padding:40px;">
                <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#173b57;">Välkommen${firstName ? ', ' + firstName : ''}!</p>
                <p style="margin:0 0 16px;font-size:16px;color:#5a6a7a;line-height:1.6;">Tack för att du valt Enkla Bokslut — kul att du hoppade ombord! Vi tar hand om din bokföring, momsredovisning, bokslut och NE-bilaga.</p>
                <p style="margin:0 0 12px;font-size:15px;color:#5a6a7a;line-height:1.7;">Innan vi sätter igång undrar jag ett par saker för att få en bra bild av läget:</p>
                <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#5a6a7a;line-height:1.9;">
                  <li>Har du bokfört under året — och i så fall hur?</li>
                  <li>Hur länge har du haft firman?</li>
                  <li>Har du haft några större inköp eller investeringar under året?</li>
                  <li>Fakturerar du via något system, som Fortnox, eller gör du det manuellt?</li>
                  <li>Vad är ditt personnummer / org-nr?</li>
                </ul>
                <p style="margin:0 0 24px;font-size:15px;color:#5a6a7a;line-height:1.7;">Svara gärna direkt på detta mail — det är jag som läser det.</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                  <tr><td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#8fa3b1;">Din prenumeration</p>
                    <p style="margin:0;font-size:15px;color:#173b57;"><strong>Plan:</strong> Enkla Bokslut</p>
                    <p style="margin:4px 0 0;font-size:15px;color:#173b57;"><strong>Pris:</strong> ${planLabel}</p>
                  </td></tr>
                </table>
                <p style="margin:0;font-size:15px;color:#173b57;">Med vänlig hälsning,<br><strong>Erik</strong><br><span style="color:#8fa3b1;">Enkla Bokslut</span></p>
              </td></tr>
              ${emailFooter}
            </td></tr>
          </table>
        </body></html>
      `;

      await Promise.all([
        resend.emails.send({
          from: 'Enkla Bokslut <noreply@enklabokslut.se>',
          to: 'erik@enklabokslut.se',
          subject: `Ny prenumerant – ${name || email}`,
          html: `
            <h2>Ny prenumerant!</h2>
            <p><strong>Namn:</strong> ${name || '—'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Plan:</strong> ${planLabel}</p>
            <p><strong>Kontaktmetod:</strong> ${contactMethod === 'meeting' ? 'Möte' : 'Mail'}</p>
          `,
        }),
        resend.emails.send({
          from: 'Enkla Bokslut <noreply@enklabokslut.se>',
          replyTo: 'erik@enklabokslut.se',
          to: email,
          subject: 'Välkommen till Enkla Bokslut!',
          html: customerHtml,
        }),
      ]);
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
