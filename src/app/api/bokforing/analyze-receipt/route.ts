import { NextResponse } from 'next/server';

interface ReceiptAnalysis {
  vad: string;
  datum: string | null;
  belopp: number;
  moms: number;
  land: string;
  avsandare: string;
  betalningssatt: string | null;
}

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

    const mimeType = file.type || 'image/jpeg';
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = `data:${mimeType};base64,${base64}`;

    const systemPrompt = `Du är expert på svensk bokföring och kvittoanalys. Analysera kvittot/fakturan och returnera JSON med exakt dessa fält:
{
  "vad": "kort beskrivning av vad som köptes/såldes",
  "datum": "YYYY-MM-DD eller null",
  "belopp": number (totalt inkl moms),
  "moms": number (momsbelopp, 0 om ej synligt),
  "land": "Sverige" eller "EU" eller "Utanför EU",
  "avsandare": "namn på utfärdaren",
  "betalningssatt": "Kontant" eller "Till företagskonto" eller "Till privatkonto" eller null
}`;

    const userMessage =
      haendelse === 'kund-betalat'
        ? 'Analysera denna faktura/betalningsbekräftelse för en försäljning vi gjort.'
        : 'Analysera detta kvitto/faktura för ett inköp vi gjort.';

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 600,
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
