import crypto from 'crypto';

/**
 * Twilio-integration utan SDK — det är två HTTP-anrop och en HMAC, så en extra
 * dependency tillför inget.
 *
 * Kräver i .env.local:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER     avsändarnumret i E.164, t.ex. +46766861234
 *   TWILIO_WEBHOOK_URL      (valfri) exakt webhook-URL som står i Twilio-konsolen
 */

/**
 * Verifierar X-Twilio-Signature. Twilio signerar den fullständiga URL:en följd
 * av alla POST-fält sorterade på nyckel, med auth-token som HMAC-SHA1-nyckel.
 *
 * Detta är hela autentiseringen av webhooken — utan den kan vem som helst som
 * hittar URL:en få oss att skicka SMS. Failar validering: släng requesten.
 */
export function validateTwilioSignature(params: {
  signature: string | null;
  url: string;
  body: Record<string, string>;
  authToken: string;
}): boolean {
  const { signature, url, body, authToken } = params;
  if (!signature) return false;

  const data = Object.keys(body)
    .sort()
    .reduce((acc, key) => acc + key + body[key], url);

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  // Längdskillnad får timingSafeEqual att kasta, så kolla först
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Bygger den URL Twilio signerade. Bakom Vercels proxy är `request.url` intern,
 * så vi återskapar den publika adressen ur forwarding-headers. Stämmer den ändå
 * inte med det som står i Twilio-konsolen (t.ex. egen domän eller /-skillnad)
 * kan TWILIO_WEBHOOK_URL sättas för att slå fast den exakt.
 */
export function resolveWebhookUrl(request: Request): string {
  const override = process.env.TWILIO_WEBHOOK_URL;
  if (override) return override;

  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

/** Skickar ett SMS via Twilios REST-API. Kastar vid fel. */
export async function sendSms(params: { to: string; body: string }): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio saknar konfiguration (SID, token eller avsändarnummer)');
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: params.to, From: from, Body: params.body }),
    },
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${data?.message ?? 'okänt fel'}`);
  }
  return data?.sid ?? '';
}

/** Tomt TwiML-svar: kvitterar webhooken utan att Twilio skickar något. */
export function emptyTwiml(): Response {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
