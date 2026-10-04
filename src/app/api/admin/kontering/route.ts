import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminKontering, AdminKonteringRad } from '@/lib/admin-types';
import { bokforManuellt, konteraTransaktioner } from '@/lib/kontering/kontera';
import { slaUppKonto } from '@/lib/kontering/regelverk';

/**
 * Konteringsfliken i personkortet. Bara adminpanelen når hit — /api/admin
 * är spärrat i middleware, och kunden ser aldrig konteringen.
 *
 *   GET     transaktionerna med modellernas förslag och eventuell verifikation
 *   POST    kontera EN transaktion med båda modellerna (en per anrop, så att
 *           anropet hinner klart inom fem minuter — fliken kör flera parallellt)
 *   PUT     bokför ett förslag eller ett eget konto för hand
 *   DELETE  radera bokföringen, eller hela konteringen (förslag och bokföring),
 *           för en eller flera transaktioner — de kan då konteras om
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
  console.error('[admin/kontering]', message);
  return NextResponse.json({ error: message }, { status });
}

const CHUNK = 200;

/** Raderna för fliken. Dubbletter och rader på 0 kr tas inte med — de konteras inte. */
async function rader(supabase: SupabaseClient, userId: string, bara?: string[]): Promise<AdminKonteringRad[]> {
  const transaktioner: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('transaktioner')
      .select('id, datum, beskrivning, motpart, belopp, moms, valuta, riktning, kalla, detaljer, bokforing_underlag(file_name)')
      .eq('user_id', userId)
      .is('dublett_av', null)
      .gt('belopp', 0)
      .order('datum', { ascending: true, nullsFirst: false })
      .order('underlag_id')
      .order('radnr')
      .range(from, from + 999);
    if (bara) q = q.in('id', bara);
    const { data, error } = await q;
    if (error) throw new Error(`Kunde inte läsa transaktionerna: ${error.message}`);
    transaktioner.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const ids = transaktioner.map((t) => t.id as string);
  const konteringar = new Map<string, AdminKontering[]>();
  const verifikationer = new Map<string, AdminKonteringRad['verifikation']>();

  for (let i = 0; i < ids.length; i += CHUNK) {
    const del = ids.slice(i, i + CHUNK);
    const [k, v] = await Promise.all([
      supabase.from('konteringar')
        .select('transaktion_id, modell, konto, momssats, motivering, granskning, flaggor, omdome')
        .in('transaktion_id', del),
      supabase.from('verifikationer')
        .select('id, transaktion_id, signatur, verifikation_rader(konto, kontonamn, belopp, radnr)')
        .in('transaktion_id', del),
    ]);
    if (k.error) throw new Error(`Kunde inte läsa konteringarna: ${k.error.message}`);
    if (v.error) throw new Error(`Kunde inte läsa verifikationerna: ${v.error.message}`);

    for (const r of k.data ?? []) {
      const lista = konteringar.get(r.transaktion_id) ?? [];
      lista.push({
        modell: r.modell,
        konto: r.konto,
        kontonamn: r.konto ? slaUppKonto(r.konto)?.namn ?? null : null,
        momssats: r.momssats === null ? null : Number(r.momssats),
        motivering: r.motivering ?? '',
        granskning: r.granskning,
        flaggor: r.flaggor ?? [],
        omdome: r.omdome,
      });
      konteringar.set(r.transaktion_id, lista.sort((a, b) => a.modell.localeCompare(b.modell)));
    }
    for (const r of v.data ?? []) {
      const vr = (r.verifikation_rader ?? []) as { konto: string; kontonamn: string | null; belopp: number; radnr: number }[];
      verifikationer.set(r.transaktion_id, {
        id: r.id,
        signatur: r.signatur,
        rader: [...vr].sort((a, b) => a.radnr - b.radnr).map((x) => ({ konto: x.konto, kontonamn: x.kontonamn, belopp: Number(x.belopp) })),
      });
    }
  }

  return transaktioner.map((t) => {
    const underlag = t.bokforing_underlag as { file_name?: string } | null;
    return {
      id: t.id as string,
      datum: (t.datum as string) ?? '',
      beskrivning: (t.beskrivning as string) ?? '',
      motpart: (t.motpart as string) ?? '',
      belopp: Number(t.belopp),
      moms: t.moms === null ? null : Number(t.moms),
      valuta: (t.valuta as string) || 'SEK',
      riktning: t.riktning as 'in' | 'ut',
      kalla: t.kalla as string,
      fileName: underlag?.file_name ?? null,
      detaljer: (t.detaljer as string) ?? '',
      konteringar: konteringar.get(t.id as string) ?? [],
      verifikation: verifikationer.get(t.id as string) ?? null,
    };
  });
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId saknas' }, { status: 400 });
  try {
    return NextResponse.json({ rader: await rader(getSupabase(), userId) });
  } catch (err) {
    return fel(err);
  }
}

export async function POST(request: NextRequest) {
  const { userId, transaktionId } = await request.json().catch(() => ({}));
  if (!userId || !transaktionId) return NextResponse.json({ error: 'userId och transaktionId behövs' }, { status: 400 });
  try {
    const supabase = getSupabase();
    const [utfall] = await konteraTransaktioner(supabase, userId, [transaktionId]);
    if (utfall?.fel) return fel(utfall.fel, 502);
    const [rad] = await rader(supabase, userId, [transaktionId]);
    return NextResponse.json({ rad: rad ?? null });
  } catch (err) {
    return fel(err);
  }
}

export async function PUT(request: NextRequest) {
  const { userId, transaktionId, konto, momssats, motkonto } = await request.json().catch(() => ({}));
  if (!userId || !transaktionId || !konto) {
    return NextResponse.json({ error: 'userId, transaktionId och konto behövs' }, { status: 400 });
  }
  try {
    const supabase = getSupabase();
    await bokforManuellt(supabase, userId, transaktionId, String(konto).trim(), Number(momssats) || 0, motkonto || undefined);
    const [rad] = await rader(supabase, userId, [transaktionId]);
    return NextResponse.json({ rad: rad ?? null });
  } catch (err) {
    return fel(err, 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { userId, transaktionIds, bara } = await request.json().catch(() => ({})) as {
    userId?: string;
    transaktionIds?: string[];
    /** 'bokforing' tar bara bort verifikationen och låter förslagen ligga kvar. */
    bara?: 'bokforing';
  };
  if (!userId || !Array.isArray(transaktionIds) || transaktionIds.length === 0) {
    return NextResponse.json({ error: 'userId och transaktionIds behövs' }, { status: 400 });
  }
  try {
    const supabase = getSupabase();
    for (let i = 0; i < transaktionIds.length; i += CHUNK) {
      const del = transaktionIds.slice(i, i + CHUNK);
      // Bara AI-konteringens verifikationer — SIE-importen och dagskassorna rörs aldrig härifrån
      const { error } = await supabase
        .from('verifikationer').delete()
        .in('transaktion_id', del).eq('user_id', userId).eq('kalla', 'ai');
      if (error) throw new Error(`Kunde inte ta bort verifikationerna: ${error.message}`);
      if (bara !== 'bokforing') {
        const { error: kFel } = await supabase.from('konteringar').delete().in('transaktion_id', del).eq('user_id', userId);
        if (kFel) throw new Error(`Kunde inte ta bort konteringarna: ${kFel.message}`);
      }
    }
    return NextResponse.json({ rader: await rader(supabase, userId, transaktionIds) });
  } catch (err) {
    return fel(err);
  }
}
