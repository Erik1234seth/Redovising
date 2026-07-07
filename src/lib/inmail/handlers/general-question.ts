import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import { retrieveKnowledge } from '../retrieve';

export async function handleGeneralQuestion(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  subject: string;
  body: string;
  emailHistory?: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, subject, body, emailHistory } = params;
  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';

  // Hämta relevanta utdrag ur indexerade dokument (t.ex. K1-vägledningen)
  const knowledge = await retrieveKnowledge({
    supabase,
    query: `${subject}\n${body}`.trim(),
  });

  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}${knowledge}

Du är en hjälpsam bokföringsassistent för Enkla Bokslut. Svara på kundens fråga på ett tydligt och vänligt sätt.

Regler:
- Svara alltid på svenska
- Håll svaret kortfattat men fullständigt (max 200 ord)
- Om frågan rör specifik redovisning som kräver manuell granskning, be kunden boka ett möte
- Avsluta INTE med "// Enkla Bokslut" — det läggs till automatiskt`;

  const userContent = emailHistory
    ? `Mailkonversation:\n\n${emailHistory}`
    : `Ämne: ${subject || '(inget ämne)'}\n\nFråga:\n${body.slice(0, 1500)}`;

  const answer = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    maxTokens: 600,
  });

  return {
    action: 'ok',
    replyBody: `Hej${firstName}!\n\n${answer.trim()}\n\n// Enkla Bokslut`,
  };
}
