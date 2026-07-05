/**
 * Indexerar stora PDF-dokument i src/lib/inmail/knowledge/ till Supabase
 * (pgvector) så mail-AI:n kan söka i dem istället för att skicka med allt.
 *
 * Kör med:  npm run index-knowledge
 * (som är:  node --env-file=.env.local scripts/index-knowledge.mjs)
 *
 * Små .md/.txt-filer indexeras INTE här — de skickas alltid med i sin helhet
 * via loadKnowledge(). Endast .pdf-filer söks.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'src/lib/inmail/knowledge');
const EMBED_MODEL = 'text-embedding-3-small';
const CHUNK_CHARS = 3000;   // ~750 tokens per chunk
const CHUNK_OVERLAP = 300;  // överlapp så meningar inte kapas mitt itu

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Saknar env: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL och/eller SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Tips: kör via "npm run index-knowledge" så laddas .env.local.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function extractPdfText(buf) {
  const { PDFParse } = await import('pdf-parse');
  const p = new PDFParse({ data: new Uint8Array(buf) });
  const data = await p.getText();
  return data.text || '';
}

function cleanText(raw) {
  return raw
    .replace(/^-- \d+ of \d+ --$/gm, '')      // sidmarkörer från extraktorn
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(text) {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_CHARS && current) {
      chunks.push(current.trim());
      // starta nästa chunk med lite överlapp för kontext
      current = current.slice(-CHUNK_OVERLAP) + '\n\n' + para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function embedBatch(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

async function indexPdf(file) {
  const source = file;
  console.log(`\n📄 ${source}`);
  const buf = fs.readFileSync(path.join(KNOWLEDGE_DIR, file));
  const raw = await extractPdfText(buf);
  const chunks = chunkText(cleanText(raw));
  console.log(`   ${chunks.length} chunkar`);

  // Rensa gamla rader för denna källa (så om-indexering blir ren)
  const { error: delErr } = await supabase
    .from('inmail_knowledge_chunks')
    .delete()
    .eq('source', source);
  if (delErr) throw new Error(`delete: ${delErr.message}`);

  // Embedda + infoga i batchar
  const BATCH = 96;
  let inserted = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embeddings = await embedBatch(batch);
    const rows = batch.map((content, j) => ({
      source,
      chunk_index: i + j,
      content,
      embedding: embeddings[j],
    }));
    const { error } = await supabase.from('inmail_knowledge_chunks').insert(rows);
    if (error) throw new Error(`insert: ${error.message}`);
    inserted += rows.length;
    process.stdout.write(`   ...${inserted}/${chunks.length}\r`);
  }
  console.log(`   ✅ ${inserted} chunkar indexerade`);
}

async function main() {
  const pdfs = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'));

  if (pdfs.length === 0) {
    console.log('Inga .pdf-filer i knowledge-mappen. Inget att indexera.');
    return;
  }

  console.log(`Indexerar ${pdfs.length} PDF-dokument...`);
  for (const pdf of pdfs) {
    await indexPdf(pdf);
  }
  console.log('\nKlart. Mail-AI:n söker nu i dessa dokument.');
}

main().catch((err) => {
  console.error('\n❌ Indexering misslyckades:', err.message);
  process.exit(1);
});
