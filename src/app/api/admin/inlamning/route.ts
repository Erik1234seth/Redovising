import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { UNDERLAG_BUCKET } from '@/lib/inmail/save-attachments';
import type { InlamningKund, InlamningPeriod, MomsPeriod } from '@/lib/admin-types';
import { aktuellaPerioder, type DeklTyp } from '@/lib/deadlines';
import { eskdOrgNr } from '@/lib/moms/eskd';
import { personnummer12 } from '@/lib/ne/ne';

/**
 * Inlämningssidan: vilka kunder vi ska lämna moms eller NE för just nu, och
 * vad som redan är inlämnat.
 *
 * GET    ?typ=moms|ne              → kunderna med sina aktuella perioder
 * GET    ?kvittens=<id>            → kvittensen, som omdirigering till lagringen
 * POST   { profileId, typ, period } → markera inlämnad
 * POST   { action: 'prepare' | 'confirm', id, fileName, path } → ladda upp kvittens
 * DELETE ?id=<id>                  → ångra inlämnad (kvittensen tas bort med)
 *
 * Flaggorna räknas grovt här, för listan. Den exakta genomgången — rutorna
 * och varningarna för filen — görs i panelen till höger när kunden väljs.
 */

const TYPER: DeklTyp[] = ['moms', 'ne'];

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const params = request.nextUrl.searchParams;

  const kvittensId = params.get('kvittens');
  if (kvittensId) {
    const { data: rad } = await supabase.from('inlamningar').select('kvittens_path, kvittens_namn').eq('id', kvittensId).maybeSingle();
    if (!rad?.kvittens_path) return NextResponse.json({ error: 'Ingen kvittens' }, { status: 404 });
    const { data, error } = await supabase.storage.from(UNDERLAG_BUCKET)
      .createSignedUrl(rad.kvittens_path, 60, { download: rad.kvittens_namn || true });
    if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || 'Filen saknas' }, { status: 404 });
    return NextResponse.redirect(data.signedUrl);
  }

  const typ = params.get('typ') as DeklTyp;
  if (!TYPER.includes(typ)) return NextResponse.json({ error: 'typ måste vara moms eller ne' }, { status: 400 });

  try {
    const idag = new Date().toISOString().slice(0, 10);
    const [{ data: profiler, error: pFel }, { data: gjorda, error: iFel }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, company_name, org_nr, moms_period'),
      supabase.from('inlamningar').select('id, profile_id, period, inlamnad_at, kvittens_namn').eq('typ', typ),
    ]);
    if (pFel) throw new Error(pFel.message);
    if (iFel) throw new Error(iFel.message);

    const kunder: InlamningKund[] = [];
    const saknarMomsperiod: { profileId: string; namn: string; email: string | null }[] = [];

    for (const p of profiler ?? []) {
      const namn = p.full_name?.trim() || p.company_name?.trim() || p.email || 'Okänd';
      const mina = (gjorda ?? []).filter((g) => g.profile_id === p.id);
      const perioder = aktuellaPerioder(typ, p.moms_period as MomsPeriod | null, new Set(mina.map((g) => g.period)), idag);

      if (typ === 'moms' && !p.moms_period) {
        saknarMomsperiod.push({ profileId: p.id, namn, email: p.email });
        continue;
      }
      if (!perioder.length) continue;

      const idFel = typ === 'moms'
        ? (eskdOrgNr(p.org_nr) ? null : 'Organisationsnummer saknas')
        : (personnummer12(p.org_nr) ? null : 'Personnummer saknas');

      kunder.push({
        profileId: p.id,
        email: p.email,
        namn,
        foretag: p.company_name?.trim() || null,
        momsPeriod: p.moms_period as MomsPeriod | null,
        perioder: perioder.map((d): InlamningPeriod => {
          const gjord = mina.find((g) => g.period === d.period);
          return {
            ...d,
            forsenad: d.deadline < idag,
            inlamning: gjord ? { id: gjord.id, at: gjord.inlamnad_at, kvittensNamn: gjord.kvittens_namn } : null,
            flaggor: idFel ? [idFel] : [],
          };
        }),
      });
    }

    await flaggaBokforing(supabase, kunder);
    return NextResponse.json({ kunder, saknarMomsperiod });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/inlamning]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Lägger till flaggor om bokföringen i varje period: ingen bokföring alls,
 * verifikationer som inte går jämnt ut, och transaktioner som inte bokförts.
 */
async function flaggaBokforing(supabase: ReturnType<typeof createServerClient>, kunder: InlamningKund[]) {
  const alla = kunder.flatMap((k) => k.perioder);
  if (!alla.length) return;
  const fran = alla.reduce((m, p) => (p.fran < m ? p.fran : m), alla[0].fran);
  const tom = alla.reduce((m, p) => (p.tom > m ? p.tom : m), alla[0].tom);
  const ids = kunder.map((k) => k.profileId);
  const mejl = kunder.map((k) => k.email?.toLowerCase()).filter((e): e is string => !!e);

  const agare = (rad: { user_id: string | null; customer_email: string | null }) =>
    kunder.find((k) => k.profileId === rad.user_id || (!!rad.customer_email && k.email?.toLowerCase() === rad.customer_email.toLowerCase()));
  const filter = [
    `user_id.in.(${ids.join(',')})`,
    ...(mejl.length ? [`customer_email.in.(${mejl.map((e) => `"${e}"`).join(',')})`] : []),
  ].join(',');

  const ver: { user_id: string | null; customer_email: string | null; datum: string | null; balanserad: boolean; transaktion_id: string | null }[] = [];
  const tr: { id: string; user_id: string | null; customer_email: string | null; datum: string | null; dublett_av: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('verifikationer')
      .select('user_id, customer_email, datum, balanserad, transaktion_id')
      .or(filter).gte('datum', fran).lte('datum', tom).range(from, from + 999);
    if (error) throw new Error(`Kunde inte läsa verifikationer: ${error.message}`);
    ver.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('transaktioner')
      .select('id, user_id, customer_email, datum, dublett_av')
      .or(filter).gte('datum', fran).lte('datum', tom).range(from, from + 999);
    if (error) throw new Error(`Kunde inte läsa transaktioner: ${error.message}`);
    tr.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const bokforda = new Set(ver.map((v) => v.transaktion_id).filter(Boolean));

  for (const k of kunder) {
    const minaV = ver.filter((v) => agare(v) === k);
    const minaT = tr.filter((t) => agare(t) === k && !t.dublett_av);
    for (const p of k.perioder) {
      const iP = <T extends { datum: string | null }>(r: T) => !!r.datum && r.datum >= p.fran && r.datum <= p.tom;
      const v = minaV.filter(iP);
      const t = minaT.filter(iP);
      p.antalVerifikationer = v.length;
      if (!v.length) p.flaggor.push('Ingen bokföring i perioden');
      const obal = v.filter((x) => !x.balanserad).length;
      if (obal) p.flaggor.push(`${obal} ${obal === 1 ? 'verifikation går' : 'verifikationer går'} inte jämnt ut`);
      // Jämförelsen håller bara när perioden bokförs via konteringen, som
      // kopplar verifikationen till transaktionen. Verifikationer ur SIE eller
      // den äldre AI-inläsningen saknar kopplingen och hade gett falskt larm.
      const viaKontering = v.some((x) => x.transaktion_id);
      const ej = viaKontering || !v.length ? t.filter((x) => !bokforda.has(x.id)).length : 0;
      if (ej) p.flaggor.push(`${ej} ${ej === 1 ? 'transaktion' : 'transaktioner'} inte bokförda`);
    }
  }
}

/** Bara riktiga periodnycklar kan markeras: "2026-08", "2026-K3" eller "2026". */
function giltigPeriod(typ: DeklTyp, period: string): boolean {
  if (typ === 'ne') return /^\d{4}$/.test(period);
  return /^\d{4}(-(0[1-9]|1[0-2])|-K[1-4])?$/.test(period);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const body = await request.json();

    if (body.action === 'prepare' || body.action === 'confirm') {
      const { data: rad } = await supabase.from('inlamningar').select('id, profile_id, kvittens_path').eq('id', body.id).maybeSingle();
      if (!rad) return NextResponse.json({ error: 'Hittade inte inlämningen' }, { status: 404 });
      const mapp = `kvittenser/${rad.profile_id}`;

      if (body.action === 'prepare') {
        const safe = String(body.fileName || 'kvittens').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60);
        const { data, error } = await supabase.storage.from(UNDERLAG_BUCKET)
          .createSignedUploadUrl(`${mapp}/${Date.now()}_${safe}`);
        if (error || !data) return NextResponse.json({ error: `Kunde inte skapa uppladdningslänk: ${error?.message}` }, { status: 500 });
        return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
      }

      if (!String(body.path || '').startsWith(`${mapp}/`)) {
        return NextResponse.json({ error: 'Sökvägen hör inte till kunden' }, { status: 400 });
      }
      const { error } = await supabase.from('inlamningar')
        .update({ kvittens_path: body.path, kvittens_namn: String(body.fileName || 'kvittens') }).eq('id', rad.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // En ny kvittens ersätter den gamla
      if (rad.kvittens_path && rad.kvittens_path !== body.path) {
        await supabase.storage.from(UNDERLAG_BUCKET).remove([rad.kvittens_path]);
      }
      return NextResponse.json({ ok: true });
    }

    const { profileId, typ, period } = body as { profileId?: string; typ?: DeklTyp; period?: string };
    if (!profileId || !typ || !TYPER.includes(typ) || !period || !giltigPeriod(typ, period)) {
      return NextResponse.json({ error: 'profileId, typ och en giltig period krävs' }, { status: 400 });
    }
    const { data, error } = await supabase.from('inlamningar')
      .upsert({ profile_id: profileId, typ, period }, { onConflict: 'profile_id,typ,period' })
      .select('id, inlamnad_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id, at: data.inlamnad_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/inlamning]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 });
  const supabase = createServerClient();
  const { data: rad, error } = await supabase.from('inlamningar').delete().eq('id', id).select('kvittens_path').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (rad?.kvittens_path) await supabase.storage.from(UNDERLAG_BUCKET).remove([rad.kvittens_path]);
  return NextResponse.json({ ok: true });
}
