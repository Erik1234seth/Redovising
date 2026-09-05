import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleNewLead } from '@/lib/sms/lead';
import { mapLeadPayload } from '@/lib/sms/lead-payload';

/**
 * Tar emot leads från Facebooks snabbformulär via Zapier och skickar ett
 * välkomst-SMS. Svarar personen på det tar `/api/sms` och AI:n över.
 *
 * Zapen: trigger "Facebook Lead Ads – New Lead", action "Webhooks by Zapier –
 * POST" hit, med headern `x-lead-secret` satt till LEAD_WEBHOOK_SECRET.
 *
 * Vill du senare gå direkt mot Metas egen webhook istället för Zapier räcker
 * det att komplettera den här filen — `mapLeadPayload` klarar redan Metas
 * `field_data`-format, och `handleNewLead` är oförändrad.
 */
export const maxDuration = 60;

/** Konstanttidsjämförelse så att hemligheten inte kan gissas fram tecken för tecken. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.LEAD_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[lead] LEAD_WEBHOOK_SECRET saknas — endpointen är avstängd');
    return NextResponse.json({ error: 'Inte konfigurerad' }, { status: 503 });
  }

  const provided =
    request.headers.get('x-lead-secret') ??
    new URL(request.url).searchParams.get('secret') ??
    '';

  if (!secretMatches(provided, secret)) {
    console.warn('[lead] fel eller saknad hemlighet, requesten slängd');
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Payloaden sparas rå innan vi tolkar den. Fältnamnen kommer från
  // formulärets egna frågetexter och ändras varje gång ett steg läggs till —
  // utan den här raden går det inte att se vad Zapen faktiskt skickade, bara
  // vad vi råkade känna igen. Får aldrig stoppa leadet.
  await supabase
    .from('webhook_logs')
    .insert({ payload: { source: 'facebook-lead', body: payload } })
    .then(({ error }) => {
      if (error) console.warn('[lead] kunde inte logga payloaden:', error.message);
    });

  const { lead, keys } = mapLeadPayload(payload);

  if (!lead.phone && !lead.email) {
    console.warn('[lead] varken telefon eller e-post i payloaden, nycklar:', keys.join(', '));
    return NextResponse.json(
      { error: 'Hittade varken telefon eller e-post', keys },
      { status: 400 },
    );
  }

  // Zapier väntar på svaret, så resultatet syns direkt i Zapens historik.
  // SMS:et tar ungefär en sekund; det är billigare än att felsöka i blindo.
  const result = await handleNewLead(supabase, lead);

  // `keys` följer med även när allt gick bra: de syns i Zapens historik och är
  // det snabbaste sättet att se vad ett nytt formulärsteg heter.
  return NextResponse.json({ ok: result.outcome !== 'failed', ...result, keys });
}
