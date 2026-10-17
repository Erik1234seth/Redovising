import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AdminUnderlag } from '@/lib/admin-types';
import { importPendingSie, reimportAfterDelete } from '@/lib/sie/import';
import { FLYTTAD_FOR_HAND } from '@/lib/underlag/sortering';

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

    // SIE-filer som inte lagts in som verifikationer än, t.ex. från appen
    await importPendingSie(supabase);

    const { data: rows, error } = await supabase
      .from('bokforing_underlag')
      .select('id, user_id, sender_email, source, file_name, file_path, file_size, mime_type, status, created_at, verifikationer_inlagda_at, verifikationer_antal, verifikationer_dubbletter, verifikationer_fel, varningar')
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
      // Mejlade underlag från någon utan konto har bara avsändarens adress
      const profile = r.user_id ? byUser.get(r.user_id) : undefined;
      const email = profile?.email?.trim() || r.sender_email?.trim() || null;
      return {
        id: r.id,
        fileName: r.file_name,
        fileSize: r.file_size,
        mimeType: r.mime_type,
        varningar: r.varningar ?? [],
        status: r.status,
        at: r.created_at,
        source: r.source ?? 'app',
        verifikationer: r.verifikationer_inlagda_at ? {
          at: r.verifikationer_inlagda_at,
          inlagda: r.verifikationer_antal ?? 0,
          dubbletter: r.verifikationer_dubbletter ?? 0,
          fel: r.verifikationer_fel,
        } : null,
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

/**
 * Flyttar ett underlag mellan inkommet, granskas och bokfört — eller, med
 * `sortering`, mellan underlagen och övriga filer.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, status, sortering } = await request.json();

    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });
    if (sortering !== undefined) return flytta(getSupabase(), id, sortering);
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

/**
 * Erik flyttar en fil själv. Det gäller sedan före AI-avläsningens bedömning.
 *
 * Blir filen en övrig fil tas det som lästs ut ur den bort — transaktionerna
 * med sina konteringar och verifikationerna AI:n skrev av — så att inget ur
 * den bokförs. Tillbaka bland underlagen läses den av på nytt med AI.
 */
async function flytta(supabase: ReturnType<typeof getSupabase>, id: string, sortering: unknown) {
  if (sortering !== 'underlag' && sortering !== 'ovrigt') {
    return NextResponse.json({ error: 'sortering måste vara underlag eller ovrigt' }, { status: 400 });
  }

  if (sortering === 'ovrigt') {
    const { error: tFel } = await supabase.from('transaktioner').delete().eq('underlag_id', id);
    if (tFel) return NextResponse.json({ error: `Kunde inte ta bort transaktionerna: ${tFel.message}` }, { status: 500 });
    const { error: vFel } = await supabase.from('verifikationer').delete().eq('underlag_id', id).eq('kalla', 'ai');
    if (vFel) return NextResponse.json({ error: `Kunde inte ta bort verifikationerna: ${vFel.message}` }, { status: 500 });
  }

  const { error } = await supabase.from('bokforing_underlag').update({
    sortering,
    sortering_orsak: FLYTTAD_FOR_HAND,
    sortering_at: new Date().toISOString(),
    ...(sortering === 'ovrigt' ? {
      transaktioner_utlasta_at: null, transaktioner_antal: null, transaktioner_notering: null, transaktioner_fel: null,
      verifikationer_inlagda_at: null, verifikationer_antal: null, verifikationer_dubbletter: null, verifikationer_fel: null,
      varningar: null, kontroll_status: null, kontroll_saknas: null, kontroll_at: null,
    } : {}),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Raderar ett eller flera underlag — både filerna i bucketen och raderna.
 * Tar `id` för ett, `ids` för flera markerade.
 *
 * Filerna tas bort först. Går det sedan snett med raderna ligger de kvar som
 * "Filen saknas i lagringen" och kan raderas igen, i stället för att filerna
 * blir liggande i bucketen utan att någon ser dem.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id, ids } = await request.json();
    const lista: string[] = Array.isArray(ids) ? ids.filter((v) => typeof v === 'string') : id ? [id] : [];
    if (lista.length === 0) return NextResponse.json({ error: 'id krävs' }, { status: 400 });

    const supabase = getSupabase();

    const { data: rows, error: fetchError } = await supabase
      .from('bokforing_underlag')
      .select('file_path, user_id, sender_email, verifikationer_antal')
      .in('id', lista);

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!rows?.length) return NextResponse.json({ ok: true });

    const sokvagar = rows.map((r) => r.file_path).filter(Boolean);
    if (sokvagar.length) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(sokvagar);
      if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    // Filernas verifikationer följer med i kaskaden
    const { error } = await supabase.from('bokforing_underlag').delete().in('id', lista);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fanns samma verifikationer i en annan fil hos kunden tar den över dem —
    // en gång per kund, hur många av kundens filer som än raderades
    const agare = new Map<string, { userId: string | null; email: string | null }>();
    for (const r of rows) {
      if (!r.verifikationer_antal) continue;
      const email = r.sender_email?.trim().toLowerCase() || null;
      agare.set(`${r.user_id ?? ''}|${email ?? ''}`, { userId: r.user_id, email });
    }
    for (const owner of agare.values()) await reimportAfterDelete(supabase, owner);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/underlag DELETE]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
