import { SupabaseClient } from '@supabase/supabase-js';

const EMBED_MODEL = 'text-embedding-3-small';

export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error('[inmail] embedQuery misslyckades:', err);
    return null;
  }
}

interface KnowledgeMatch {
  source: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

/**
 * Hämtar de mest relevanta utdragen ur indexerade dokument (t.ex. K1-vägledningen)
 * för en given fråga. Bara själva utdragen, utan rubrik och instruktioner:
 * prompten säger själv hur de ska användas (Del 3 i masterprompten).
 *
 * Returnerar tom sträng om inget relevant hittas eller vid fel — mailflödet ska
 * aldrig krascha på grund av sökningen.
 */
export async function retrieveKnowledge(params: {
  supabase: SupabaseClient;
  query: string;
  matchCount?: number;
  threshold?: number;
  /** Färdig embedding av query, så anropare som gör flera sökningar på samma
   *  fråga slipper betala för att embedda den en gång per sökning. */
  queryEmbedding?: number[] | null;
}): Promise<string> {
  const { supabase, query, matchCount = 5, threshold = 0.3 } = params;

  if (!query.trim()) return '';

  const embedding = params.queryEmbedding ?? (await embedQuery(query));
  if (!embedding) return '';

  const { data, error } = await supabase.rpc('match_inmail_knowledge', {
    query_embedding: embedding,
    match_count: matchCount,
    similarity_threshold: threshold,
  });

  if (error) {
    console.error('[inmail] match_inmail_knowledge fel:', error.message);
    return '';
  }

  const matches = (data ?? []) as KnowledgeMatch[];
  if (matches.length === 0) return '';

  return matches
    .map((m, i) => `[Utdrag ${i + 1} — ${m.source}]\n${m.content}`)
    .join('\n\n');
}

interface ExampleMatch {
  subject: string | null;
  question: string;
  answer: string;
  sent_at: string | null;
  similarity: number;
}

/**
 * Hämtar tidigare mailkonversationer där Erik svarat på en liknande fråga, som
 * stilförebild för det nya svaret. Söker på FRÅGAN (så embeddas de vid import),
 * eftersom det är en fråga som kommer in.
 *
 * Exemplen är stilförebilder, inte facit: gamla svar kan innehålla priser och
 * rutiner som ändrats, och uppgifter som hör till en annan kund. Det står
 * uttryckligen i prompten (Del 4 i masterprompten).
 *
 * Returnerar tom sträng om inget hittas eller vid fel — mailflödet ska aldrig
 * krascha på grund av mailbanken.
 */
export async function retrieveExamples(params: {
  supabase: SupabaseClient;
  query: string;
  matchCount?: number;
  threshold?: number;
  /** Se retrieveKnowledge — samma embedding kan återanvändas här. */
  queryEmbedding?: number[] | null;
}): Promise<string> {
  // Tröskeln var 0.35, vilket i praktiken inte filtrerade något: mätt över
  // mailbanken klarade 93 procent av alla par den gränsen. Medianlikheten
  // mellan två slumpmässiga mejl ligger på 0.52, så allt därunder är brus och
  // ett svar om moms kunde dras in som "liknande" på en fråga om priset.
  //
  // 0.60 släpper igenom 18 procent av paren och ligger tydligt över brusgolvet.
  // Kalibrerat mot kända par: 0.738 (betalning mot betalning) och 0.655
  // (faktura mot kreditfaktura) ska med, 0.595 ska bort.
  //
  // Hellre inga exempel än fel exempel. Blocket är en stilförebild, och
  // returneras tom sträng skriver modellen utifrån prompten som förut.
  const { supabase, query, matchCount = 3, threshold = 0.6 } = params;

  if (!query.trim()) return '';

  const embedding = params.queryEmbedding ?? (await embedQuery(query));
  if (!embedding) return '';

  const { data, error } = await supabase.rpc('match_inmail_examples', {
    query_embedding: embedding,
    match_count: matchCount,
    similarity_threshold: threshold,
  });

  if (error) {
    console.error('[inmail] match_inmail_examples fel:', error.message);
    return '';
  }

  const matches = (data ?? []) as ExampleMatch[];
  if (matches.length === 0) return '';

  return matches
    .map((m, i) => {
      const datum = m.sent_at ? m.sent_at.slice(0, 10) : 'okänt datum';
      return `[Exempel ${i + 1} — ${datum}]
Kunden skrev:
${m.question.slice(0, 1200)}

Så här svarade Erik:
${m.answer.slice(0, 2000)}`;
    })
    .join('\n\n');
}
