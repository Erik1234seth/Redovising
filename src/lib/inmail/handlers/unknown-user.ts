import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import crypto from 'crypto';

interface InitialReply {
  isInterested: boolean;
  isExistingCustomer: boolean;
  includeLink: boolean;
  message: string;
}

async function generateInitialReply(body: string, subject: string, registrationLink: string): Promise<InitialReply> {
  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}

Du jobbar på Enkla Bokslut och svarar på ett mejl. Håll det kort och mänskligt — max 60 ord, ingen säljig ton, inga onödiga hälsningsfraser. Bara svara på det de undrar, som om det vore en kollega som skriver tillbaka. Avsluta med "// Enkla Bokslut".

Lägg bara med registreringslänken (${registrationLink}) om de tydligt vill komma igång eller skapa konto. Annars — svara bara på frågan.

Returnera JSON:
{
  "isInterested": boolean,
  "isExistingCustomer": boolean,
  "includeLink": boolean,
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
      includeLink: true,
      message: `Hej!\n\nTack för ditt mejl! Du kan komma igång direkt här:\n${registrationLink}\n\n// Enkla Bokslut`,
    };
  }

  if (reply.isExistingCustomer) {
    return {
      action: 'unknown_user_existing',
      replyBody: `Hej!\n\nVi kunde inte hitta något konto kopplat till ${senderEmail}.\n\nKontrollera att du mejlar från samma adress som du registrerade dig med. Har du frågor är det bara att svara på det här mejlet.\n\n// Enkla Bokslut`,
    };
  }

  // Spara registreringslänk och tråd bara om länken faktiskt skickades
  if (reply.includeLink) {
    try {
      await supabase.from('pending_registrations').insert({
        email: senderEmail,
        token,
        expires_at: expiresAt,
        gmail_thread_id: gmailThreadId,
        source: 'email_inquiry',
      });
    } catch { /* non-blocking */ }

    try {
      await supabase.from('email_threads').insert({
        gmail_thread_id: gmailThreadId,
        last_message_id: messageId,
        transaction_ids: [],
        state: `prospect:${senderEmail}`,
      });
    } catch { /* non-blocking */ }
  }

  return {
    action: reply.includeLink ? 'unknown_user_prospect' : 'unknown_user_general',
    replyBody: reply.message,
  };
}
