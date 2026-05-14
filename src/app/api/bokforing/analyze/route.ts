import { NextResponse } from 'next/server';

interface AnalyzeRequest {
  vad: string;
  kundLand: string;
  betalningssatt: string;
  kundTyp?: string;
  datum: string;
  belopp: number;
  moms: number;
  ovrigt?: string;
}

interface AnalysisResult {
  kategori: string;
  varaEllerTjanst: string;
  momsregel: string;
  momsats: string;
  konton: {
    debit: { konto: string; namn: string };
    kredit: { konto: string; namn: string };
  };
  noteringar: string;
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { vad, kundLand, betalningssatt, kundTyp, datum, belopp, moms, ovrigt } = body;

    if (!vad || !kundLand || !betalningssatt || !datum || belopp === undefined || moms === undefined) {
      return NextResponse.json({ error: 'Saknade fält i förfrågan' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API-nyckel saknas' }, { status: 500 });
    }

    const systemPrompt = `Du är en expert på svensk redovisning och momsregler. Din uppgift är att analysera en försäljningshändelse och ge korrekt bokföringsinformation enligt svensk lagstiftning och BAS-kontoplanen.

Regler du ska tillämpa:
- Försäljning inom Sverige: normalt 25% moms (konto 3001/3051), 12% för livsmedel/hotell (3002/3052), 6% för böcker/tidningar/persontransport (3003/3053)
- Försäljning till EU-företag (B2B): omvänd skattskyldighet, ingen svensk moms, konto 3106
- Försäljning till EU-konsumenter (B2C) digitala tjänster: OSS-regler, köparlandets moms gäller, konto 3108
- Försäljning till EU-konsumenter (B2C) fysiska varor/icke-digitala tjänster: svensk moms om under 10 000 EUR/år, annars OSS
- Försäljning utanför EU: ingen moms (export), konto 3105 för varor, 3108 för tjänster
- Momsredovisningskonto: 2610 (utgående moms 25%), 2620 (12%), 2630 (6%)
- Kundfordran/betalning: 1510 (kundfordringar), 1930 (företagskonto), 1910 (kassa/kontant), 1920 (privatkonto om ej rekommenderat)

Svara ALLTID med ett JSON-objekt med exakt dessa fält:
{
  "kategori": "Kort beskrivning av försäljningskategorin",
  "varaEllerTjanst": "Vara" eller "Tjänst" eller "Blandat",
  "momsregel": "Förklaring av vilken momsregel som gäller (1-2 meningar)",
  "momsats": "25%" eller "12%" eller "6%" eller "0%" eller "OSS",
  "konton": {
    "debit": { "konto": "kontonummer", "namn": "kontonamn" },
    "kredit": { "konto": "kontonummer", "namn": "kontonamn" }
  },
  "noteringar": "Viktiga noteringar eller varningar (kan vara tom sträng)"
}`;

    const userMessage = `Analysera denna försäljning:
- Vad såldes: ${vad}
- Kundens land: ${kundLand}
- Kundtyp: ${kundTyp || 'Okänt (Sverige, ej relevant)'}
- Betalningssätt: ${betalningssatt}
- Datum: ${datum}
- Belopp inkl. moms: ${belopp} kr
- Varav moms: ${moms} kr
- Övrig information: ${ovrigt || 'Ingen'}

Avgör om det är en vara eller tjänst baserat på beskrivningen. Ange rätt BAS-konton för debet och kredit. Kreditera försäljningskontot och debetert betalningskontot baserat på betalningssättet (${betalningssatt}).`;

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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!openAIResponse.ok) {
      const errText = await openAIResponse.text();
      console.error('OpenAI API error:', errText);
      return NextResponse.json({ error: 'Fel vid kontakt med AI-tjänsten' }, { status: 502 });
    }

    const openAIData = await openAIResponse.json();
    const rawContent = openAIData.choices?.[0]?.message?.content ?? '';

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(rawContent) as AnalysisResult;
    } catch {
      // Fallback: try to extract JSON from the response
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]) as AnalysisResult;
      } else {
        console.error('Could not parse OpenAI response:', rawContent);
        return NextResponse.json({ error: 'Kunde inte tolka AI-svaret' }, { status: 500 });
      }
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error in /api/bokforing/analyze:', error);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
