import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import { REPLY_RULES } from '../reply-rules';
import crypto from 'crypto';

interface InitialReply {
  isInterested: boolean;
  isExistingCustomer: boolean;
  includeLink: boolean;
  message: string;
}

async function generateInitialReply(
  body: string,
  subject: string,
  registrationLink: string,
  history?: string,
): Promise<InitialReply> {
  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}

Du jobbar på Enkla Bokslut och svarar en potentiell kund. Håll det kort. Ingen säljig ton, inga tomma fraser. Svara rakt på frågan, var hjälpsam och professionell men avslappnad.

Lägg bara med registreringslänken (${registrationLink}) om de tydligt vill komma igång eller skapa konto. Annars svarar du bara på frågan.
${history ? `
Det här är ett svar i en pågående mejlkonversation, inte första kontakten. Hälsa inte som om ni aldrig pratat, och upprepa inte sådant som redan står i historiken. Har länken redan skickats behöver den inte med igen.
` : ''}
${REPLY_RULES}

Returnera JSON:
{
  "isInterested": boolean,
  "isExistingCustomer": boolean,
  "includeLink": boolean,
  "message": "..."
}`;

  const userContent = [
    `Ämne: ${subject || '(inget ämne)'}`,
    history ? `\nTidigare i tråden:\n${history.slice(-3000)}` : '',
    `\nMejltext:\n${body.slice(0, 1000)}`,
  ].join('\n');

  const raw = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
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
  /** Sätts när det här är ett svar i en tråd, inte första mejlet. */
  emailHistory?: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, senderEmail, subject, body, gmailThreadId, messageId, emailHistory } = params;

  // Har personen redan fått en länk som fortfarande går att använda återanvänds
  // den. Annars skulle varje svar i tråden mynta ett nytt token, och mottagaren
  // sitta med flera länkar där bara den sista fungerar som väntat.
  const { data: existingLink } = await supabase
    .from('pending_registrations')
    .select('token')
    .eq('email', senderEmail)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const token = existingLink?.token ?? crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://enklabokslut.se';
  const registrationLink = `${siteUrl}/skaffa?token=${token}&email=${encodeURIComponent(senderEmail)}`;

  let reply: InitialReply;
  try {
    reply = await generateInitialReply(body, subject, registrationLink, emailHistory);
  } catch (err) {
    console.error('[unknown-user] generateInitialReply failed:', err);
    reply = {
      isInterested: true,
      isExistingCustomer: false,
      includeLink: true,
      message: `Hej!\n\nTack för ditt mejl! Du kan komma igång direkt här:\n${registrationLink}`,
    };
  }

  if (reply.isExistingCustomer) {
    return {
      action: 'unknown_user_existing',
      replyBody: `Hej!\n\nVi kunde inte hitta något konto kopplat till ${senderEmail}.\n\nKontrollera att du mejlar från samma adress som du registrerade dig med. Har du frågor är det bara att svara på det här mejlet.`,
    };
  }

  // Spara registreringslänk och tråd bara om länken faktiskt skickades
  if (reply.includeLink) {
    if (!existingLink) {
      const { error } = await supabase.from('pending_registrations').insert({
        email: senderEmail,
        token,
        expires_at: expiresAt,
        gmail_thread_id: gmailThreadId,
        source: 'email_inquiry',
      });
      if (error) console.error('[unknown-user] kunde inte spara länken:', error.message);
    }

    // Ingen unik nyckel på gmail_thread_id, så en blind insert ger en dubblett
    // vid varje svar — och `/api/inmail/reply` läser tråden med .single(), som
    // slutar fungera så fort det finns två rader.
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('gmail_thread_id', gmailThreadId)
      .limit(1)
      .maybeSingle();

    const { error } = thread
      ? await supabase
          .from('email_threads')
          .update({ last_message_id: messageId, updated_at: new Date().toISOString() })
          .eq('id', thread.id)
      : await supabase.from('email_threads').insert({
          gmail_thread_id: gmailThreadId,
          last_message_id: messageId,
          transaction_ids: [],
          state: `prospect:${senderEmail}`,
        });

    if (error) console.error('[unknown-user] kunde inte spara tråden:', error.message);
  }

  return {
    action: reply.includeLink ? 'unknown_user_prospect' : 'unknown_user_general',
    replyBody: reply.message,
  };
}
