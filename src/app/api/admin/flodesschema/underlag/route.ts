import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { FlodesKund, FlodesUnderlag } from '@/lib/admin-types';
import { definieraUnderlag } from '@/lib/underlag/definiera';
import { lasUtTransaktioner } from '@/lib/transaktioner/import';
import { kompletteraUnderlag } from '@/lib/transaktioner/komplettera';
import { kollaDubbletter } from '@/lib/transaktioner/dublettkoll';
import { kollaTillrackligt } from '@/lib/transaktioner/tillrackligt';

export const maxDuration = 300;

/**
 * Underlagen att följa genom flödesschemat.
 *
 * GET        → { kunder: FlodesKund[] }, kunderna med sina underlag, nyast först
 * GET ?id=   → { underlag: FlodesUnderlag }, allt som hänt med ett underlag
 * POST { id, steg: 'alla' | 'definiera' | 'plocka-trans' | 'komplettera' | 'dublett' | 'tillrackligt' } → kör steget (alla = från början så långt
 *            flödet är kodat) på underlaget och svarar som GET ?id=
 *
 * Här hämtas bara fakta. Vilket steg i schemat de motsvarar avgörs på sidan,
 * där stegen finns.
 */

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  try {
    return NextResponse.json(id ? { underlag: await ettUnderlag(id) } : { kunder: await allaKunder() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internt fel' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Underlag saknas' }, { status: 400 });
  if (!['alla', 'definiera', 'plocka-trans', 'komplettera', 'dublett', 'tillrackligt'].includes(body.steg)) return NextResponse.json({ error: 'Okänt steg' }, { status: 400 });
  const supabase = createServerClient();
  const alla = body.steg === 'alla';
  try {
    // 'alla' kör de steg som är kodade, i schemats ordning, och stannar där
    // vägen tar slut — övriga filer och verifikationer läses inte ut här
    if (alla || body.steg === 'definiera') {
      const definition = await definieraUnderlag(supabase, body.id);
      if (alla && definition.kategori !== 'transaktioner') return NextResponse.json({ underlag: await ettUnderlag(body.id) });
    }
    if (alla || body.steg === 'plocka-trans') {
      // Felet i avläsningen skrivs på underlaget och syns i spåret
      const res = await lasUtTransaktioner(supabase, body.id);
      if (res.fel) throw new Error(res.fel);
      if (alla && res.typ !== 'transaktioner') return NextResponse.json({ underlag: await ettUnderlag(body.id) });
    }
    if (alla || body.steg === 'komplettera') await kompletteraUnderlag(supabase, body.id);
    if (alla || body.steg === 'dublett') await kollaDubbletter(supabase, body.id);
    if (alla || body.steg === 'tillrackligt') await kollaTillrackligt(supabase, body.id);
  } catch (e) {
    // Felet står på underlaget och syns i spåret, så underlaget skickas med ändå
    const fel = e instanceof Error ? e.message : 'Internt fel';
    const underlag = await ettUnderlag(body.id).catch(() => null);
    return NextResponse.json({ error: fel, underlag }, { status: 500 });
  }
  return NextResponse.json({ underlag: await ettUnderlag(body.id) });
}

async function allaKunder(): Promise<FlodesKund[]> {
  const supabase = createServerClient();
  const { data: rader, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, file_name, created_at, source, sortering')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const userIds = [...new Set((rader ?? []).map((r) => r.user_id).filter(Boolean))];
  const profiler = userIds.length
    ? (await supabase.from('profiles').select('id, email, full_name, company_name').in('id', userIds)).data ?? []
    : [];
  const perId = new Map(profiler.map((p) => [p.id, p]));

  const kunder = new Map<string, FlodesKund>();
  for (const r of rader ?? []) {
    const profil = r.user_id ? perId.get(r.user_id) : undefined;
    const epost = (profil?.email?.trim() || r.sender_email?.trim() || '').toLowerCase();
    const key = epost ? `e:${epost}` : 'okand';
    if (!kunder.has(key)) {
      const namn = profil?.full_name?.trim() || profil?.company_name?.trim() || epost || 'Okänd avsändare';
      kunder.set(key, { key, namn, underlag: [] });
    }
    kunder.get(key)!.underlag.push({ id: r.id, fileName: r.file_name, at: r.created_at, source: r.source ?? 'app', sortering: r.sortering ?? null });
  }
  return [...kunder.values()].sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
}

async function ettUnderlag(id: string): Promise<FlodesUnderlag> {
  const supabase = createServerClient();
  const { data: u, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, file_name, created_at, source, sortering, sortering_orsak, definition, definierad_at, definition_fel, kontroll_status, kontroll_saknas, kontroll_at, transaktioner_utlasta_at, transaktioner_antal, transaktioner_fel, kompletterad_at, komplettering_fel, dublettkollad_at, dublettkoll_fel, tillrackligt_at, tillrackligt_fel, verifikationer_inlagda_at, verifikationer_antal, verifikationer_dubbletter, verifikationer_fel')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!u) throw new Error('Underlaget finns inte');

  const [trans, verif, profil] = await Promise.all([
    supabase.from('transaktioner').select('id, datum, beskrivning, motpart, belopp, moms, valuta, riktning, vat_nummer, anteckning, detaljer, uppgifter, komplettering, dublettkoll, dublett_av, tillrackligt').eq('underlag_id', id).order('radnr'),
    supabase.from('verifikationer').select('transaktion_id').eq('underlag_id', id),
    u.user_id ? supabase.from('profiles').select('email').eq('id', u.user_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const fel = trans.error ?? verif.error;
  if (fel) throw new Error(fel.message);

  const transIds = (trans.data ?? []).map((t) => t.id);
  const { data: konteringar, error: kFel } = transIds.length
    ? await supabase.from('konteringar').select('transaktion_id, konto, momssats, omdome').in('transaktion_id', transIds)
    : { data: [], error: null };
  if (kFel) throw new Error(kFel.message);

  const bokforda = new Set((verif.data ?? []).map((v) => v.transaktion_id).filter(Boolean));
  const epost = (profil.data?.email?.trim() || u.sender_email?.trim() || '').toLowerCase();

  return {
    id: u.id,
    fileName: u.file_name,
    source: u.source ?? 'app',
    at: u.created_at,
    personKey: epost ? `e:${epost}` : null,
    sortering: u.sortering ?? null,
    sorteringOrsak: u.sortering_orsak ?? null,
    definition: u.definition ?? null,
    definieradAt: u.definierad_at ?? null,
    definitionFel: u.definition_fel ?? null,
    kontroll: u.kontroll_status ? { status: u.kontroll_status, saknas: u.kontroll_saknas ?? [], at: u.kontroll_at } : null,
    utlasning: u.transaktioner_utlasta_at ? { at: u.transaktioner_utlasta_at, antal: u.transaktioner_antal ?? 0, fel: u.transaktioner_fel } : null,
    komplettering: u.kompletterad_at ? { at: u.kompletterad_at, fel: u.komplettering_fel } : null,
    dublettkoll: u.dublettkollad_at ? { at: u.dublettkollad_at, fel: u.dublettkoll_fel } : null,
    tillrackligt: u.tillrackligt_at ? { at: u.tillrackligt_at, fel: u.tillrackligt_fel } : null,
    sie: u.verifikationer_inlagda_at ? {
      at: u.verifikationer_inlagda_at,
      antal: u.verifikationer_antal ?? 0,
      dubbletter: u.verifikationer_dubbletter ?? 0,
      fel: u.verifikationer_fel,
    } : null,
    transaktioner: (trans.data ?? []).map((t) => {
      const k = (konteringar ?? []).filter((x) => x.transaktion_id === t.id);
      // Samma regel som konteringen: grönt när båda modellerna är gröna och överens
      const gron = k.length >= 2 && k.every((x) => x.omdome === 'gron' && x.konto === k[0].konto && x.momssats === k[0].momssats);
      return {
        id: t.id,
        datum: t.datum,
        beskrivning: t.beskrivning ?? '',
        motpart: t.motpart ?? '',
        belopp: Number(t.belopp),
        moms: Number(t.moms ?? 0),
        valuta: t.valuta ?? 'SEK',
        riktning: t.riktning === 'in' ? 'in' : 'ut',
        vatNummer: t.vat_nummer ?? '',
        anteckning: t.anteckning ?? '',
        detaljer: t.detaljer ?? '',
        uppgifter: t.uppgifter ?? null,
        komplettering: t.komplettering ?? null,
        dublettkoll: t.dublettkoll ?? null,
        dublettAv: t.dublett_av ?? null,
        tillrackligt: t.tillrackligt ?? null,
        kontering: k.length === 0 ? 'ingen' : gron ? 'gron' : 'granska',
        bokford: bokforda.has(t.id),
      };
    }),
    verifikationer: (verif.data ?? []).length,
  };
}
