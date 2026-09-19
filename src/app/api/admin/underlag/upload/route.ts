import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { UNDERLAG_BUCKET, folderFor, resolveUserId } from '@/lib/inmail/save-attachments';
import { isSieFile } from '@/lib/sie/parse';
import { importSieUnderlag } from '@/lib/sie/import';

/**
 * Laddar upp underlag åt en kund från personsidan i adminpanelen.
 *
 * Samma två steg som när Apps Script sparar mejlbilagor:
 *   1. `prepare` ger en engångslänk till lagringen
 *   2. webbläsaren PUT:ar filen dit direkt
 *   3. `confirm` skriver raden när filen ligger på plats
 * Filen passerar alltså aldrig Vercel, vars gräns på 4,5 MB per anrop annars
 * stoppat det mesta som inte är ett enstaka kvitto.
 *
 * Underlaget kopplas till kontot när kunden har ett, så att kunden ser det i
 * appen. Annars kopplas det till mejladressen, precis som ett mejlat underlag,
 * och följer med om kontot skapas senare.
 */

const MAX_SIZE = 50 * 1024 * 1024; // bucketens gräns

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface Body {
  action?: 'prepare' | 'confirm';
  profileId?: string | null;
  email?: string | null;
  fileName?: string;
  size?: number;
  mimeType?: string;
  path?: string;
}

/** Vem underlaget hör till: kontot om det finns, annars adressen. */
async function owner(supabase: SupabaseClient, body: Body) {
  let email = body.email?.trim().toLowerCase() || null;

  if (body.profileId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', body.profileId)
      .maybeSingle();
    if (!profile) throw new Error('Hittade inget konto med det id:t');
    email = profile.email?.trim().toLowerCase() || email;
    return { userId: profile.id as string, email };
  }

  if (!email?.includes('@')) throw new Error('Personen har varken konto eller mejladress att koppla underlaget till');
  return { userId: await resolveUserId(supabase, email), email };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const fileName = body.fileName?.trim();
    const size = Number(body.size);

    if (!fileName) return NextResponse.json({ error: 'fileName krävs' }, { status: 400 });
    if (!Number.isFinite(size) || size < 0) return NextResponse.json({ error: 'size krävs' }, { status: 400 });
    if (size > MAX_SIZE) return NextResponse.json({ error: `${fileName} är större än 50 MB` }, { status: 400 });

    const supabase = getSupabase();
    const { userId, email } = await owner(supabase, body);
    const folder = folderFor(userId, email ?? '');

    if (body.action === 'prepare') {
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60) || 'fil';
      const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
      const { data, error } = await supabase.storage.from(UNDERLAG_BUCKET).createSignedUploadUrl(path);
      if (error || !data) {
        return NextResponse.json({ error: `Kunde inte skapa uppladdningslänk: ${error?.message ?? 'okänt fel'}` }, { status: 500 });
      }
      return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
    }

    if (body.action === 'confirm') {
      // Sökvägen kommer från webbläsaren — den måste ligga i mappen vi delade ut
      if (!body.path?.startsWith(`${folder}/`)) {
        return NextResponse.json({ error: 'Sökvägen hör inte till personen' }, { status: 400 });
      }
      const { error: missing } = await supabase.storage.from(UNDERLAG_BUCKET).createSignedUrl(body.path, 60);
      if (missing) return NextResponse.json({ error: `Filen kom inte fram till lagringen: ${missing.message}` }, { status: 400 });

      const { data, error } = await supabase.from('bokforing_underlag').insert({
        user_id: userId,
        sender_email: email,
        source: 'admin',
        file_name: fileName,
        file_path: body.path,
        file_size: size,
        mime_type: body.mimeType?.trim() || 'application/octet-stream',
      }).select('id').single();

      if (error) {
        await supabase.storage.from(UNDERLAG_BUCKET).remove([body.path]);
        return NextResponse.json({ error: `Kunde inte spara ${fileName}: ${error.message}` }, { status: 500 });
      }
      // SIE tolkas direkt, så verifikationerna finns hos kunden när sidan laddas om
      const sie = isSieFile(fileName)
        ? await importSieUnderlag(supabase, data.id).catch((err) => ({
          inlagda: 0, dubbletter: 0, fel: err instanceof Error ? err.message : 'Okänt fel',
        }))
        : null;
      return NextResponse.json({ ok: true, id: data.id, sie });
    }

    return NextResponse.json({ error: "action måste vara 'prepare' eller 'confirm'" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/underlag/upload]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
