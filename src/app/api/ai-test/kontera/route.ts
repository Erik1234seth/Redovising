import { NextResponse } from 'next/server';
import path from 'path';
import { pathToFileURL } from 'url';
import { createServerClient } from '@/lib/supabase-server';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';

/**
 * Konterar valda transaktionsrader — t.ex. markerade rader ur en sparad
 * SIE4-fil — med samma AI-analys som en uppladdad fil får.
 *
 * Raderna görs om till en CSV och skickas genom analyseraFil, så att
 * kundkontext, basdokument och prompt fungerar exakt likadant här.
 *
 * Rådernas befintliga konton skickas INTE med: poängen är att se vad AI:n
 * själv föreslår, så att det går att jämföra med vad som redan står i filen.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

interface Rad {
  datum?: string;
  text?: string;
  belopp?: number;
  /** Kända för tolkade kvitton, okända för rader ur en SIE-fil */
  moms?: number;
  haendelse?: string;
}

interface AnalyzeModule {
  analyseraFil: (o: {
    buffer: Buffer;
    filnamn: string;
    typ?: string;
    modell?: string;
    prompt?: string;
    kundkontext?: string;
    basdokument?: boolean;
    apiKey: string;
  }) => Promise<unknown>;
}

interface TvaPassModule {
  konteraTvaPass: (o: {
    rader: Rad[];
    kalla?: string;
    kundkontext?: string;
    basdokument?: boolean;
    modell?: string;
    prompt?: string;
    granskningsModell?: string;
    apiKey: string;
  }) => Promise<unknown>;
}

/** Läses om vid varje anrop — dev-servern lever länge och cachar annars ESM. */
function laddaFarskt<T>(filnamn: string): Promise<T> {
  const file = pathToFileURL(path.join(process.cwd(), 'ai-test', filnamn)).href;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${file}?t=${Date.now()}`) as Promise<T>;
}

function csvFalt(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'AI-testet är bara tillgängligt lokalt' }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY saknas i .env.local' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const rader: Rad[] = Array.isArray(body.rader) ? body.rader : [];
    const kundId: string | undefined = body.kundId || undefined;
    const modell: string | undefined = body.modell || undefined;
    const prompt: string | undefined = body.prompt || undefined;
    const basdokument = Boolean(body.basdokument);
    const tvaPass = Boolean(body.tvaPass);
    const kalla: string = body.kalla || 'valda rader';

    if (rader.length === 0) {
      return NextResponse.json({ error: 'Inga rader valda' }, { status: 400 });
    }

    let kundkontext: string | undefined;
    if (kundId) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('profiles')
        .select(KUND_KOLUMNER)
        .eq('id', kundId)
        .maybeSingle();

      if (error) throw new Error(`Kunde inte hämta kunden: ${error.message}`);
      kundkontext = byggKundkontext((data as unknown as Kund) ?? null) || undefined;
    }

    if (tvaPass) {
      const { konteraTvaPass } = await laddaFarskt<TvaPassModule>('tvapass.mjs');
      const svar = await konteraTvaPass({
        rader,
        kalla,
        kundkontext,
        basdokument,
        modell,
        prompt,
        apiKey,
      });
      return NextResponse.json({ ...(svar as object), antalRader: rader.length });
    }

    const csv = [
      ['Datum', 'Beskrivning', 'Belopp'].join(';'),
      ...rader.map((r) => [csvFalt(r.datum), csvFalt(r.text), csvFalt(r.belopp)].join(';')),
    ].join('\n');

    const { analyseraFil } = await laddaFarskt<AnalyzeModule>('analyze.mjs');
    const svar = await analyseraFil({
      buffer: Buffer.from(csv, 'utf-8'),
      filnamn: `${kalla}.csv`,
      typ: 'transaktioner',
      modell,
      prompt,
      kundkontext,
      basdokument,
      apiKey,
    });

    return NextResponse.json({ ...(svar as object), antalRader: rader.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in /api/ai-test/kontera:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
