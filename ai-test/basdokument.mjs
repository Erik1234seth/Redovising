/**
 * Sökning i basdokumenten — K1-vägledningen, kontoplanen, Skatteverkets
 * broschyrer m.m. som ligger i storage-bucketen "Basdokument" och indexerats
 * med `npm run index-basdokument`.
 *
 * Samma upplägg som mail-AI:ns retrieveKnowledge, fast mot en egen tabell så
 * att de två indexen inte blandas ihop.
 *
 * Delas av webbsidan (/ai-test) och CLI:t (npm run ai-test) via analyze.mjs.
 */
import { createClient } from '@supabase/supabase-js';

const EMBED_MODEL = 'text-embedding-3-small';

function supabaseKlient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function embedQuery(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.data?.[0]?.embedding ?? null;
}

/**
 * Sökfråga för en hel transaktionsfil (enpassläget).
 *
 * Tvåpasset söker per rad med byggRadfraga nedan — det ger klart bättre
 * träffar. Den här används bara när alla rader analyseras i ett svep, och då
 * finns ingen enskild rad att fråga om.
 */
export function byggSokfraga({ filnamn, text }) {
  if (text && text.trim().length > 20) return `Kontera transaktioner: ${text.slice(0, 2000)}`;
  return `Bokföra affärshändelser i enskild firma: kontoval och moms. Underlag: ${filnamn}`;
}

/**
 * Sökfråga för EN konteringsrad.
 *
 * Medvetet bara radens egen text och siffror — ingen inramande fråga. Raden är
 * redan uttolkad av kvittosteget ("Hyra av minigrävare 3 dygn — Svensk
 * Maskinuthyrning AB"), alltså just den destillerade beskrivning som en
 * inramning skulle ha försökt skapa. Lägger man till en fråga ovanpå får alla
 * rader samma inledning, och embeddingen dras mot den gemensamma texten i
 * stället för mot det som skiljer raderna åt.
 *
 * Mätt på sex rader, andel som fick utdrag inom sitt eget ämne:
 *   rå radtext                    6/6
 *   radtext + kort fråga          5/6
 *   fråga först, radtext sedan    4/6
 */
export function byggRadfraga(rad) {
  const moms = Number(rad.moms) ? `moms ${Math.abs(Number(rad.moms))} kr` : 'ingen moms angiven';
  return `${rad.text} ${Math.abs(Number(rad.belopp) || 0)} kr ${moms}`;
}

/** Formaterar träffarna som ett block att lägga till i systemprompten. */
export function byggBasdokumentBlock(traffar) {
  if (traffar.length === 0) return '';

  const utdrag = traffar.map((t, i) => `[${i + 1}] Ur "${t.source}":\n${t.content}`).join('\n\n');

  return `UTDRAG UR REGELVERKET (K1-vägledningen, kontoplanen och Skatteverkets material):
${utdrag}

Utdragen ovan är automatiskt framsökta och kan vara ofullständiga. Använd dem när de är relevanta för kontovalet eller momsbedömningen. Om de motsäger instruktionerna ovan gäller instruktionerna. Hitta aldrig på regler som inte står i dem.`;
}

/**
 * Söker fram relevanta utdrag.
 *
 * Returnerar tom lista vid fel — en analys ska aldrig falla bara för att
 * sökningen inte gick igenom.
 */
export async function sokBasdokument({ fraga, antal = 6, troskel = 0.25, apiKey }) {
  if (!fraga?.trim()) return [];

  const supabase = supabaseKlient();
  if (!supabase) {
    console.error('[ai-test] basdokument: saknar SUPABASE_SERVICE_ROLE_KEY, hoppar över sökningen');
    return [];
  }

  try {
    const embedding = await embedQuery(fraga, apiKey);
    if (!embedding) return [];

    const { data, error } = await supabase.rpc('match_ai_test_knowledge', {
      query_embedding: embedding,
      match_count: antal,
      similarity_threshold: troskel,
    });

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (err) {
    console.error('[ai-test] basdokumentsökning misslyckades:', err.message);
    return [];
  }
}

/** Antal indexerade chunkar per källa — används för statusen i gränssnittet. */
export async function basdokumentStatus() {
  const supabase = supabaseKlient();
  if (!supabase) return { totalt: 0, kallor: [] };

  const { data, error } = await supabase.from('ai_test_knowledge_chunks').select('source');
  if (error) {
    console.error('[ai-test] kunde inte läsa basdokumentstatus:', error.message);
    return { totalt: 0, kallor: [] };
  }

  const antal = {};
  for (const rad of data ?? []) antal[rad.source] = (antal[rad.source] ?? 0) + 1;

  return {
    totalt: data?.length ?? 0,
    kallor: Object.entries(antal)
      .map(([source, chunkar]) => ({ source, chunkar }))
      .sort((a, b) => a.source.localeCompare(b.source, 'sv')),
  };
}
