import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isValidShop, markeraAvinstallerad, verifyWebhookHmac } from '@/lib/shopify/auth';

/**
 * Shopifys webhooks. Prenumerationerna anges i appens inställningar i Dev
 * Dashboard, alla mot den här adressen.
 *
 *  - app/uninstalled: butiken tog bort appen. Token slängs.
 *  - customers/data_request, customers/redact: GDPR. Vi hämtar aldrig
 *    kunduppgifter (namn, e-post, adresser) från ordrarna, så det finns inget
 *    att lämna ut eller radera.
 *  - shop/redact: 48 timmar efter avinstallation. Rådatan från butiken raderas.
 *    Dagskassorna i bokföringen ligger kvar — de är butiksägarens egen
 *    bokföring (som ska sparas i sju år) och innehåller inga kunduppgifter.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookHmac(raw, request.headers.get('x-shopify-hmac-sha256'))) {
    return NextResponse.json({ error: 'Ogiltig signatur' }, { status: 401 });
  }

  const topic = request.headers.get('x-shopify-topic');
  const shop = request.headers.get('x-shopify-shop-domain');
  if (!isValidShop(shop)) return NextResponse.json({ ok: true });

  const supabase = createServerClient();
  switch (topic) {
    case 'app/uninstalled':
      await markeraAvinstallerad(supabase, shop);
      break;
    case 'shop/redact': {
      const { error } = await supabase.from('shopify_butiker').delete().eq('shop', shop);
      if (error) {
        console.error('[shopify/webhooks] shop/redact', error);
        return NextResponse.json({ error: 'Kunde inte radera' }, { status: 500 });
      }
      break;
    }
    case 'customers/data_request':
    case 'customers/redact':
      break;
  }

  return NextResponse.json({ ok: true });
}
