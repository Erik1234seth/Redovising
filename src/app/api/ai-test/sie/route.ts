import { NextResponse } from 'next/server';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Backend för SIE4-fliken på /ai-test.
 *
 * Tolkningen sker i ai-test/sie.mjs — en vanlig parser, ingen AI och
 * inget som sparas.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SieModule {
  tolkaSie: (buffer: Buffer, filnamn: string) => unknown;
}

async function loadSieModule(): Promise<SieModule> {
  const file = pathToFileURL(path.join(process.cwd(), 'ai-test', 'sie.mjs')).href;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${file}?t=${Date.now()}`) as Promise<SieModule>;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'AI-testet är bara tillgängligt lokalt' }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil bifogad' }, { status: 400 });
    }

    const { tolkaSie } = await loadSieModule();
    const resultat = tolkaSie(Buffer.from(await file.arrayBuffer()), file.name);

    return NextResponse.json(resultat);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in /api/ai-test/sie:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
