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
 * för en given fråga och formaterar dem som ett kontextblock att bifoga prompten.
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

  const excerpts = matches
    .map((m, i) => `[Utdrag ${i + 1} — ${m.source}]\n${m.content}`)
    .join('\n\n');

  return `\n\nRELEVANTA UTDRAG UR REGELVERKET (hämtade ur interna dokument, t.ex. K1/BFN):
Använd utdragen nedan om de är relevanta för frågan. Är de inte relevanta — ignorera dem och svara utifrån din allmänna kunskap. Hitta aldrig på regler.

${excerpts}`;
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
 * uttryckligen i blocket nedan.
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
  const { supabase, query, matchCount = 3, threshold = 0.35 } = params;

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

  const examples = matches
    .map((m, i) => {
      const datum = m.sent_at ? m.sent_at.slice(0, 10) : 'okänt datum';
      return `[Exempel ${i + 1} — ${datum}]
Kunden skrev:
${m.question.slice(0, 1200)}

Så här svarade Erik:
${m.answer.slice(0, 2000)}`;
    })
    .join('\n\n');

  return `\n\nTIDIGARE SVAR PÅ LIKNANDE FRÅGOR (Eriks egna mail till andra kunder):
Exemplen nedan finns här av ett enda skäl: så att du ska låta som Erik. Härma
tonfall, meningsbyggnad, hur långt han skriver och hur han lägger upp ett svar.

Men läs dem som stilprov, aldrig som facit:
- Kopiera ALDRIG konkreta uppgifter ur ett exempel. Namn, belopp, datum, org.nr,
  personnummer och företagsnamn där tillhör en ANNAN kund och får inte förekomma
  i ditt svar. Kundens egna uppgifter finns under OM AVSÄNDAREN.
- Nämn aldrig att tidigare mail eller andra kunder finns.
- Priser, rutiner och regler kan ha ändrats sedan dess. Sakuppgifter tar du från
  kontexten om tjänsten och regelverket, inte härifrån.
- Handlar exemplen egentligen om något annat än det kunden frågar om, strunta i
  dem och svara ändå i samma ton.

${examples}`;
}
