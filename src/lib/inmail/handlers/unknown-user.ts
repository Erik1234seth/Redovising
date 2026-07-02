import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import crypto from 'crypto';

interface InitialReply {
  isInterested: boolean;
  isExistingCustomer: boolean;
  message: string;
}

async function generateInitialReply(body: string, subject: string, registrationLink: string): Promise<InitialReply> {
  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}

Du är en person som jobbar på Enkla Bokslut. Någon har mejlat och verkar intresserad av tjänsten.

Skriv ett kort, personligt svar (max 120 ord) som:
- Besvarar deras specifika fråga kortfattat
- Presenterar tjänsten kort om det är relevant
- Avslutar med att bjuda in dem att skapa konto via länken: ${registrationLink}

Gör det naturligt — skriv som en riktig person, inte som ett system. Avsluta med "// Enkla Bokslut".

Returnera JSON:
{
  "isInterested": boolean,
  "isExistingCustomer": boolean,
  "message": "..."
}`;

  const raw = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Ämne: ${subject || '(inget ämne)'}\n\nMejltext:\n${body.slice(0, 1000)}` },
    ],
    responseFormat: { type: 'json_object' },
    maxTokens: 500,
  });

  return parseJSON<InitialReply>(raw);
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

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://enklabokslut.se';
  const registrationLink = `${siteUrl}/skaffa?token=${token}&email=${encodeURIComponent(senderEmail)}`;

  let reply: InitialReply;
  try {
    reply = await generateInitialReply(body, subject, registrationLink);
  } catch (err) {
    console.error('[unknown-user] generateInitialReply failed:', err);
    reply = {
      isInterested: true,
      isExistingCustomer: false,
      message: `Hej!\n\nTack för ditt mejl! Du kan komma igång direkt här:\n${registrationLink}\n\n// Enkla Bokslut`,
    };
  }

  if (reply.isExistingCustomer) {
    return {
      action: 'unknown_user_existing',
      replyBody: `Hej!\n\nVi kunde inte hitta något konto kopplat till ${senderEmail}.\n\nKontrollera att du mejlar från samma adress som du registrerade dig med. Har du frågor är det bara att svara på det här mejlet.\n\n// Enkla Bokslut`,
    };
  }

  // Spara registreringslänk
  try {
    await supabase.from('pending_registrations').insert({
      email: senderEmail,
      token,
      expires_at: expiresAt,
      gmail_thread_id: gmailThreadId,
      source: 'email_inquiry',
    });
  } catch { /* non-blocking */ }

  // Spara tråden
  try {
    await supabase.from('email_threads').insert({
      gmail_thread_id: gmailThreadId,
      last_message_id: messageId,
      transaction_ids: [],
      state: `prospect:${senderEmail}`,
    });
  } catch { /* non-blocking */ }

  if (!reply.isInterested) {
    return {
      action: 'unknown_user_not_interested',
      replyBody: `Hej!\n\nTack för ditt mejl! Vi är Enkla Bokslut — en bokföringstjänst för enskilda firmor till 299 kr/mån.\n\nVill du komma igång? Skapa konto här:\n${registrationLink}\n\n// Enkla Bokslut`,
    };
  }

  return {
    action: 'unknown_user_prospect',
    replyBody: reply.message,
  };
}
