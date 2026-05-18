import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

const SYSTEM_PROMPT = `Du är expert på svensk bokföring. Analysera denna transaktionslista och returnera ett JSON-objekt med nyckeln "transactions" som innehåller en array. Varje transaktion ska ha exakt dessa fält:
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
- haendelse_typ "kund-betalat" = inkomst/försäljning (pengar IN till företaget)
- haendelse_typ "kopt-nagot" = utgift/inköp (pengar UT från företaget)
- Använd svenska BAS-konton. Vanliga: 1930 Företagskonto, 3001 Försäljning tjänster, 3002 Försäljning varor, 4000 Inköp varor, 5000 Lokalkostnader, 5400 Förbrukningsinventarier, 6000 Övriga rörelsekostnader
- För försäljning: debit 1930 / kredit 3001 eller 3002
- För inköp: debit relevant kostnadskonto / kredit 1930
- Om avgifter (t.ex. Zettle-provision): inkludera i beloppet och använd konto 6570 Bankkostnader för avgiften
- Skippa rader som är rubriker, summor eller tomma
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

function fileToText(buffer: Buffer, mimeType: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv' || mimeType === 'text/csv' || mimeType === 'text/plain') {
    return buffer.toString('utf-8');
  }

  // Excel
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

function truncateRows(text: string, maxRows = 200): string {
  const rows = text.split('\n');
  if (rows.length <= maxRows + 1) return text;
  return rows.slice(0, maxRows + 1).join('\n') + `\n... (${rows.length - maxRows - 1} rader borttagna)`;
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
    let csvText: string;
    try {
      csvText = fileToText(buffer, file.type, file.name);
    } catch {
      return NextResponse.json({ error: 'Kunde inte läsa filen. Kontrollera att det är en giltig CSV- eller Excel-fil.' }, { status: 400 });
    }

    const truncated = truncateRows(csvText, 200);

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analysera dessa transaktioner:\n\n${truncated}` },
        ],
        max_completion_tokens: 16000,
      }),
    });

    if (!openAIResponse.ok) {
      const errText = await openAIResponse.text();
      console.error('OpenAI API error:', errText);
      return NextResponse.json({ error: 'Fel vid kontakt med AI-tjänsten' }, { status: 502 });
    }

    const openAIData = await openAIResponse.json();
    const rawContent = openAIData.choices?.[0]?.message?.content ?? '';

    let parsed: { transactions: ParsedTransaction[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        console.error('Could not parse OpenAI response:', rawContent);
        return NextResponse.json({ error: 'Kunde inte tolka AI-svaret' }, { status: 500 });
      }
    }

    const transactions: ParsedTransaction[] = (parsed.transactions ?? []).map((t) => ({
      datum: t.datum ?? '',
      beskrivning: t.beskrivning ?? '',
      belopp: Number(t.belopp) || 0,
      moms: Number(t.moms) || 0,
      haendelse_typ: t.haendelse_typ === 'kopt-nagot' ? 'kopt-nagot' : 'kund-betalat',
      debit_konto: t.debit_konto ?? '1930',
      debit_namn: t.debit_namn ?? 'Okänt konto',
      kredit_konto: t.kredit_konto ?? '3001',
      kredit_namn: t.kredit_namn ?? 'Okänt konto',
    }));

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error in /api/bokforing/analyze-transactions:', error);
    return NextResponse.json({ error: 'Ett oväntat fel inträffade' }, { status: 500 });
  }
}
