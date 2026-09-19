import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSieFile, tolkaSie } from '@/lib/sie/parse';
import { importSieUnderlag } from '@/lib/sie/import';

/**
 * Verifikationerna i ett SIE-underlag, tolkade med kod.
 *
 * SIE är ett strikt format, så här behövs ingen AI. Filen tolkas varje gång
 * sidan öppnas i stället för att sparas som rader: tolkningen tar millisekunder,
 * och då kan vyn aldrig visa något annat än det som faktiskt står i filen.
 *
 * Har filen inte lagts in hos kunden än görs det här, så sidan kan visa vad
 * den gav.
 */

export const runtime = 'nodejs';

const BUCKET = 'bokforing-underlag';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    await importSieUnderlag(supabase, id).catch((err) =>
      console.error('[admin/underlag/sie] import:', err instanceof Error ? err.message : err));

    const { data: row, error } = await supabase
      .from('bokforing_underlag')
      .select('id, user_id, sender_email, file_name, file_path, source, status, created_at, verifikationer_inlagda_at, verifikationer_antal, verifikationer_dubbletter, verifikationer_fel')
      .eq('id', id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Hittade inget sådant underlag' }, { status: 404 });

    if (!isSieFile(row.file_name)) {
      return NextResponse.json({ error: `${row.file_name} är ingen SIE-fil (.se, .si eller .sie)` }, { status: 400 });
    }

    const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(row.file_path);
    if (downloadError || !file) {
      return NextResponse.json({ error: `Filen saknas i lagringen: ${downloadError?.message ?? 'okänt fel'}` }, { status: 404 });
    }

    // Vem filen hör till, för länken tillbaka till personen
    let email = row.sender_email?.trim().toLowerCase() || null;
    if (row.user_id) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', row.user_id).maybeSingle();
      email = profile?.email?.trim().toLowerCase() || email;
    }

    return NextResponse.json({
      underlag: {
        id: row.id,
        fileName: row.file_name,
        source: row.source ?? 'app',
        status: row.status,
        at: row.created_at,
        personKey: email ? `e:${email}` : null,
        personEmail: email,
        import: row.verifikationer_inlagda_at ? {
          at: row.verifikationer_inlagda_at,
          inlagda: row.verifikationer_antal ?? 0,
          dubbletter: row.verifikationer_dubbletter ?? 0,
          fel: row.verifikationer_fel,
        } : null,
      },
      sie: tolkaSie(new Uint8Array(await file.arrayBuffer())),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/underlag/sie]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
