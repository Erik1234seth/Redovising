import { NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { pathToFileURL } from 'url';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Arkivet för SIE4-fliken på /ai-test.
 *
 *   GET   – listar tidigare sparade filer (utan tolkningen, som är tung)
 *   POST  – sparar en uppladdad fil: tolkas om på servern och läggs i sie_files
 *
 * Tabellen har RLS på utan policies, så bara service role kommer åt den.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

interface SieHeader {
  program: string;
  format: string;
  sietyp: string;
  orgnr: string;
  foretag: string;
  genererad: string;
  rakenskapsar: { id: string; start: string; slut: string }[];
}

interface SieResultat {
  filnamn: string;
  teckenkodning: string;
  header: SieHeader;
  summering: {
    antalVerifikationer: number;
    antalTransaktioner: number;
    summaDebet: number;
    summaKredit: number;
    differens: number;
  };
}

interface SieModule {
  tolkaSie: (buffer: Buffer, filnamn: string) => SieResultat;
  avkoda: (buffer: Buffer) => { text: string; teckenkodning: string };
}

async function loadSieModule(): Promise<SieModule> {
  const file = pathToFileURL(path.join(process.cwd(), 'ai-test', 'sie.mjs')).href;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${file}?t=${Date.now()}`) as Promise<SieModule>;
}

function devOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'AI-testet är bara tillgängligt lokalt' }, { status: 404 });
  }
  return null;
}

/** Kolumnerna som listvyn behöver — tolkning och innehåll utelämnas med flit. */
const LIST_KOLUMNER =
  'id, created_at, filnamn, storlek_bytes, teckenkodning, foretag, orgnr, program, sietyp, ' +
  'rakenskapsar_start, rakenskapsar_slut, antal_verifikationer, antal_transaktioner, ' +
  'summa_debet, summa_kredit, differens, anteckning, kund_id, ' +
  'kund:kund_id (id, company_name, full_name, email)';

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('sie_files')
      .select(LIST_KOLUMNER)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return NextResponse.json({ filer: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in GET /api/ai-test/sie-arkiv:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const anteckning = (formData.get('anteckning') as string | null)?.trim() || null;
    const kundId = (formData.get('kundId') as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil bifogad' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    const supabase = createServerClient();

    // Samma fil sparad tidigare? Returnera den istället för att skapa en dubblett.
    const { data: befintlig, error: sökFel } = await supabase
      .from('sie_files')
      .select(LIST_KOLUMNER)
      .eq('checksum', checksum)
      .limit(1)
      .maybeSingle();

    if (sökFel) throw new Error(sökFel.message);
    if (befintlig) {
      const rad = befintlig as unknown as { id: string; kund_id: string | null };
      // Redan sparad — men om du valt kund den här gången så sätts den ändå
      if (kundId && !rad.kund_id) {
        const { data: uppdaterad } = await supabase
          .from('sie_files')
          .update({ kund_id: kundId })
          .eq('id', rad.id)
          .select(LIST_KOLUMNER)
          .single();
        return NextResponse.json({ fil: uppdaterad ?? befintlig, redanSparad: true });
      }
      return NextResponse.json({ fil: befintlig, redanSparad: true });
    }

    // Tolka på servern istället för att lita på det klienten skickar
    const { tolkaSie, avkoda } = await loadSieModule();
    const tolkning = tolkaSie(buffer, file.name);
    const { text } = avkoda(buffer);
    const rar = tolkning.header.rakenskapsar?.[0];

    const { data, error } = await supabase
      .from('sie_files')
      .insert({
        filnamn: file.name,
        storlek_bytes: buffer.length,
        checksum,
        teckenkodning: tolkning.teckenkodning,
        foretag: tolkning.header.foretag || null,
        orgnr: tolkning.header.orgnr || null,
        program: tolkning.header.program || null,
        sietyp: tolkning.header.sietyp || null,
        rakenskapsar_start: rar?.start || null,
        rakenskapsar_slut: rar?.slut || null,
        antal_verifikationer: tolkning.summering.antalVerifikationer,
        antal_transaktioner: tolkning.summering.antalTransaktioner,
        summa_debet: tolkning.summering.summaDebet,
        summa_kredit: tolkning.summering.summaKredit,
        differens: tolkning.summering.differens,
        tolkning,
        innehall: text,
        anteckning,
        kund_id: kundId,
      })
      .select(LIST_KOLUMNER)
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ fil: data, redanSparad: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ett oväntat fel inträffade';
    console.error('Error in POST /api/ai-test/sie-arkiv:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
