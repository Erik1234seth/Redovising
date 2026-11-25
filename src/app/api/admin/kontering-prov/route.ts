import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { anvandJamforelse, godkannProv, raderaProv, raderaTransaktioner, redigeraProv, startaProv, underlagAttKora, uppdateraProv, type Provrad, type Redigering } from '@/lib/kontering/omgang/prov';
import { FLODESMODELLER, arFlodesmodell, type Flodesmodell } from '@/lib/kontering/omgang/leverantor';
import { utanOmkorda } from '@/lib/kontering/omgang/korningar';
import { korOmPending, pendingInfo } from '@/lib/kontering/pending';

/**
 * Flöde i personkortet — konteringen (@/lib/kontering/omgang). Körningarna
 * sparas i kontering_prov, och svaren skrivs till transaktioner och konteringar.
 *
 *   GET     kundens underlag att välja bland, de som Kör Flöde tar (attKora), de som
 *           Kör om alla tar (allaAttKora) och
 *           kundens körningar. Delar som är skickade frågas efter hos leverantören,
 *           och klara svar prövas och skrivs. Underlag som körts om syns bara i
 *           den senaste körningen (utanOmkorda). pending: transaktionerna som väntar på
 *           mer information, med om frågan skickats (@/lib/kontering/pending). gamla:
 *           transaktionerna från det gamla flödet i filer som aldrig körts i Flöde.
 *           anteckningar: byråns egna anteckningar, efter transaktionens id.
 *   POST    starta en körning: { nya: true } tar allt som inte körts, { alla: true } allt
 *           som går att köra (Kör om alla), annars underlagIds.
 *           modell: 'gpt-6.2-sol' | 'claude-opus-5-5' (GPT om inget anges), och
 *           jamfor: true kör samma underlag med den andra modellen som jämförelse.
 *           { anteckning, transaktioner: [{ underlagId, vilken }] } sparar byråns
 *           anteckning som kontext på underlagen och kör om dem.
 *           { pending: true } konterar om kundens pending transaktioner som fått ny
 *           information, som kvällsjobbet gör (alla: true tar alla, torrkorning: true sparar inget).
 *   PATCH   godkänn en gul kontering, eller ångra. { anvand: korning } bokför en jämförelse i stället.
 *           { radera: [{ id, fil, nr }] } raderar transaktionerna ur bokföringen.
 *           { id, fil, nr, redigera: { datum, beskrivning, motpart, belopp, konto, momssats } }
 *           ändrar transaktionen och bokför den med byråns val.
 *           { hanterad: { underlagIds } } räknar underlagen som körda utan att läsa dem,
 *           och svarar med vad de hade förut; { aterstall: [{ id, flode_at }] } ångrar det.
 *           { egenAnteckning: { transaktionId, text } } sparar byråns egen anteckning
 *           på transaktionen. Den bokför inget och AI:n läser den inte; tom text tar bort den.
 *   DELETE  ta bort en körning ur listan (det bokförda ligger kvar)
 */

export const maxDuration = 300;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function fel(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[admin/kontering-prov]', message);
  return NextResponse.json({ error: message }, { status });
}

const RAD_KOLUMNER = 'id, created_at, user_id, korning, del, delar, status, modell, jamfor_med, underlag_ids, filer, varningar, openai_id, kontext, resultat, usage, kostnad_usd, uppskattade_tokens, fel, klar_at';

/** Betalkonton och moms: de säger inget om vad affären bokförts som. */
const BETAL_OCH_MOMS = /^(1930|2013|2017|2890|2440|1500|26\d\d)$/;

/** En transaktion som det gamla flödet läste ut, ur en fil som aldrig körts i Flöde. */
interface GammalFlodesTx {
  id: string;
  underlagId: string;
  datum: string | null;
  beskrivning: string;
  motpart: string;
  belopp: number;
  moms: number | null;
  valuta: string;
  riktning: 'in' | 'ut';
  dublett: boolean;
  forslag: { modell: string; konto: string | null; momssats: number | null; omdome: string }[];
  vald: string | null;
  /** Kontona på verifikationen, utan betalkonto och moms. Tom om den inte bokförts. */
  bokfort: string[];
}

/**
 * Transaktionerna från det gamla flödet (flödesschemat, före 2026-11-07), så
 * att de syns i Flöde bredvid de nya. Bara filer som aldrig körts klart i
 * Flöde: när en fil körs där ersätts dess transaktioner av Flödes egna.
 */
async function gamlaFlodet(supabase: SupabaseClient, userId: string): Promise<GammalFlodesTx[]> {
  const { data: korningar, error: kFel } = await supabase.from('kontering_prov').select('underlag_ids')
    .eq('user_id', userId).eq('status', 'klar').is('jamfor_med', null).limit(5000);
  if (kFel) throw new Error(kFel.message);
  const korda = new Set((korningar ?? []).flatMap((k) => (k.underlag_ids ?? []) as string[]));

  const tx: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('transaktioner')
      .select('id, underlag_id, datum, beskrivning, motpart, belopp, moms, valuta, riktning, dublett_av, vald_kontering')
      .eq('user_id', userId).not('underlag_id', 'is', null)
      .order('datum', { ascending: false }).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    tx.push(...(data ?? []).filter((t) => !korda.has(t.underlag_id as string)));
    if ((data ?? []).length < 1000) break;
  }

  const forslag = new Map<string, GammalFlodesTx['forslag']>();
  const bokfort = new Map<string, Set<string>>();
  const ids = tx.map((t) => t.id as string);
  for (let i = 0; i < ids.length; i += 200) {
    const del = ids.slice(i, i + 200);
    const [{ data: k, error: kErr }, { data: v, error: vErr }] = await Promise.all([
      supabase.from('konteringar').select('transaktion_id, modell, konto, momssats, omdome').in('transaktion_id', del),
      supabase.from('verifikationer').select('transaktion_id, verifikation_rader(konto, borttagen)').in('transaktion_id', del),
    ]);
    if (kErr) throw new Error(kErr.message);
    if (vErr) throw new Error(vErr.message);
    for (const r of k ?? []) {
      forslag.set(r.transaktion_id, [...(forslag.get(r.transaktion_id) ?? []), { modell: r.modell, konto: r.konto, momssats: r.momssats, omdome: r.omdome }]);
    }
    for (const r of v ?? []) {
      const konton = bokfort.get(r.transaktion_id) ?? new Set<string>();
      for (const rad of (r.verifikation_rader ?? []) as { konto: string; borttagen: boolean }[]) {
        if (!rad.borttagen && !BETAL_OCH_MOMS.test(rad.konto)) konton.add(rad.konto);
      }
      bokfort.set(r.transaktion_id, konton);
    }
  }

  return tx.map((t) => ({
    id: t.id as string,
    underlagId: t.underlag_id as string,
    datum: (t.datum as string | null) ?? null,
    beskrivning: (t.beskrivning as string | null) ?? '',
    motpart: (t.motpart as string | null) ?? '',
    belopp: Math.abs(Number(t.belopp) || 0),
    moms: t.moms === null ? null : Number(t.moms),
    valuta: (t.valuta as string | null) ?? 'SEK',
    riktning: t.riktning === 'in' ? 'in' : 'ut',
    dublett: !!t.dublett_av,
    forslag: forslag.get(t.id as string) ?? [],
    vald: (t.vald_kontering as { konto?: string } | null)?.konto ?? null,
    bokfort: [...(bokfort.get(t.id as string) ?? [])],
  }));
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return fel('userId saknas', 400);
  const supabase = getSupabase();
  try {
    // Klara svar hämtas först, så att listan nedan visar dem
    const { data: vantande } = await supabase.from('kontering_prov').select(RAD_KOLUMNER).eq('user_id', userId).eq('status', 'skickad');
    await Promise.all(((vantande ?? []) as Provrad[]).map((r) => uppdateraProv(supabase, r).catch((err) =>
      console.error(`[admin/kontering-prov] ${r.id}:`, err instanceof Error ? err.message : err))));

    const [{ data: rader, error }, { data: underlag, error: uFel }, attKora, allaAttKora, { data: kopplingar }, pending, gamla, { data: egna, error: aFel }] = await Promise.all([
      supabase.from('kontering_prov').select(RAD_KOLUMNER).eq('user_id', userId).order('created_at', { ascending: false }).order('del').limit(100),
      supabase.from('bokforing_underlag').select('id, file_name, mime_type, created_at, sortering, sortering_orsak, del_av, flode_at, kund_svar_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(2000),
      underlagAttKora(supabase, userId),
      underlagAttKora(supabase, userId, true),
      // Filer som kopplats till en befintlig transaktion som extra underlag (@/lib/kontering/omgang/skriv)
      supabase.from('underlag_kopplingar').select('underlag_id, transaktion_id')
        .eq('user_id', userId).not('transaktion_id', 'is', null).limit(5000),
      pendingInfo(supabase, userId),
      gamlaFlodet(supabase, userId),
      supabase.from('transaktioner').select('id, byrans_anteckning').eq('user_id', userId).not('byrans_anteckning', 'is', null).limit(5000),
    ]);
    if (error) throw new Error(error.message);
    if (aFel) throw new Error(aFel.message);
    if (uFel) throw new Error(uFel.message);

    // Hur många transaktioner varje underlag har fått förut
    const antal = new Map<string, number>();
    const ids = (underlag ?? []).map((u) => u.id);
    for (let i = 0; i < ids.length; i += 300) {
      const { data } = await supabase.from('transaktioner').select('underlag_id').in('underlag_id', ids.slice(i, i + 300));
      for (const t of data ?? []) antal.set(t.underlag_id, (antal.get(t.underlag_id) ?? 0) + 1);
    }

    return NextResponse.json({
      korningar: utanOmkorda((rader ?? []) as Provrad[]).map(({ kontext: _k, ...r }) => r),
      underlag: (underlag ?? []).map((u) => ({ ...u, transaktioner: antal.get(u.id) ?? 0 })),
      attKora,
      allaAttKora,
      kopplingar: kopplingar ?? [],
      pending,
      gamla,
      anteckningar: Object.fromEntries((egna ?? []).filter((t) => t.byrans_anteckning?.trim()).map((t) => [t.id, t.byrans_anteckning])),
    });
  } catch (err) {
    return fel(err);
  }
}

export async function POST(request: NextRequest) {
  let body: { userId?: string; underlagIds?: string[]; nya?: boolean; alla?: boolean; anteckning?: string; transaktioner?: { underlagId?: string; vilken?: string }[]; modell?: string; jamfor?: boolean; pending?: boolean; torrkorning?: boolean };
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
  }
  if (!body.userId) return fel('userId saknas', 400);
  // Kvällens omkörning av pending, för hand (se /api/cron/pending)
  if (body.pending) {
    try {
      return NextResponse.json(await korOmPending(getSupabase(), body.userId, { alla: !!body.alla, torrkorning: !!body.torrkorning }));
    } catch (err) {
      return fel(err);
    }
  }
  if (body.modell !== undefined && !arFlodesmodell(body.modell)) return fel(`Okänd modell: ${body.modell}`, 400);
  const modell: Flodesmodell = arFlodesmodell(body.modell) ? body.modell : FLODESMODELLER[0];
  const supabase = getSupabase();
  const userId = body.userId;
  /** Kör med modellen, och samtidigt med den andra som jämförelse om det valts. */
  const kor = async (ids: string[]) => {
    const korning = crypto.randomUUID();
    const andra = FLODESMODELLER.find((m) => m !== modell)!;
    // Båda får köra klart, även om den ena inte gick att skicka
    const [huvud, jamforelse] = await Promise.allSettled([
      startaProv(supabase, userId, ids, { modell, korning }),
      body.jamfor ? startaProv(supabase, userId, ids, { modell: andra, jamforMed: korning }) : Promise.resolve(null),
    ]);
    if (huvud.status === 'rejected') throw huvud.reason;
    if (jamforelse.status === 'rejected') throw new Error(`Huvudkörningen startade, men inte jämförelsen: ${jamforelse.reason instanceof Error ? jamforelse.reason.message : jamforelse.reason}`);
    return korning;
  };
  try {
    // Byråns anteckning på en eller flera transaktioner: sparas som kontext på
    // underlaget och följer med när filerna körs om, nu och senare
    if (body.anteckning !== undefined) {
      const text = String(body.anteckning).trim().slice(0, 4000);
      const tx = (body.transaktioner ?? []).filter((t) => typeof t.underlagId === 'string' && t.underlagId);
      if (!text) return fel('Skriv anteckningen', 400);
      if (!tx.length) return fel('Välj minst en transaktion', 400);
      const ids = [...new Set(tx.map((t) => t.underlagId!))];
      const { data: egna, error: uFel } = await supabase.from('bokforing_underlag').select('id').eq('user_id', body.userId).in('id', ids);
      if (uFel) throw new Error(uFel.message);
      if ((egna ?? []).length !== ids.length) return fel('Ett av underlagen hör inte till kunden', 400);
      const { error: iFel } = await supabase.from('flodes_instruktioner').insert(tx.map((t) => ({
        typ: 'kontext', omfang: 'underlag', steg: 'konteras', user_id: body.userId, underlag_id: t.underlagId, transaktion_id: null,
        text: `Gäller transaktionen ${String(t.vilken ?? '').trim().slice(0, 300) || 'i filen'}: ${text}`,
      })));
      if (iFel) throw new Error(`Kunde inte spara anteckningen: ${iFel.message}`);
      const korning = await kor(ids);
      return NextResponse.json({ ok: true, korning });
    }
    // Kör Flöde: allt som inte körts, eller där kunden skickat något nytt. Kör om alla: allt som går att köra
    const ids = body.nya || body.alla
      ? await underlagAttKora(supabase, body.userId, !!body.alla)
      : [...new Set((body.underlagIds ?? []).filter((x) => typeof x === 'string'))];
    if (!ids.length) return fel(body.alla ? 'Inget underlag att köra' : body.nya ? 'Inget nytt att köra' : 'Välj minst ett underlag', 400);
    const korning = await kor(ids);
    return NextResponse.json({ ok: true, korning });
  } catch (err) {
    return fel(err);
  }
}

/**
 * Godkänn en gul kontering, eller ångra: { userId, id, fil, nr, godkand }. Bokför en jämförelse: { userId, anvand }.
 * Radera transaktioner: { userId, radera: [{ id, fil, nr }] }.
 * Ändra en transaktion: { userId, id, fil, nr, redigera }.
 */
/**
 * Byrån har sett underlagen och vill inte köra dem: de räknas som lästa i
 * Flöde (flode_at), så att Kör nya inte tar dem och de inte står som nya.
 * Inget läses eller bokförs. Svarar med det de hade förut, för Ångra.
 */
async function markeraHanterade(supabase: SupabaseClient, userId: string, ids: string[]) {
  const { data, error } = await supabase.from('bokforing_underlag').select('id, flode_at, transaktioner_notering').eq('user_id', userId).in('id', ids);
  if (error) throw new Error(error.message);
  const nu = new Date().toISOString();
  for (const u of data ?? []) {
    const { error: uFel } = await supabase.from('bokforing_underlag').update({
      flode_at: nu,
      // En fil som aldrig lästs får en notering om varför den inte har några transaktioner
      ...(u.transaktioner_notering ? {} : { transaktioner_notering: 'Markerad som körd av byrån, utan att läsas' }),
    }).eq('id', u.id);
    if (uFel) throw new Error(uFel.message);
  }
  return (data ?? []).map((u) => ({ id: u.id as string, flode_at: (u.flode_at as string | null) ?? null }));
}

export async function PATCH(request: NextRequest) {
  let body: {
    userId?: string; id?: string; fil?: string; nr?: number; godkand?: boolean; anvand?: string; redigera?: Redigering;
    radera?: { id?: unknown; fil?: unknown; nr?: unknown }[];
    hanterad?: { underlagIds?: unknown };
    aterstall?: { id?: unknown; flode_at?: unknown }[];
    egenAnteckning?: { transaktionId?: unknown; text?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
  }
  // Byråns egen anteckning: sparas på transaktionen, inget annat ändras
  if (body.userId && body.egenAnteckning) {
    const { transaktionId, text } = body.egenAnteckning;
    if (typeof transaktionId !== 'string' || !transaktionId) return fel('transaktionId saknas', 400);
    const ren = typeof text === 'string' ? text.trim().slice(0, 4000) : '';
    try {
      const { data, error } = await getSupabase().from('transaktioner').update({ byrans_anteckning: ren || null })
        .eq('id', transaktionId).eq('user_id', body.userId).select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) return fel('Transaktionen finns inte längre — ladda om sidan', 404);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return fel(err);
    }
  }
  // Underlag som byrån inte vill köra räknas som körda: de står inte längre som nya
  if (body.userId && body.hanterad) {
    const ids = (Array.isArray(body.hanterad.underlagIds) ? body.hanterad.underlagIds : []).filter((x): x is string => typeof x === 'string');
    if (!ids.length) return fel('Välj minst ett underlag', 400);
    try {
      return NextResponse.json({ ok: true, fore: await markeraHanterade(getSupabase(), body.userId, ids) });
    } catch (err) {
      return fel(err);
    }
  }
  // Ångra: underlagen får tillbaka det de hade
  if (body.userId && body.aterstall) {
    const lista = (Array.isArray(body.aterstall) ? body.aterstall : [])
      .filter((x) => typeof x.id === 'string' && (x.flode_at === null || (typeof x.flode_at === 'string' && !Number.isNaN(Date.parse(x.flode_at)))))
      .map((x) => ({ id: x.id as string, flode_at: x.flode_at as string | null }));
    if (!lista.length) return fel('Inget att ångra', 400);
    try {
      const supabase = getSupabase();
      for (const x of lista) {
        const { error } = await supabase.from('bokforing_underlag').update({ flode_at: x.flode_at }).eq('id', x.id).eq('user_id', body.userId);
        if (error) throw new Error(error.message);
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      return fel(err);
    }
  }
  if (body.userId && body.radera) {
    const valda = (Array.isArray(body.radera) ? body.radera : [])
      .filter((v) => typeof v.id === 'string' && typeof v.fil === 'string' && typeof v.nr === 'number')
      .map((v) => ({ id: v.id as string, fil: v.fil as string, nr: v.nr as number }));
    if (!valda.length) return fel('Välj minst en transaktion', 400);
    try {
      const raderade = await raderaTransaktioner(getSupabase(), body.userId, valda);
      return NextResponse.json({ ok: true, raderade });
    } catch (err) {
      return fel(err);
    }
  }
  if (body.userId && body.anvand) {
    try {
      await anvandJamforelse(getSupabase(), body.userId, body.anvand);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return fel(err);
    }
  }
  if (!body.userId || !body.id || !body.fil || typeof body.nr !== 'number') return fel('userId, id, fil och nr krävs', 400);
  if (body.redigera) {
    try {
      await redigeraProv(getSupabase(), body.userId, body.id, body.fil, body.nr, body.redigera);
      return NextResponse.json({ ok: true });
    } catch (err) {
      return fel(err, 400);
    }
  }
  try {
    await godkannProv(getSupabase(), body.userId, body.id, body.fil, body.nr, body.godkand !== false);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const korning = request.nextUrl.searchParams.get('korning');
  if (!userId || !korning) return fel('userId och korning krävs', 400);
  try {
    await raderaProv(getSupabase(), userId, korning);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}
