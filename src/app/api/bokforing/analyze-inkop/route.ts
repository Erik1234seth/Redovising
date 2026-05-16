import { NextResponse } from 'next/server';

interface AnalyzeInkopRequest {
  vad: string;
  saljarLand: string;
  betalningssatt: string;
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
    const body: AnalyzeInkopRequest = await request.json();
    const { vad, saljarLand, betalningssatt, datum, belopp, moms, ovrigt } = body;

    if (!vad || !saljarLand || !betalningssatt || !datum || belopp === undefined || moms === undefined) {
      return NextResponse.json({ error: 'Saknade fält i förfrågan' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API-nyckel saknas' }, { status: 500 });
    }

    const systemPrompt = `Du är expert på svensk bokföring. Analysera detta inköp och ge korrekt bokföringsinformation. Returnera JSON med exakt dessa fält:
{
  "kategori": "beskrivning av inköpskategori",
  "varaEllerTjanst": "Vara" eller "Tjänst" eller "Blandat",
  "momsregel": "förklaring av momsregel (1-2 meningar)",
  "momsats": "25%" eller "12%" eller "6%" eller "0%",
  "konton": {
    "debit": { "konto": "kontonummer", "namn": "kontonamn" },
    "kredit": { "konto": "kontonummer", "namn": "kontonamn" }
  },
  "noteringar": "viktiga noteringar eller tom sträng"
}

BAS-kontoregler för inköp:
- Rörelsekostnader Sverige: debet 5xxx/6xxx (t.ex. 5410 förbrukningsinventarier, 5460 förbrukningsmaterial, 6110 kontorsmaterial, 6540 IT-kostnader), kredit baseras på betalningssätt (1930 företagskonto, 1920 privatkonto, 1910 kontant)
- Ingående moms: 2640 (25%), 2641 (12%), 2642 (6%)
- EU B2B-inköp: omvänd skattskyldighet (reverse charge), debet kostnadskonto + 2614 (ingående moms omvänd), kredit 2614 + 2614 kvittning
- Utanför EU: import, debet kostnadskonto, kredit betalningskonto
- Anläggningstillgångar (maskiner/utrustning >5000 kr som varar >3 år): debet 1220/1230, kredit betalningskonto`;

    const userMessage = `Analysera detta inköp:
- Vad köptes: ${vad}
- Säljarens land: ${saljarLand}
- Betalningssätt: ${betalningssatt}
- Datum: ${datum}
- Belopp inkl. moms: ${belopp} kr
- Varav moms: ${moms} kr
- Övrig information: ${ovrigt || 'Ingen'}

Ange rätt BAS-konton för debet och kredit. Debetera kostnadskontot och kreditera betalningskontot baserat på betalningssättet (${betalningssatt}).`;

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
    console.error('Error in /api/bokforing/analyze-inkop:', error);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
