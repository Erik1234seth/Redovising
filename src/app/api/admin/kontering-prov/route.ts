import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { anvandJamforelse, godkannProv, raderaProv, raderaTransaktioner, startaProv, underlagAttKora, uppdateraProv, type Provrad } from '@/lib/kontering/omgang/prov';
import { FLODESMODELLER, arFlodesmodell, type Flodesmodell } from '@/lib/kontering/omgang/leverantor';
import type { Resultat } from '@/lib/kontering/omgang/svar';

/**
 * Flöde i personkortet — konteringen (@/lib/kontering/omgang). Körningarna
 * sparas i kontering_prov, och svaren skrivs till transaktioner och konteringar.
 *
 *   GET     kundens underlag att välja bland, de som Kör Flöde tar (attKora) och
 *           kundens körningar. Delar som är skickade frågas efter hos leverantören,
 *           och klara svar prövas och skrivs. Underlag som körts om syns bara i
 *           den senaste körningen (utanOmkorda).
 *   POST    starta en körning: { nya: true } tar allt som inte körts, annars underlagIds.
 *           modell: 'gpt-6.1-sol' | 'claude-opus-5-5' (GPT om inget anges), och
 *           jamfor: true kör samma underlag med den andra modellen som jämförelse.
 *           { anteckning, transaktioner: [{ underlagId, vilken }] } sparar byråns
 *           anteckning som kontext på underlagen och kör om dem.
 *   PATCH   godkänn en gul kontering, eller ångra. { anvand: korning } bokför en jämförelse i stället.
 *           { radera: [{ id, fil, nr }] } raderar transaktionerna ur bokföringen.
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

/**
 * En ny körning ersätter de äldre för samma underlag: filer som körts om
 * senare tas bort ur den äldre körningen, och en del där allt körts om visas
 * inte alls. En körning som inte gick att skicka eller blev fel ersätter
 * inget, och inte heller en jämförelse — den är inte bokförd. Raderna i
 * databasen ändras inte.
 */
function utanOmkorda(rader: Provrad[]): Provrad[] {
  // Raderna kommer nyast först; delarna i en körning hålls ihop
  const korningar = new Map<string, Provrad[]>();
  for (const r of rader) korningar.set(r.korning, [...(korningar.get(r.korning) ?? []), r]);

  const senare = new Set<string>();
  const ut: Provrad[] = [];
  for (const delar of korningar.values()) {
    for (const r of delar) {
      const ids = r.underlag_ids ?? [];
      const kvar = ids.filter((id) => !senare.has(id));
      if (kvar.length === ids.length) { ut.push(r); continue; }
      if (!kvar.length) continue;
      const res = r.resultat as Resultat | null;
      ut.push({
        ...r,
        underlag_ids: kvar,
        resultat: res?.filer ? { ...res, filer: res.filer.filter((f) => !senare.has(f.underlagId)) } : r.resultat,
      });
    }
    for (const r of delar) if (r.status !== 'fel' && !r.jamfor_med && r.filer?.length) for (const id of r.underlag_ids ?? []) senare.add(id);
  }
  return ut;
}

const RAD_KOLUMNER = 'id, created_at, user_id, korning, del, delar, status, modell, jamfor_med, underlag_ids, filer, varningar, openai_id, kontext, resultat, usage, kostnad_usd, uppskattade_tokens, fel, klar_at';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return fel('userId saknas', 400);
  const supabase = getSupabase();
  try {
    // Klara svar hämtas först, så att listan nedan visar dem
    const { data: vantande } = await supabase.from('kontering_prov').select(RAD_KOLUMNER).eq('user_id', userId).eq('status', 'skickad');
    await Promise.all(((vantande ?? []) as Provrad[]).map((r) => uppdateraProv(supabase, r).catch((err) =>
      console.error(`[admin/kontering-prov] ${r.id}:`, err instanceof Error ? err.message : err))));

    const [{ data: rader, error }, { data: underlag, error: uFel }, attKora] = await Promise.all([
      supabase.from('kontering_prov').select(RAD_KOLUMNER).eq('user_id', userId).order('created_at', { ascending: false }).order('del').limit(100),
      supabase.from('bokforing_underlag').select('id, file_name, mime_type, created_at, sortering, sortering_orsak, del_av, flode_at, kund_svar_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(2000),
      underlagAttKora(supabase, userId),
    ]);
    if (error) throw new Error(error.message);
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
    });
  } catch (err) {
    return fel(err);
  }
}

export async function POST(request: NextRequest) {
  let body: { userId?: string; underlagIds?: string[]; nya?: boolean; anteckning?: string; transaktioner?: { underlagId?: string; vilken?: string }[]; modell?: string; jamfor?: boolean };
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
  }
  if (!body.userId) return fel('userId saknas', 400);
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
    // Kör Flöde: allt som inte körts, eller där kunden skickat något nytt
    const ids = body.nya
      ? await underlagAttKora(supabase, body.userId)
      : [...new Set((body.underlagIds ?? []).filter((x) => typeof x === 'string'))];
    if (!ids.length) return fel(body.nya ? 'Inget nytt att köra' : 'Välj minst ett underlag', 400);
    const korning = await kor(ids);
    return NextResponse.json({ ok: true, korning });
  } catch (err) {
    return fel(err);
  }
}

/**
 * Godkänn en gul kontering, eller ångra: { userId, id, fil, nr, godkand }. Bokför en jämförelse: { userId, anvand }.
 * Radera transaktioner: { userId, radera: [{ id, fil, nr }] }.
 */
export async function PATCH(request: NextRequest) {
  let body: { userId?: string; id?: string; fil?: string; nr?: number; godkand?: boolean; anvand?: string; radera?: { id?: unknown; fil?: unknown; nr?: unknown }[] };
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
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
