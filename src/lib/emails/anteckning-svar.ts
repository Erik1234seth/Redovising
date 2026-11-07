import type { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '../inmail/openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../inmail/service-context';
import { REPLY_RULES } from '../inmail/reply-rules';
import { anteckningarForPrompt } from '../inkorg/anteckningar';
import { WELCOME_PARAGRAPHS } from './lead-welcome';

/**
 * AI:ns svar på det besökaren skrev i anteckningsfältet i popupen eller
 * kontaktformuläret. Svaret läggs in i välkomstmejlet, som går ut direkt utan
 * att någon läser det först.
 *
 * Mallen skickas med i prompten så att svaret inte upprepar det mejlet redan
 * säger, t.ex. priset.
 */

const ANTECKNING_MAX_TECKEN = 4000;

export interface AnteckningSvar {
  /** Svaret, ren text. Tom när anteckningen inte innehåller något att svara på. */
  svar: string;
  /** False när verksamheten uppenbart inte passar tjänsten. Då skickas bara svaret. */
  passar: boolean;
}

/** Null om AI-anropet inte gick. Då går standardmejlet ut i stället. */
export async function svaraPaAnteckning(params: {
  supabase: SupabaseClient;
  email: string;
  anteckning: string;
}): Promise<AnteckningSvar | null> {
  const mall = WELCOME_PARAGRAPHS.slice(2).join('\n\n');

  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}

Du jobbar på Enkla Bokslut. En person har fyllt i formuläret på vår hemsida och skrivit något i fältet för anteckningar. Personen får automatiskt ett mejl som går ut direkt, utan att någon läser det först. Mejlet innehåller redan den här texten:

"""
${mall}
"""

Din uppgift är att skriva ett kort stycke som svarar på det personen skrev. Stycket läggs in i mejlet efter inledningen ("Hej <namn>, Tack för dina svar!") och före texten ovan.

- Svara bara på frågor eller önskemål i anteckningen som texten ovan inte redan besvarar. Upprepa inte det som redan står där.
- Finns det ingen fråga eller inget önskemål att svara på (bara en kort beskrivning av verksamheten, ett test, nonsens eller tomt) sätter du svar till en tom sträng.
- Hälsa inte och tacka inte för formuläret, det gör inledningen redan.
- Skriv på samma språk som personen skrev på.
- Lova aldrig något du inte vet att vi gör, och hitta inte på priser, tider eller villkor.
- Sätt passar till false bara när det tydligt framgår att verksamheten inte passar tjänsten, till exempel ett aktiebolag eller en förening. Då skickas bara ditt stycke, utan texten ovan, så det ska då stå på egna ben och förklara vänligt vad vi gör och inte gör. Annars är passar true.

${REPLY_RULES}

Returnera JSON:
{
  "svar": "...",
  "passar": boolean
}${await anteckningarForPrompt(params.supabase, { email: params.email })}`;

  try {
    const raw = await callOpenAI({
      anrop: { steg: 'svar-pa-anteckning' },
      model: 'gpt-6.1-sol',
      effort: 'low',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Anteckning:\n${params.anteckning.slice(0, ANTECKNING_MAX_TECKEN)}` },
      ],
      responseFormat: { type: 'json_object' },
      maxTokens: 8000,
    });
    const svar = parseJSON<Partial<AnteckningSvar>>(raw);
    return {
      svar: typeof svar.svar === 'string' ? svar.svar.trim() : '',
      passar: svar.passar !== false,
    };
  } catch (err) {
    console.error('[anteckning-svar] AI-anropet misslyckades:', err instanceof Error ? err.message : err);
    return null;
  }
}
