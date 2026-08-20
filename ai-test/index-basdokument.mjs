/**
 * Indexerar dokumenten i storage-bucketen "Basdokument" till tabellen
 * ai_test_knowledge_chunks, så AI-testmiljön kan söka i dem.
 *
 * Kör med:  npm run index-basdokument
 * (som är:  node --env-file=.env.local ai-test/index-basdokument.mjs)
 *
 * Flaggor:
 *   --fil <text>   indexera bara filer vars namn innehåller <text>
 *   --lista        visa vad som finns i bucketen och vad som redan är indexerat
 *
 * Hanterar .pdf (text läses ut) och .xlsx/.xls/.csv (varje ark blir text).
 * Om-indexering är säker: raderna för en källa rensas innan de skrivs om.
 */
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const BUCKET = 'Basdokument';
const TABELL = 'ai_test_knowledge_chunks';
const EMBED_MODEL = 'text-embedding-3-small';
const CHUNK_CHARS = 3000; // ~750 tokens per chunk
const CHUNK_OVERLAP = 300;
const EMBED_BATCH = 96;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Saknar env: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL och/eller SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Tips: kör via "npm run index-basdokument" så laddas .env.local.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseArgs(argv) {
  const args = { fil: null, lista: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lista') args.lista = true;
    else if (argv[i] === '--fil') args.fil = argv[++i];
  }
  return args;
}

// ---------- textutvinning ----------

async function pdfTillText(buf) {
  const { PDFParse } = await import('pdf-parse');
  const p = new PDFParse({ data: new Uint8Array(buf) });
  const data = await p.getText();
  return data.text || '';
}

function kalkylTillText(buf) {
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
  // Varje ark för sig, med arknamnet som rubrik — annars tappar man kontexten
  return workbook.SheetNames.map((namn) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[namn]);
    return `## Ark: ${namn}\n${csv}`;
  }).join('\n\n');
}

/**
 * Filer som ligger kvar i bucketen men inte ska indexeras.
 *
 * K1_kontobeskrivningar: kalkylarket läses redan exakt av kontoregler.mjs,
 * uppslaget på kontonummer. Som RAG-material blir det istället CSV-rader kapade
 * mitt i en cell, och de konkurrerade ut PDF:erna i sökningen: alla sex
 * träffarna på en konteringsfråga kom därifrån, som obegripliga fragment.
 *
 * Ref-K1-Vagledningen: samma vägledning som K1-Vagledningen.pdf, fast upplagan
 * från 2013-12-05 i stället för 2025-03-24. De två låg med 0,57 i ordlikhet och
 * tog tillsammans 14 % av indexet, så varje sökning lade platser på att hämta
 * samma text två gånger — ibland i den gamla lydelsen. Behövs den gamla
 * upplagan igen är det bara att ta bort raden här och indexera om.
 */
const HOPPA_OVER = /^(K1_kontobeskrivningar|Ref-K1-Vagledningen)/i;

async function filTillText(namn, buf) {
  const ext = path.extname(namn).toLowerCase();
  if (ext === '.pdf') return pdfTillText(buf);
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return kalkylTillText(buf);
  if (['.txt', '.md'].includes(ext)) return buf.toString('utf-8');
  return null; // okänt format — hoppas över
}

/**
 * PDF-text kommer ut med en radbrytning vid varje *visuell* rad, inte vid
 * varje stycke. Utan efterbehandling blir varje chunk därför en samling
 * halva meningar, och tecken som bara fanns som glyfer i layouten följer med.
 *
 * Ordningen spelar roll: teckenstädningen först, radskräpet sedan, och först
 * därefter flödas raderna ihop till stycken.
 */
function städa(raw) {
  let text = raw
    // "a" + kombinerande ring blir ett riktigt "å"
    .normalize('NFC')
    .replace(/\r/g, '')
    .replace(/^-- \d+ of \d+ --$/gm, '') // sidmarkörer från pdf-parse
    // Skrivs som escape-sekvenser med flit: tecknen är osynliga i en editor,
    // och en redigering som råkar tappa dem gör regexen tyst fel.
    .replace(/�+/g, '') // punktledare i innehållsförteckningar
    .replace(//g, '•') // punktlista i Symbol-typsnitt
    .replace(/­/g, '') // mjukt bindestreck
    .replace(/\t/g, ' ');

  text = text
    .split('\n')
    .filter((rad) => {
      const t = rad.trim();
      if (/^\d{1,3}$/.test(t)) return false; // ensamt sidnummer
      if (/\.{4,}\s*\d+$/.test(t)) return false; // innehållsförteckning
      return true;
    })
    .join('\n');

  return flödaStycken(text)
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Rader som ska behålla sin egen radbrytning: listpunkter och numrerade rubriker. */
function ärEgenRad(rad) {
  return /^([•\-–*]\s|\d+(\.\d+)*\s+[A-ZÅÄÖ]|#{1,3}\s)/.test(rad);
}

/**
 * Sätter ihop de visuella raderna inom ett stycke till löpande text igen.
 * Tom rad = styckebrytning och lämnas orörd.
 */
function flödaStycken(text) {
  return text
    .split(/\n{2,}/)
    .map((stycke) => {
      let ut = '';
      for (const rad of stycke.split('\n')) {
        const t = rad.trim();
        if (!t) continue;
        if (!ut) {
          ut = t;
        } else if (ärEgenRad(t)) {
          ut += '\n' + t;
        } else if (/[a-zåäö]-$/.test(ut)) {
          ut = ut.slice(0, -1) + t; // avstavning: "inklu-\nsive" → "inklusive"
        } else {
          ut += ' ' + t;
        }
      }
      return ut;
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Delar ett stycke som är för långt vid meningsslut, inte mitt i ett ord. */
function delaLångtStycke(stycke) {
  if (stycke.length <= CHUNK_CHARS * 1.5) return [stycke];

  const meningar = stycke.split(/(?<=[.!?:])\s+/);
  const delar = [];
  let nu = '';
  for (const m of meningar) {
    if (nu && nu.length + m.length + 1 > CHUNK_CHARS) {
      delar.push(nu);
      nu = m;
    } else {
      nu += (nu ? ' ' : '') + m;
    }
  }
  if (nu) delar.push(nu);

  // En enda mening längre än gränsen (t.ex. en tabellrad) får kapas hårt
  return delar.flatMap((d) =>
    d.length <= CHUNK_CHARS * 1.5 ? [d] : (d.match(new RegExp(`[\\s\\S]{1,${CHUNK_CHARS}}`, 'g')) ?? [])
  );
}

/**
 * Bygger chunkar av hela stycken. Överlappet är också hela stycken — förut
 * klipptes de sista 300 tecknen rakt av, vilket är själva anledningen till att
 * de flesta chunkar började mitt i ett ord.
 */
function chunka(text) {
  const stycken = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(delaLångtStycke);

  const chunkar = [];
  let buffert = [];
  let längd = 0;

  for (const stycke of stycken) {
    if (buffert.length && längd + stycke.length + 2 > CHUNK_CHARS) {
      chunkar.push(buffert.join('\n\n'));

      // behåll de sista hela styckena som överlapp
      const kvar = [];
      let k = 0;
      for (let i = buffert.length - 1; i >= 0; i--) {
        if (k + buffert[i].length > CHUNK_OVERLAP) break;
        kvar.unshift(buffert[i]);
        k += buffert[i].length + 2;
      }
      buffert = kvar;
      längd = k;
    }
    buffert.push(stycke);
    längd += stycke.length + 2;
  }
  if (buffert.length) chunkar.push(buffert.join('\n\n'));

  return chunkar.filter((c) => c.trim().length > 0);
}

async function embedda(texter) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texter }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

// ---------- indexering ----------

async function indexera(namn) {
  console.log(`\n📄 ${namn}`);

  if (HOPPA_OVER.test(namn)) {
    console.log('   ⏭️  undantagen i HOPPA_OVER, indexeras inte');
    const { error } = await supabase.from(TABELL).delete().eq('source', namn);
    if (error) throw new Error(`rensning: ${error.message}`);
    return 0;
  }

  const { data: blob, error: nedFel } = await supabase.storage.from(BUCKET).download(namn);
  if (nedFel) throw new Error(`nedladdning: ${nedFel.message}`);

  const buf = Buffer.from(await blob.arrayBuffer());
  const raw = await filTillText(namn, buf);

  if (raw === null) {
    console.log('   ⏭️  okänt filformat, hoppas över');
    return 0;
  }

  const chunkar = chunka(städa(raw));
  if (chunkar.length === 0) {
    console.log('   ⚠️  ingen text kunde läsas ut (skannad PDF?)');
    return 0;
  }
  console.log(`   ${(buf.length / 1024).toFixed(0)} kB → ${chunkar.length} chunkar`);

  const { error: delFel } = await supabase.from(TABELL).delete().eq('source', namn);
  if (delFel) throw new Error(`rensning: ${delFel.message}`);

  let sparade = 0;
  for (let i = 0; i < chunkar.length; i += EMBED_BATCH) {
    const batch = chunkar.slice(i, i + EMBED_BATCH);
    const embeddings = await embedda(batch);
    const rader = batch.map((content, j) => ({
      source: namn,
      chunk_index: i + j,
      content,
      embedding: embeddings[j],
    }));
    const { error } = await supabase.from(TABELL).insert(rader);
    if (error) throw new Error(`insert: ${error.message}`);
    sparade += rader.length;
    process.stdout.write(`   ...${sparade}/${chunkar.length}\r`);
  }

  console.log(`   ✅ ${sparade} chunkar indexerade`);
  return sparade;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const { data: filer, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  if (error) throw new Error(`kunde inte lista bucketen ${BUCKET}: ${error.message}`);

  let namn = (filer ?? [])
    .map((f) => f.name)
    .filter((n) => !n.startsWith('.'))
    .sort();

  if (args.lista) {
    const { data: indexerade } = await supabase.from(TABELL).select('source');
    const antal = {};
    for (const r of indexerade ?? []) antal[r.source] = (antal[r.source] ?? 0) + 1;

    console.log(`Bucket "${BUCKET}" — ${namn.length} filer:\n`);
    for (const n of namn) {
      console.log(`  ${antal[n] ? `✅ ${String(antal[n]).padStart(4)} chunkar` : '   ej indexerad'}  ${n}`);
    }
    const föräldralösa = Object.keys(antal).filter((s) => !namn.includes(s));
    if (föräldralösa.length) {
      console.log(`\nIndexerade men borta ur bucketen: ${föräldralösa.join(', ')}`);
    }
    return;
  }

  if (args.fil) {
    namn = namn.filter((n) => n.toLowerCase().includes(args.fil.toLowerCase()));
  }

  if (namn.length === 0) {
    console.log('Inga filer att indexera.');
    return;
  }

  console.log(`Indexerar ${namn.length} dokument från "${BUCKET}"...`);

  let totalt = 0;
  let fel = 0;
  for (const n of namn) {
    try {
      totalt += await indexera(n);
    } catch (err) {
      console.log(`   ❌ ${err.message}`);
      fel++;
    }
  }

  console.log(`\nKlart. ${totalt} chunkar totalt${fel ? `, ${fel} filer misslyckades` : ''}.`);
  console.log('AI-testmiljön söker nu i dessa dokument.');
}


main().catch((err) => {
  console.error('\n❌ Indexeringen misslyckades:', err.message);
  process.exit(1);
});
