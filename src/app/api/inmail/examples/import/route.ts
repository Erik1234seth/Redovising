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

// Tar bort citerad historik, signaturer och annat brus så att embeddingen
// bygger på det kunden faktiskt skrev.
function cleanBody(raw: string): string {
  let text = raw.replace(/\r/g, '');

  // Klipp vid vanliga citat-markörer från Gmail och Outlook
  const cutMarkers = [
    /^\s*Den .+ skrev .+:\s*$/m,
    /^\s*On .+ wrote:\s*$/m,
    /^\s*-{2,}\s*Vidarebefordrat mejl\s*-{2,}\s*$/m,
    /^\s*_{5,}\s*$/m,
    /^\s*Från:\s.+$/m,
    /^\s*From:\s.+$/m,
  ];
  for (const marker of cutMarkers) {
    const m = text.match(marker);
    if (m?.index !== undefined) text = text.slice(0, m.index);
  }

  return text
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
