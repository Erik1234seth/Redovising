import { NextResponse } from 'next/server';
import {
  buildImageParts, buildPdfParts, buildTextParts, isImage, isPdf, spreadsheetToText,
} from '@/lib/underlag/fil-delar';

const SYSTEM_PROMPT = `Du är expert på svensk bokföring. Du får ett underlag — en PDF med sidor, en bild eller en textlista. Läs av ALLA transaktionsrader och returnera ett JSON-objekt med nyckeln "transactions" som innehåller en array. Varje transaktion ska ha exakt dessa fält:
{
  "datum": "YYYY-MM-DD",
  "beskrivning": "kort beskrivning av transaktionen",
  "belopp": number (positivt tal, totalt inkl moms),
  "moms": number (momsbelopp, 0 om okänt eller saknas),
  "haendelse_typ": "kund-betalat" eller "kopt-nagot",
  "debit_konto": "kontonummer",
  "debit_namn": "kontonamn",
  "kredit_konto": "kontonummer",
  "kredit_namn": "kontonamn"
}

Regler:
- VIKTIGAST: varje transaktionsrad i underlaget ska ge exakt en transaktion i svaret. Gå igenom sidan uppifrån och ner, rad för rad. Slå aldrig ihop rader, hoppa aldrig över rader och korta aldrig ner listan — även om den är lång och raderna liknar varandra.
- Ett negativt belopp i underlaget betyder utgift ("kopt-nagot"), ett positivt belopp betyder inkomst ("kund-betalat"). Fältet "belopp" ska alltid vara ett positivt tal.
- haendelse_typ "kund-betalat" = inkomst/försäljning (pengar IN till företaget)
- haendelse_typ "kopt-nagot" = utgift/inköp (pengar UT från företaget)
- En kolumn med löpande saldo/balans är INTE transaktionens belopp — använd beloppskolumnen
- Använd svenska BAS-konton. Vanliga: 1930 Företagskonto, 3001 Försäljning tjänster, 3002 Försäljning varor, 4000 Inköp varor, 5000 Lokalkostnader, 5400 Förbrukningsinventarier, 6000 Övriga rörelsekostnader
- För försäljning: debit 1930 / kredit 3001 eller 3002
- För inköp: debit relevant kostnadskonto / kredit 1930
- Om avgifter (t.ex. Zettle-provision): inkludera i beloppet och använd konto 6570 Bankkostnader för avgiften
- Skippa rader som är rubriker, adresser, summor, saldobesked eller tomma
- Returnera BARA JSON, ingen annan text`;

interface ParsedTransaction {
  datum: string;
  beskrivning: string;
  belopp: number;
  moms: number;
  haendelse_typ: string;
  debit_konto: string;
  debit_namn: string;
  kredit_konto: string;
  kredit_namn: string;
}

// Så många AI-anrop i taget, så ett stort underlag inte skickar tjugo samtidigt
const MAX_PARALLEL_CALLS = 4;

type PartResult =
  | { ok: true; transactions: ParsedTransaction[] }
  | { ok: false; status: number; error: string };

async function analyzeContent(userContent: unknown, apiKey: string, fileName: string): Promise<PartResult> {
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
      max_completion_tokens: 16000,
    }),
  });

  if (!openAIResponse.ok) {
    const errText = await openAIResponse.text();
    console.error('OpenAI API error:', errText);
    return { ok: false, status: 502, error: 'Fel vid kontakt med AI-tjänsten' };
  }

  const openAIData = await openAIResponse.json();
  const choice = openAIData.choices?.[0];
  const finishReason = choice?.finish_reason;
  const rawContent = (choice?.message?.content ?? '').trim();

  if (choice?.message?.refusal) {
    console.error('OpenAI refusal:', choice.message.refusal);
    return {
      ok: false,
      status: 422,
      error: `AI:n kunde inte läsa ${fileName}. Kontrollera att filen innehåller en transaktionslista.`,
    };
  }

  if (finishReason === 'length') {
    return {
      ok: false,
      status: 413,
      error: `${fileName} innehåller för många transaktioner för att läsas i en omgång. Dela upp filen och försök igen.`,
    };
  }

  // Tomt svar = AI:n hittade inget i den här delen, inte ett fel
  if (!rawContent) return { ok: true, transactions: [] };

  let parsed: { transactions?: ParsedTransaction[] };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\{[\s\S]*\}/);
    try {
      if (!match) throw new Error('no json object in response');
      parsed = JSON.parse(match[0]);
    } catch {
      console.error(`Could not parse OpenAI response (finish_reason: ${finishReason}):`, rawContent);
      return { ok: false, status: 500, error: `Kunde inte tolka AI-svaret för ${fileName}.` };
    }
  }

  const transactions: ParsedTransaction[] = (parsed.transactions ?? []).map((t) => ({
    datum: t.datum ?? '',
    beskrivning: t.beskrivning ?? '',
    belopp: Math.abs(Number(t.belopp) || 0),
    moms: Number(t.moms) || 0,
    haendelse_typ: t.haendelse_typ === 'kopt-nagot' ? 'kopt-nagot' : 'kund-betalat',
    debit_konto: t.debit_konto ?? '1930',
    debit_namn: t.debit_namn ?? 'Okänt konto',
    kredit_konto: t.kredit_konto ?? '3001',
    kredit_namn: t.kredit_namn ?? 'Okänt konto',
  }));

  return { ok: true, transactions };
}

// Delarna körs parallellt men några i taget, så ett stort underlag inte
// skickar tjugo anrop samtidigt.
async function analyzeAllParts(parts: unknown[], apiKey: string, fileName: string): Promise<PartResult[]> {
  const results: PartResult[] = [];
  for (let i = 0; i < parts.length; i += MAX_PARALLEL_CALLS) {
    const batch = parts.slice(i, i + MAX_PARALLEL_CALLS);
    results.push(...(await Promise.all(batch.map((part) => analyzeContent(part, apiKey, fileName)))));
  }
  return results;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil bifogad' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API-nyckel saknas' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parts: unknown[];

    if (isPdf(file.type, file.name)) {
      try {
        parts = await buildPdfParts(buffer, file.name);
      } catch (err) {
        console.error('Could not split PDF:', err);
        return NextResponse.json(
          { error: `Kunde inte läsa ${file.name}. Kontrollera att det är en giltig PDF.` },
          { status: 400 }
        );
      }
    } else if (isImage(file.type, file.name)) {
      parts = buildImageParts(buffer, file.type, file.name);
    } else {
      let text: string;
      try {
        text = await spreadsheetToText(buffer, file.type, file.name);
      } catch {
        return NextResponse.json(
          { error: 'Kunde inte läsa filen. Kontrollera att det är en giltig CSV-, Excel-, PDF- eller bildfil.' },
          { status: 400 }
        );
      }

      if (!text.trim()) {
        return NextResponse.json({ error: `Vi hittade inget innehåll i ${file.name}.` }, { status: 422 });
      }

      parts = buildTextParts(text);
    }

    const results = await analyzeAllParts(parts, apiKey, file.name);

    // En del som fallerar ska inte ge en tyst halv lista — bokföringen måste bli komplett
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      return NextResponse.json({ error: failed.error }, { status: failed.status });
    }

    const transactions = results.flatMap((r) => (r.ok ? r.transactions : []));
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error in /api/bokforing/analyze-transactions:', error);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
