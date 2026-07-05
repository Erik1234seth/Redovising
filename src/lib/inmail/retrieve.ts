import { SupabaseClient } from '@supabase/supabase-js';

const EMBED_MODEL = 'text-embedding-3-small';

async function embedQuery(text: string): Promise<number[] | null> {
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
}): Promise<string> {
  const { supabase, query, matchCount = 5, threshold = 0.3 } = params;

  if (!query.trim()) return '';

  const embedding = await embedQuery(query);
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
