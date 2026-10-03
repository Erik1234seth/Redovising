import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Laddar ned ett underlag med sitt ursprungliga filnamn.
 *
 * Länken signeras först när någon klickar, i stället för att personvyn skapar
 * en signerad länk per fil varje gång den öppnas. Routen svarar med en
 * omdirigering till lagringen, så filen går inte genom Vercel.
 */

const BUCKET = 'bokforing-underlag';
const SIGNED_URL_TTL = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from('bokforing_underlag')
    .select('file_name, file_path')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row?.file_path) return NextResponse.json({ error: 'Hittade inget sådant underlag' }, { status: 404 });

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.file_path, SIGNED_URL_TTL, { download: row.file_name || true });

  if (signError || !data?.signedUrl) {
    return NextResponse.json({ error: signError?.message || 'Filen saknas i lagringen' }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
