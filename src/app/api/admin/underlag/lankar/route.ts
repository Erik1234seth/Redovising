import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Signerade länkar till flera underlag, för Ladda ner alla i Underlag-fliken.
 * Webbläsaren hämtar filerna själv och packar dem i en zip, så filerna går
 * inte genom Vercel.
 *
 * POST { ids: string[] } → { filer: [{ namn, url }] }
 */

const BUCKET = 'bokforing-underlag';
const SIGNED_URL_TTL = 600;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  if (!ids.length) return NextResponse.json({ error: 'Inga underlag valda' }, { status: 400 });

  const supabase = getSupabase();
  const rader: { id: string; file_name: string | null; file_path: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('bokforing_underlag').select('id, file_name, file_path').in('id', ids.slice(i, i + 200));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rader.push(...(data ?? []));
  }
  const medFil = rader.filter((r) => r.file_path);
  if (!medFil.length) return NextResponse.json({ filer: [] });

  const { data: lankar, error } = await supabase.storage.from(BUCKET).createSignedUrls(medFil.map((r) => r.file_path!), SIGNED_URL_TTL);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = new Map((lankar ?? []).filter((l) => l.signedUrl).map((l) => [l.path, l.signedUrl]));
  const filer = medFil
    .filter((r) => url.has(r.file_path!))
    .map((r) => ({ namn: r.file_name || r.file_path!.split('/').pop() || r.id, url: url.get(r.file_path!)! }));
  return NextResponse.json({ filer });
}
