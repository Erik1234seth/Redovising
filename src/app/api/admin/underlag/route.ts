import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AdminUnderlag } from '@/lib/admin-types';

/**
 * Underlagen kunderna laddat upp i bokföringsfliken, och knapparna som för dem
 * framåt.
 *
 * Filen tas emot och sparas direkt — den tolkas inte vid uppladdningen. Den här
 * routen är andra halvan: den listar vad som kommit in, ger en länk att ladda
 * ned filen och låter Erik markera var i genomgången underlaget står.
 *
 * Bucketen `bokforing-underlag` är privat, så filerna når man bara via en
 * signerad länk. Den skapas här och lever en timme — tillräckligt för att öppna
 * filen, för kort för att hamna i någons historik som en permanent nyckel.
 */

const STATUSES = ['inkommet', 'granskas', 'bokfort'] as const;
type Status = (typeof STATUSES)[number];

const BUCKET = 'bokforing-underlag';
const SIGNED_URL_TTL = 60 * 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: rows, error } = await supabase
      .from('bokforing_underlag')
      .select('id, user_id, file_name, file_path, file_size, mime_type, status, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const underlag = rows ?? [];
    const userIds = [...new Set(underlag.map((r) => r.user_id).filter(Boolean))];

    // Vem filen kom från. Utan namnet är listan bara filnamn och klockslag.
    const profiles = userIds.length
      ? (await supabase.from('profiles').select('id, email, full_name, company_name').in('id', userIds)).data ?? []
      : [];
    const byUser = new Map(profiles.map((p) => [p.id, p]));

    // En signerad länk per fil. Misslyckas en enskild ska resten av listan
    // fortfarande gå att använda, så felet blir en tom länk och inget mer.
    const signed = await Promise.all(
      underlag.map(async (r) => {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(r.file_path, SIGNED_URL_TTL);
        return data?.signedUrl ?? null;
      }),
    );

    const list: AdminUnderlag[] = underlag.map((r, i) => {
      const profile = byUser.get(r.user_id);
      const email = profile?.email?.trim() || null;
      return {
        id: r.id,
        fileName: r.file_name,
        fileSize: r.file_size,
        mimeType: r.mime_type,
        status: r.status,
        at: r.created_at,
        url: signed[i],
        // Personvyn slår upp på vilken adress som helst, så mejlnyckeln räcker
        personKey: email ? `e:${email.toLowerCase()}` : null,
        personName: profile?.full_name?.trim() || null,
        personEmail: email,
        company: profile?.company_name?.trim() || null,
      };
    });

    return NextResponse.json({
      underlag: list,
      count: list.filter((u) => u.status === 'inkommet').length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/underlag]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Flyttar ett underlag mellan inkommet, granskas och bokfört. */
export async function PATCH(request: NextRequest) {
  try {
    const { id, status } = await request.json();

    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });
    if (!STATUSES.includes(status as Status)) {
      return NextResponse.json({ error: `status måste vara ${STATUSES.join(', ')}` }, { status: 400 });
    }

    const { error } = await getSupabase().from('bokforing_underlag').update({ status }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
