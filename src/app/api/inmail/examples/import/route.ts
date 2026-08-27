import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Tar emot tidigare fråga/svar-par från Gmail (Apps Script: exportSentEmails)
// och sparar dem i mailbanken. Frågan embeddas — inte svaret — eftersom det är
// en fråga som kommer in när AI:n sedan söker efter liknande ärenden.

const EMBED_MODEL = 'text-embedding-3-small';

interface IncomingExample {
  messageId: string;
  gmailThreadId?: string;
  subject?: string;
  question: string;
  answer: string;
  sentAt?: string;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Markörer som klipps vid direkt, så fort raden dyker upp.
//
// Mobilsignaturerna och `--` står med av samma skäl som citathuvudena: allt
// efter dem är brus, och just "Skickat från min iPhone" hamnade förut mitt i
// embeddingen och gjorde att två helt orelaterade mejl liknade varandra till
// 86 procent — de hade boilerplaten gemensam, inte innehållet.
const LINE_MARKERS = [
  /^[ \t]*-{2,}[ \t]*Vidarebefordrat mejl[ \t]*-{2,}[ \t]*$/m,
  /^[ \t]*-{2,}[ \t]*Forwarded message[ \t]*-{2,}/m,
  /^[ \t]*_{5,}[ \t]*$/m,
  /^[ \t]*Från:[ \t].+$/m,
  /^[ \t]*From:[ \t].+$/m,
  /^--[ \t]*$/m, // standardavgränsaren före en signatur
  /^[ \t]*Skickat från min /mi,
  /^[ \t]*Sent from my /mi,
  /^[ \t]*(?:Skickat|Hämta|Skaffa) (?:från|för) Outlook /mi,
  /^[ \t]*Get Outlook for /mi,
  /^[ \t]*Detta mejl kan innehålla konfidentiell/mi,

  // Citathuvud från Gmail på ungerska. En av kunderna har sin Gmail inställd
  // så, och då hjälper varken det svenska eller det engelska mönstret. Raden
  // inleds med avsändarens namn i stället för ett datum, så här matchas hela
  // raden fram till frasen och klippet hamnar ändå vid radens början.
  /^[^\n]*\bezt írta \(időpont:/mi,

  // Avslutningsfraser. Allt efter dem är signatur, inte innehåll. Gäller både
  // kundens mejl (id=3 och id=4 slutade med avsändarens egen signatur) och
  // våra egna svar, där signaturen annars motsäger reply-rules.ts som
  // uttryckligen förbjuder modellen att skriva någon.
  /^[ \t]*Med[ \t]+vänlig(?:a|t)?[ \t]+hälsning(?:ar)?\b/mi,
  /^[ \t]*(?:Vänliga|Bästa|Varma)[ \t]+hälsningar\b/mi,
  /^[ \t]*Hälsningar\b/mi,
  /^[ \t]*Hälsar\b/mi,
  /^[ \t]*Mvh\b/mi,
  /^[ \t]*M\.[ \t]*v\.[ \t]*h\.?/mi,
  /^[ \t]*(?:Best|Kind)[ \t]+regards\b/mi,
  /^[ \t]*Sincerely\b/mi,

  // "Vänligen" bara när den står ensam på raden. Som inledning är den nästan
  // alltid en uppmaning ("Vänligen återkom med...") och inte en avslutning,
  // och då hade ett klipp tagit bort resten av mejlet.
  /^[ \t]*Vänligen[ \t]*[,!.]?[ \t]*$/mi,
];

// Citathuvuden ("Den mån 22 aug. 2026 kl. 11:31 skrev Erik <...>:").
//
// De gamla mönstren krävde att raden SLUTADE på "skrev ...:" respektive
// "wrote:". Det höll inte: Gmail radbryter vid 78 tecken, så huvudet delas ofta
// mitt itu och "wrote:" hamnar på egen rad. Då matchade ingenting, och hela den
// citerade historiken följde med in i embeddingen.
//
// Nu matchas bara BÖRJAN av huvudet — datumet — och nyckelordet ("skrev"/
// "wrote") krävs inom ett kort fönster efteråt. Radbrytning spelar därmed ingen
// roll, samtidigt som en rad som råkar inledas med ett datum inte klipper bort
// halva mejlet på egen hand.
//
// Täcker de varianter som faktiskt förekommer i vår Skickat-mapp:
//   Den lör 22 aug. 2026 04:38Erik på Enkla Bokslut <...> skrev:
//   lör 22 aug. 2026 kl. 11:31 skrev Erik på EnklaBokslut <...>
//   26 aug. 2026 kl. 10:03 skrev Erik på Enkla Bokslut <...>:   (iPhone)
//   On Sat, Aug 22, 2026 at 5:58 AM Thomas Hahn <...> wrote:
const QUOTE_STARTS: Array<[RegExp, RegExp]> = [
  [/^[ \t]*(?:Den[ \t]+)?(?:mån|tis|ons|tors|fre|lör|sön)[a-zåäö]*\.?[ \t]+\d{1,2}[ \t]/gim, /\bskrev\b/i],
  [/^[ \t]*(?:Den[ \t]+)?\d{1,2}[ \t]+[a-zåäö]{3,}\.?[ \t]+\d{4}[ \t]/gim, /\bskrev\b/i],
  [/^[ \t]*On[ \t]+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?[ \t]/gim, /\bwrote\b/i],
];

const QUOTE_WINDOW = 300;

// Var slutar det avsändaren själv skrev? Returnerar index för den tidigaste
// markören, eller textens längd om ingen hittas.
function findCutIndex(text: string): number {
  let cut = text.length;

  for (const marker of LINE_MARKERS) {
    const m = text.match(marker);
    if (m?.index !== undefined && m.index < cut) cut = m.index;
  }

  for (const [start, keyword] of QUOTE_STARTS) {
    start.lastIndex = 0; // modulnivå-regex behåller lastIndex mellan anrop
    let m: RegExpExecArray | null;
    while ((m = start.exec(text)) !== null) {
      if (m.index >= cut) break;
      if (keyword.test(text.slice(m.index, m.index + QUOTE_WINDOW))) {
        cut = m.index;
        break;
      }
    }
  }

  return cut;
}

// Tar bort citerad historik, signaturer och annat brus så att embeddingen
// bygger på det kunden faktiskt skrev.
function cleanBody(raw: string): string {
  const text = raw.replace(/\r/g, '');

  return text
    .slice(0, findCutIndex(text))
    .split('\n')
    .filter((line) => !/^\s*>/.test(line)) // citerade rader
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts.map((t) => t.slice(0, 8000)),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-inmail-secret');
    if (secret !== process.env.INMAIL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { examples } = (await request.json()) as { examples?: IncomingExample[] };
    if (!Array.isArray(examples) || examples.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0 });
    }

    // Rensa och filtrera bort tomma eller alltför korta par ("tack!", "ok")
    const cleaned = examples
      .map((e) => ({
        message_id: e.messageId,
        gmail_thread_id: e.gmailThreadId ?? null,
        subject: e.subject ?? null,
        question: cleanBody(e.question ?? ''),
        answer: cleanBody(e.answer ?? ''),
        sent_at: e.sentAt ?? null,
      }))
      .filter((e) => e.message_id && e.question.length >= 20 && e.answer.length >= 40);

    const skipped = examples.length - cleaned.length;
    if (cleaned.length === 0) {
      return NextResponse.json({ imported: 0, skipped });
    }

    const embeddings = await embedBatch(cleaned.map((e) => e.question));
    const rows = cleaned.map((e, i) => ({ ...e, embedding: embeddings[i] }));

    const supabase = getSupabase();
    const { error } = await supabase
      .from('inmail_email_examples')
      .upsert(rows, { onConflict: 'message_id' });

    if (error) {
      console.error('[inmail/examples] upsert misslyckades:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[inmail/examples] importerade ${rows.length}, hoppade över ${skipped}`);
    return NextResponse.json({ imported: rows.length, skipped });
  } catch (err) {
    console.error('Error in /api/inmail/examples/import:', err);
    return NextResponse.json({ error: 'Internt fel' }, { status: 500 });
  }
}
