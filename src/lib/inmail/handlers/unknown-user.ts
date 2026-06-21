import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import crypto from 'crypto';

interface InterestClassification {
  isInterested: boolean;
  isExistingCustomer: boolean;
  message: string;
}

async function classifyUnknownUser(body: string, subject: string): Promise<InterestClassification> {
  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}

Du avgör om en person som mejlat är intresserad av tjänsten, eller om de verkar tro att de redan är kund.

Returnera JSON:
{
  "isInterested": boolean (true om de verkar intresserade av att bli kund),
  "isExistingCustomer": boolean (true om de verkar tro att de redan är kund men mejlar från fel adress),
  "message": "ett kort personligt svar på svenska som besvarar deras fråga och presenterar tjänsten om de är intresserade. Max 200 ord."
}`;

  const raw = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Ämne: ${subject || '(inget ämne)'}\n\nMejltext:\n${body.slice(0, 1000)}` },
    ],
    responseFormat: { type: 'json_object' },
    maxTokens: 600,
  });

  return parseJSON<InterestClassification>(raw);
}

export async function handleUnknownUser(params: {
  supabase: SupabaseClient;
  senderEmail: string;
  subject: string;
  body: string;
  gmailThreadId: string;
  messageId: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, senderEmail, subject, body, gmailThreadId, messageId } = params;

  const classification = await classifyUnknownUser(body, subject);

  if (classification.isExistingCustomer) {
    return {
      action: 'unknown_user_existing',
      replyBody: `Hej!\n\nVi kunde inte hitta något konto kopplat till ${senderEmail}.\n\nKontrollera att du mejlar från samma adress som du registrerade dig med. Logga gärna in på app.enklabokslut.se för att se vilken e-postadress som är kopplad till ditt konto.\n\nHar du frågor? Svara på det här mejlet så hjälper vi dig.\n\n// Enkla Bokslut`,
    };
  }

  // Create registration token for interested prospects
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  try {
    await supabase.from('pending_registrations').insert({
      email: senderEmail,
      token,
      expires_at: expiresAt,
      gmail_thread_id: gmailThreadId,
      source: 'email_inquiry',
    });
  } catch { /* non-blocking */ }

  const registrationLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://enklabokslut.se'}/skapa-konto?token=${token}&email=${encodeURIComponent(senderEmail)}`;

  const serviceInfo = `
PRIS: 299 kr/mån (eller 3 499 kr/år) — allt inkluderat, ingen bindningstid.

INGÅR:
✓ Löpande bokföring
✓ Förenklat årsbokslut
✓ NE-bilaga och momsdeklaration
✓ Vi lämnar in till Skatteverket
✓ Inget bokföringsprogram behövs

PASSAR: Enskilda firmor utan anställda, omsättning upp till 3 mkr/år.`;

  let replyBody: string;

  if (classification.isInterested) {
    replyBody = `${classification.message}\n\n${serviceInfo}\n\nRedo att komma igång? Skapa ditt konto här:\n${registrationLink}\n\nEller boka ett gratis möte med oss: enklabokslut.se/boka-mote\n\n// Enkla Bokslut`;
  } else {
    replyBody = `Hej!\n\nTack för ditt mejl! Vi är Enkla Bokslut — en bokföringstjänst för enskilda firmor.\n${serviceInfo}\n\nÄr du intresserad? Skapa konto här:\n${registrationLink}\n\nEller boka ett gratis möte: enklabokslut.se/boka-mote\n\n// Enkla Bokslut`;
  }

  // Save thread for potential follow-up
  try {
    await supabase.from('email_threads').insert({
      gmail_thread_id: gmailThreadId,
      last_message_id: messageId,
      transaction_ids: [],
      state: `prospect:${senderEmail}`,
    });
  } catch { /* non-blocking */ }

  return { action: 'unknown_user_interested', replyBody };
}
