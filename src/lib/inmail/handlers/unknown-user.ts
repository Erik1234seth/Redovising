import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';

interface InitialReply {
  isInterested: boolean;
  isExistingCustomer: boolean;
  message: string;
}

async function generateInitialReply(body: string, subject: string): Promise<InitialReply> {
  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}

Du är en person som jobbar på Enkla Bokslut. Någon har mejlat och verkar intresserad av tjänsten.

Skriv ett kort, personligt svar (max 120 ord) som:
- Besvarar deras specifika fråga kortfattat
- Presenterar tjänsten om det är relevant
- Avslutar naturligt med att be om deras fullständiga namn — förklara att du behöver det för att upprätta NE-bilagan korrekt

Skriv som en riktig person, inte som ett system. Enkelt och varmt. Avsluta med "// Enkla Bokslut".

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

  let reply: InitialReply;
  try {
    reply = await generateInitialReply(body, subject);
  } catch (err) {
    console.error('[unknown-user] generateInitialReply failed:', err);
    reply = {
      isInterested: true,
      isExistingCustomer: false,
      message: 'Hej!\n\nKul att du hör av dig! Vi behöver ditt fullständiga namn för att kunna upprätta NE-bilagan korrekt — vad heter du?\n\n// Enkla Bokslut',
    };
  }

  if (reply.isExistingCustomer) {
    return {
      action: 'unknown_user_existing',
      replyBody: `Hej!\n\nVi kunde inte hitta något konto kopplat till ${senderEmail}.\n\nKontrollera att du mejlar från samma adress som du registrerade dig med. Har du frågor är det bara att svara på det här mejlet så hjälper vi dig.\n\n// Enkla Bokslut`,
    };
  }

  // Spara tråden som onboarding så vi kan fortsätta konversationen
  try {
    await supabase.from('email_threads').insert({
      gmail_thread_id: gmailThreadId,
      last_message_id: messageId,
      transaction_ids: [],
      state: `onboarding:${senderEmail}`,
    });
  } catch { /* non-blocking */ }

  if (!reply.isInterested) {
    return {
      action: 'unknown_user_not_interested',
      replyBody: `Hej!\n\nTack för ditt mejl! Vi är Enkla Bokslut — en bokföringstjänst för enskilda firmor till 299 kr/mån.\n\nHör gärna av dig om du har frågor.\n\n// Enkla Bokslut`,
    };
  }

  return {
    action: 'unknown_user_onboarding_started',
    replyBody: reply.message,
  };
}
