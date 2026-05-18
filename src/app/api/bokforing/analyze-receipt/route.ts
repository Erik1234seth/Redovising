import { NextResponse } from 'next/server';

async function pdfPageToBase64(buffer: Buffer): Promise<string> {
  const { createCanvas } = await import('@napi-rs/canvas');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Point worker to the bundled worker file — avoids spawning a separate thread
  const workerPath = require('path').resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = createCanvas(viewport.width, viewport.height);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: canvas.getContext('2d') as any, viewport }).promise;

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
  "betalningssatt": "Kontant" eller "Till företagskonto" eller "Till privatkonto" eller null
}`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const haendelse = formData.get('haendelse') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil bifogad' }, { status: 400 });
    }

    if (!haendelse || !['kund-betalat', 'kopt-nagot'].includes(haendelse)) {
      return NextResponse.json({ error: 'Ogiltig händelsetyp' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API-nyckel saknas' }, { status: 500 });
    }

    const userMessage =
      haendelse === 'kund-betalat'
        ? 'Analysera denna faktura/betalningsbekräftelse för en försäljning vi gjort.'
        : 'Analysera detta kvitto/faktura för ett inköp vi gjort.';

    const mimeType = file.type || 'image/jpeg';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build message content
    // PDF: try text extraction first (more accurate for digital invoices),
    // fall back to image render if the PDF is scanned/empty
    let userContent: unknown;

    if (mimeType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = ((await import('pdf-parse')) as any).default ?? (await import('pdf-parse'));
      const pdfData = await pdfParse(buffer);
      const text = pdfData.text?.trim() ?? '';

      if (text.length > 50) {
        // Digital PDF — send as text, AI reads it more accurately
        userContent = `${userMessage}\n\nInnehåll från PDF:\n${text}`;
      } else {
        // Scanned PDF — render first page to image
        const imageBase64 = await pdfPageToBase64(buffer);
        userContent = [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ];
      }
    } else {
      // Image — send as base64
      userContent = [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` } },
      ];
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.5',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        max_completion_tokens: 600,
      }),
    });

    if (!openAIResponse.ok) {
      const errText = await openAIResponse.text();
      console.error('OpenAI API error:', errText);
      return NextResponse.json({ error: 'Fel vid kontakt med AI-tjänsten' }, { status: 502 });
    }

    const openAIData = await openAIResponse.json();
    const rawContent = openAIData.choices?.[0]?.message?.content ?? '';

    let analysis: ReceiptAnalysis;
    try {
      analysis = JSON.parse(rawContent) as ReceiptAnalysis;
    } catch {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]) as ReceiptAnalysis;
      } else {
        console.error('Could not parse OpenAI response:', rawContent);
        return NextResponse.json({ error: 'Kunde inte tolka AI-svaret' }, { status: 500 });
      }
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error in /api/bokforing/analyze-receipt:', error);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
