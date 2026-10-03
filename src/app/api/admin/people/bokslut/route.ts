import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { BokslutManuell, BokslutPunktId, BokslutStatus } from '@/lib/admin-types';
import { momsnrFranOrgnr } from '@/lib/momsnr';

/**
 * Sparar det Erik fyller i på bokslutschecklistan.
 *
 * Två sorters ändringar: orgnumret och verksamheten skrivs till sina vanliga
 * kolumner på profilen (samma som kunden fyller i själv), och en
 * punkts status, och filen som laddats upp på den, skrivs till
 * `bokslut_checklista`. Status null betyder "låt checklistan räkna fram den
 * själv igen".
 */

const PUNKTER: BokslutPunktId[] = ['orgnr', 'momsnr', 'verksamhet', 'metod', 'moms', 'ne', 'lager', 'underlag'];
const STATUSAR: BokslutStatus[] = ['klart', 'saknas', 'kolla', 'ej'];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      profileId?: string;
      orgNr?: string;
      verksamhet?: string;
      punkt?: BokslutPunktId;
      status?: BokslutStatus | null;
      underlagId?: string | null;
    };
    if (!body.profileId) {
      return NextResponse.json({ error: 'Personen har inget konto att spara på' }, { status: 400 });
    }
    const supabase = getSupabase();

    if (body.verksamhet !== undefined) {
      const { error } = await supabase
        .from('profiles').update({ verksamhet: body.verksamhet.trim() || null }).eq('id', body.profileId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Momsnumret följer med orgnumret: det skrivs när det saknas, och byts när
    // det var det som räknats fram ur det gamla orgnumret. Ett handskrivet
    // momsnummer rörs inte, och inte heller ett hos en kund utan moms.
    if (body.orgNr !== undefined) {
      const { data: profil, error: readError } = await supabase
        .from('profiles').select('org_nr, momsnr, moms_period').eq('id', body.profileId).maybeSingle();
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
      if (!profil) return NextResponse.json({ error: 'Hittade inte kontot' }, { status: 404 });

      const orgNr = body.orgNr.trim() || null;
      let momsNr: string | null = profil.momsnr?.trim() || null;
      const harlett = momsnrFranOrgnr(orgNr);
      if (harlett && profil.moms_period !== 'ingen-moms'
        && (!momsNr || momsNr === momsnrFranOrgnr(profil.org_nr))) {
        momsNr = harlett;
      }
      const { error } = await supabase
        .from('profiles').update({ org_nr: orgNr, momsnr: momsNr }).eq('id', body.profileId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, momsNr });
    }

    if (!body.punkt || !PUNKTER.includes(body.punkt)) {
      return NextResponse.json({ error: 'Okänd punkt' }, { status: 400 });
    }
    if (body.status != null && !STATUSAR.includes(body.status)) {
      return NextResponse.json({ error: `status måste vara ${STATUSAR.join(', ')}` }, { status: 400 });
    }

    const { data: profil, error: readError } = await supabase
      .from('profiles').select('bokslut_checklista').eq('id', body.profileId).maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!profil) return NextResponse.json({ error: 'Hittade inte kontot' }, { status: 404 });

    const lista = { ...(profil.bokslut_checklista ?? {}) } as Partial<Record<BokslutPunktId, BokslutManuell>>;
    const tidigare = lista[body.punkt];
    const next: BokslutManuell = {
      status: body.status !== undefined ? body.status : tidigare?.status ?? null,
      underlagId: body.underlagId !== undefined ? body.underlagId : tidigare?.underlagId ?? null,
      at: new Date().toISOString(),
    };
    // Inget kvar att minnas — då tas punkten bort helt
    if (!next.status && !next.underlagId) delete lista[body.punkt];
    else lista[body.punkt] = next;

    const { error } = await supabase.from('profiles').update({ bokslut_checklista: lista }).eq('id', body.profileId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, manuellt: lista });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
