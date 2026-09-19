import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import { REPLY_RULES } from '../reply-rules';

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
  attachmentNames: string[] = [],
): Promise<InitialReply> {
  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}

Du jobbar på Enkla Bokslut och svarar en potentiell kund. Håll det kort. Ingen säljig ton, inga tomma fraser. Svara rakt på frågan, var hjälpsam och professionell men avslappnad.

Lägg bara med registreringslänken (${registrationLink}) om de tydligt vill komma igång eller skapa konto. Annars svarar du bara på frågan.
${attachmentNames.length ? `
Personen har bifogat filer. De är redan sparade, och att vi tagit emot dem bekräftas automatiskt i ett eget stycke efter ditt svar. Nämn inte filerna och ställ inga frågor om dem.
Innehåller mejltexten ingen egen fråga eller begäran utöver filerna (tom text, bara en hälsning eller signatur, "se bifogat" och liknande), sätt message till en tom sträng och includeLink till false. Då skickas bara bekräftelsen.
` : ''}
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
    attachmentNames.length ? `Bilagor: ${attachmentNames.join(', ')}` : '',
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
    maxTokens: 8000,
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
  /** Namnen på bifogade filer. De är redan sparade som underlag. */
  attachmentNames?: string[];
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, senderEmail, subject, body, gmailThreadId, messageId, emailHistory } = params;
  const attachmentNames = params.attachmentNames ?? [];

  // En vanlig länk till prissidan, utan token. Tokenet fyllde ingen funktion:
  // /skaffa läste det aldrig, och signup-sidan fick det aldrig skickat till sig.
  // Avslutande snedstreck kapas så länken inte blir "enklabokslut.se//skaffa"
  // när variabeln råkar sluta på "/".
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://enklabokslut.se').replace(/\/+$/, '');
  const registrationLink = `${siteUrl}/skaffa`;

  let reply: InitialReply;
  try {
    reply = await generateInitialReply(body, subject, registrationLink, emailHistory, attachmentNames);
  } catch (err) {
    // Inget standardsvar här. Tidigare gick ett hårdkodat "registrera dig"-mejl ut
    // så fort AI:n fallerade — även till avsändare som aldrig frågat efter det, som
    // automatiska notismejl. Utan replyBody skapar Apps Script inget utkast, och
    // mejlet får hanteras för hand i stället.
    console.error('[unknown-user] generateInitialReply failed:', err);
    return { action: 'unknown_user_failed', replyBody: '' };
  }

  if (reply.isExistingCustomer) {
    return {
      action: 'unknown_user_existing',
      replyBody: `Hej!\n\nVi kunde inte hitta något konto kopplat till ${senderEmail}.\n\nKontrollera att du mejlar från samma adress som du registrerade dig med. Har du frågor är det bara att svara på det här mejlet.`,
    };
  }

  // Tråden antecknas alltid, inte bara när länken gick med.
  //
  // Förut skrevs raden enbart om `includeLink` var sant. Den som svarade "nej
  // tack" eller ställde en fråga utan att vilja komma igång lämnade alltså inget
  // spår alls — och för påminnelsejobbet såg det ut som om personen aldrig hört
  // av sig. Att få en påminnelse efter att uttryckligen ha tackat nej är det
  // sämsta utskicket vi kan göra.
  //
  // Tillståndet skiljer ändå på de två: `prospect:` betyder att vi skickat
  // länken och har ett lead att följa upp, `kontakt:` att personen skrivit men
  // inte är på väg att registrera sig. Båda räknas som svar.
  const state = reply.includeLink ? `prospect:${senderEmail}` : `kontakt:${senderEmail}`;

  // Ingen unik nyckel på gmail_thread_id, så en blind insert ger en dubblett
  // vid varje svar — och `/api/inmail/reply` läser tråden med .single(), som
  // slutar fungera så fort det finns två rader.
  const { data: thread } = await supabase
    .from('email_threads')
    .select('id, state')
    .eq('gmail_thread_id', gmailThreadId)
    .limit(1)
    .maybeSingle();

  const { error } = thread
    ? await supabase
        .from('email_threads')
        .update({
          last_message_id: messageId,
          updated_at: new Date().toISOString(),
          // En tråd som en gång blivit prospect ska inte degraderas till kontakt
          // för att nästa mejl råkade vara en följdfråga utan länk.
          ...(thread.state?.startsWith('prospect:') ? {} : { state }),
        })
        .eq('id', thread.id)
    : await supabase.from('email_threads').insert({
        gmail_thread_id: gmailThreadId,
        last_message_id: messageId,
        transaction_ids: [],
        state,
      });

  if (error) console.error('[unknown-user] kunde inte spara tråden:', error.message);

  return {
    action: reply.includeLink ? 'unknown_user_prospect' : 'unknown_user_general',
    replyBody: reply.message,
  };
}
