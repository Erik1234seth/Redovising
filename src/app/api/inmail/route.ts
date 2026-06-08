import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function loadPdfjs(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs'); // eslint-disable-line @typescript-eslint/no-explicit-any
  const workerPath = require('path').resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  return pdfjsLib;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => (item as any).str ?? '').join(' ') + '\n'; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return text.trim();
}

async function pdfPageToBase64(buffer: Buffer): Promise<string> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjsLib = await loadPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d') as any, viewport }).promise; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (canvas.toBuffer('image/png') as Buffer).toString('base64');
}

interface ReceiptAnalysis {
  vad: string;
  datum: string | null;
  belopp: number;
  moms: number;
  land: string;
  avsandare: string;
  betalningssatt: string | null;
}

const SYSTEM_PROMPT = `Du är expert på svensk bokföring och kvittoanalys. Analysera kvittot/fakturan och returnera JSON med exakt dessa fält:
{
  "vad": "kort beskrivning av vad som köptes/såldes",
  "datum": "YYYY-MM-DD eller null",
  "belopp": number (totalt inkl moms),
  "moms": number (momsbelopp, 0 om ej synligt),
  "land": "Sverige" eller "EU" eller "Utanför EU",
  "avsandare": "namn på utfärdaren",
  "betalningssatt": "Kontant" eller "Från företagskonto" eller "Från privatkonto" eller null
}`;

async function analyzeReceipt(fileBase64: string, mimeType: string): Promise<ReceiptAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const buffer = Buffer.from(fileBase64, 'base64');

  let userContent: unknown;
  if (mimeType === 'application/pdf') {
    const text = await extractPdfText(buffer);
    if (text.length > 50) {
      userContent = `Analysera detta kvitto/faktura för ett inköp.\n\nInnehåll från PDF:\n${text}`;
    } else {
      const imageBase64 = await pdfPageToBase64(buffer);
      userContent = [
        { type: 'text', text: 'Analysera detta kvitto/faktura för ett inköp.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ];
    }
  } else {
    userContent = [
      { type: 'text', text: 'Analysera detta kvitto/faktura för ett inköp.' },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
    ];
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_completion_tokens: 4000,
    }),
  });

  if (!res.ok) throw new Error('OpenAI-fel');
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(raw) as ReceiptAnalysis;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as ReceiptAnalysis;
    throw new Error('Kunde inte tolka AI-svaret');
  }
}

function formatAmount(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

export async function POST(request: Request) {
  try {
    // Verify secret
    const secret = request.headers.get('x-inmail-secret');
    if (secret !== process.env.INMAIL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      senderEmail: string;
      gmailThreadId: string;
      messageId: string;
      attachments: Array<{ base64: string; mimeType: string; name: string }>;
    };

    const { senderEmail, gmailThreadId, messageId, attachments } = body;

    if (!senderEmail || !gmailThreadId || !messageId || !attachments?.length) {
      return NextResponse.json({ error: 'Saknar fält' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Look up user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', senderEmail)
      .single();

    if (!profile) {
      return NextResponse.json({ action: 'no_user', email: senderEmail });
    }

    // Analyze each attachment
    const results: Array<{ analysis: ReceiptAnalysis; transactionId: string }> = [];

    for (const att of attachments) {
      let analysis: ReceiptAnalysis;
      try {
        analysis = await analyzeReceipt(att.base64, att.mimeType);
      } catch {
        continue;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: tx, error: txError } = await supabase
        .from('bokforing_transaktioner')
        .insert({
          user_id: profile.id,
          haendelse_typ: 'kopt-nagot',
          datum: analysis.datum ?? today,
          beskrivning: analysis.vad,
          belopp: Math.abs(analysis.belopp),
          moms: analysis.moms,
          kund_land: analysis.land,
          betalningssatt: analysis.betalningssatt ?? 'Från företagskonto',
          ovrigt: analysis.avsandare ? `Utfärdare: ${analysis.avsandare}` : null,
          ai_kategori: analysis.vad,
        })
        .select('id')
        .single();

      if (txError || !tx) continue;
      results.push({ analysis, transactionId: tx.id });
    }

    if (!results.length) {
      return NextResponse.json({ action: 'no_results' });
    }

    // Save email thread
    await supabase.from('email_threads').insert({
      user_id: profile.id,
      gmail_thread_id: gmailThreadId,
      last_message_id: messageId,
      transaction_ids: results.map(r => r.transactionId),
    });

    // Build reply summary for Apps Script to send
    const lines = results.map((r, i) => {
      const a = r.analysis;
      const betalning = a.betalningssatt ?? 'okänt';
      return `${i + 1}. ${a.avsandare || 'Okänd'} — ${formatAmount(a.belopp)} — ${a.vad}\n   Betalat från: ${betalning} · Datum: ${a.datum ?? 'okänt'} · Moms: ${formatAmount(a.moms)}`;
    });

    const replyBody = `Hej${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}!\n\nVi har tagit emot ditt${results.length > 1 ? ` ${results.length} kvitton` : ' kvitto'} och tolkat det så här:\n\n${lines.join('\n\n')}\n\nStämmer det? Svara på det här mailet om något behöver ändras, så fixar vi det.\n\n// Enkla Bokslut`;

    return NextResponse.json({ action: 'ok', replyBody });
  } catch (err) {
    console.error('Error in /api/inmail:', err);
    return NextResponse.json({ error: 'Internt fel' }, { status: 500 });
  }
}
