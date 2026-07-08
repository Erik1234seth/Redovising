import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../openai-client';

interface OnboardingExtraction {
  collectedName: string | null;
  collectedOrgNumber: string | null;
  collectedPackage: 'monthly' | 'yearly' | null;
  nextQuestion: string;
  allCollected: boolean;
}

export async function handleOnboarding(params: {
  supabase: SupabaseClient;
  senderEmail: string;
  emailHistory: string;
  gmailThreadId: string;
  messageId: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, senderEmail, emailHistory, gmailThreadId, messageId } = params;

  const systemPrompt = `Du jobbar på Enkla Bokslut och hjälper en ny kund komma igång via mejl.

Du behöver samla in tre saker för att kunna ta hand om deras bokföring:
1. Fullständigt namn — behövs för att upprätta NE-bilagan i deras namn
2. Organisationsnummer — behövs för kontakten med Skatteverket
3. Betalning — månadsvis (299 kr/mån, betalas löpande) eller årsvis (3 999 kr/år, faktureras först när vi lämnat in årsbokslutet)

Läs igenom mejl-historiken och ta reda på vad som redan samlats in.

Skriv nextQuestion som om du är en riktig person på företaget — enkelt och naturligt. Förklara kort varför vi behöver infon (koppla det till bokföringen eller Skatteverket, aldrig till "att skapa konto"). En fråga i taget. Avsluta alltid med "// Enkla Bokslut".

Returnera JSON:
{
  "collectedName": string | null,
  "collectedOrgNumber": string | null,
  "collectedPackage": "monthly" | "yearly" | null,
  "nextQuestion": "Fråga på naturlig svenska",
  "allCollected": boolean
}`;

  const raw = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Mejl-historik:\n\n${emailHistory}` },
    ],
    responseFormat: { type: 'json_object' },
    maxTokens: 400,
  });

  const state = parseJSON<OnboardingExtraction>(raw);

  if (!state.allCollected) {
    return {
      action: 'onboarding_question',
      replyBody: state.nextQuestion,
    };
  }

  // Skapa Supabase-kontot
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: senderEmail,
    email_confirm: true,
    user_metadata: {
      full_name: state.collectedName,
      org_number: state.collectedOrgNumber,
      package: state.collectedPackage,
    },
  });

  if (userError || !userData.user) {
    console.error('[onboarding] createUser error:', userError);
    const firstName = state.collectedName?.split(' ')[0] ?? '';
    return {
      action: 'onboarding_error',
      replyBody: `Hej${firstName ? ` ${firstName}` : ''}!\n\nNågot krånglade lite från vår sida — men oroa dig inte. Vi ser till att du kommer igång och hör av oss inom kort.\n\n// Enkla Bokslut`,
    };
  }

  // Skapa profil
  await supabase.from('profiles').upsert({
    id: userData.user.id,
    email: senderEmail,
    full_name: state.collectedName,
  });

  // Koppla tråden till det nya kontot
  await supabase
    .from('email_threads')
    .update({ user_id: userData.user.id, state: 'active', last_message_id: messageId })
    .eq('gmail_thread_id', gmailThreadId);

  const firstName = state.collectedName?.split(' ')[0] ?? '';
  const packageText = state.collectedPackage === 'yearly'
    ? 'årsvis (3 999 kr/år)'
    : 'månadsvis (299 kr/mån)';

  return {
    action: 'onboarding_complete',
    replyBody: `${firstName ? `Tack ${firstName}! ` : 'Tack! '}Nu är allt klart från vår sida.\n\nVi har registrerat dig ${packageText} och kopplat allt till ${senderEmail}. Du kan direkt börja skicka in kvitton och fakturor hit — vi tar hand om bokföringen.\n\nHar du frågor är det bara att svara på det här mejlet.\n\n// Enkla Bokslut`,
  };
}
