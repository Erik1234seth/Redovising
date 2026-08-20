import { NextResponse } from 'next/server';
import path from 'path';
import { pathToFileURL } from 'url';
import { createServerClient } from '@/lib/supabase-server';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';

/**
 * Backend för AI-testsidan på /ai-test.
 *
 * Kör samma analys som CLI:t (npm run ai-test) genom att importera
 * ai-test/analyze.mjs i runtime — så finns logiken bara på ett ställe.
 *
 * Endast dev: rutten tar emot en fri systemprompt, så den ska aldrig vara
 * öppen i produktion.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

interface AnalyzeModule {
  analyseraFil: (o: {
    buffer: Buffer;
    filnamn: string;
    typ?: string;
    haendelse?: string;
    modell?: string;
    prompt?: string;
    kundkontext?: string;
    egetNamn?: string[];
    basdokument?: boolean;
    apiKey: string;
  }) => Promise<unknown>;
  loadPrompts: () => Promise<{
    MODELLER: Record<string, string>;
    KVITTO_PROMPT: string;
    KVITTO_PROMPT_AUTO: string;
    TRANSAKTIONER_PROMPT: string;
    TRANSAKTIONER_PROMPT_FRI: string;
  }>;
}

interface BasdokumentModule {
  basdokumentStatus: () => Promise<{ totalt: number; kallor: { source: string; chunkar: number }[] }>;
}

async function loadBasdokumentModule(): Promise<BasdokumentModule> {
  const file = pathToFileURL(path.join(process.cwd(), 'ai-test', 'basdokument.mjs')).href;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${file}?t=${Date.now()}`) as Promise<BasdokumentModule>;
}

async function loadAnalyzeModule(): Promise<AnalyzeModule> {
  // ?t= gör att dev-servern plockar upp ändringar i ai-test/*.mjs utan omstart.
  // Node cachar annars ESM-moduler för processens livstid.
  const file = pathToFileURL(path.join(process.cwd(), 'ai-test', 'analyze.mjs')).href;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${file}?t=${Date.now()}`) as Promise<AnalyzeModule>;
}

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'AI-testet är bara tillgängligt lokalt' }, { status: 404 });
  }
  return null;
}

/** Hämtar standardprompter och modeller så sidan kan förifylla formuläret. */
export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const { loadPrompts } = await loadAnalyzeModule();
    const { basdokumentStatus } = await loadBasdokumentModule();
    const [prompts, basdokument] = await Promise.all([loadPrompts(), basdokumentStatus()]);

    return NextResponse.json({
      modeller: prompts.MODELLER,
      prompter: {
        kvitto: prompts.KVITTO_PROMPT,
        // Läget där modellen själv avgör inköp eller försäljning
        kvittoAuto: prompts.KVITTO_PROMPT_AUTO,
        transaktioner: prompts.TRANSAKTIONER_PROMPT,
        // Tvåpassläget kör utan promptens lista på vanliga konton
        transaktionerFri: prompts.TRANSAKTIONER_PROMPT_FRI,
      },
      basdokument,
      harNyckel: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json({ error: `Kunde inte läsa prompts.mjs: ${message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY saknas i .env.local' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const typ = (formData.get('typ') as string | null) || undefined;
    const haendelse = (formData.get('haendelse') as string | null) || undefined;
    const modell = (formData.get('modell') as string | null) || undefined;
    const prompt = (formData.get('prompt') as string | null) || undefined;
    const kundId = (formData.get('kundId') as string | null) || undefined;
    const basdokument = formData.get('basdokument') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil bifogad' }, { status: 400 });
    }

    // Kundkontexten byggs på servern från databasen, inte från det klienten
    // skickar — så det som hamnar i prompten alltid speglar kundens uppgifter.
    let kundkontext: string | undefined;
    // Kundens egna namn: står de som utfärdare på underlaget är det en
    // försäljning, och det avgör koden framför modellens gissning.
    let egetNamn: string[] | undefined;
    if (kundId) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('profiles')
        .select(KUND_KOLUMNER)
        .eq('id', kundId)
        .maybeSingle();

      if (error) throw new Error(`Kunde inte hämta kunden: ${error.message}`);
      const kund = (data as unknown as Kund) ?? null;
      kundkontext = byggKundkontext(kund) || undefined;
      egetNamn = [kund?.company_name, kund?.full_name].filter((n): n is string => Boolean(n));
    }

    const { analyseraFil } = await loadAnalyzeModule();
    const svar = await analyseraFil({
      buffer: Buffer.from(await file.arrayBuffer()),
      filnamn: file.name,
      typ: typ === 'auto' ? undefined : typ,
      haendelse,
      modell,
      prompt,
      kundkontext,
      egetNamn,
      basdokument,
      apiKey,
    });

    return NextResponse.json(svar);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in /api/ai-test/analyze:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
