import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { AdminMote, Arende, InlamningKund, MomsPeriod } from '@/lib/admin-types';
import { momsperiod, neperiod, type Deadlineperiod } from '@/lib/deadlines';
import { handelserMellan, type DeadlineGrupp } from '@/lib/kalender';
import { flaggaBokforing } from '@/lib/inlamning-status';

/**
 * Kalendern för ett datumintervall (oftast en månad):
 * - fasta datum, deadlines och planerade utskick (`lib/kalender.ts`)
 * - kundkort per deadline: vilka kunder den gäller, om bokföringen för
 *   perioden finns och om den är inlämnad
 * - öppna ärenden och bokade möten
 *
 * POST { action: 'mote', … } bokar ett möte.
 */

const GRUPP_MOMS: Record<Exclude<DeadlineGrupp, 'ne'>, MomsPeriod> = {
  'moms-manad': 'månadsvis',
  'moms-kvartal': 'kvartalsvis',
  'moms-ar': 'helår',
};

/** Perioden bakom en periodnyckel som "2026-08", "2026-K3" eller "2026". */
function periodFor(grupp: DeadlineGrupp, nyckel: string): Deadlineperiod {
  const ar = Number(nyckel.slice(0, 4));
  if (grupp === 'ne') return neperiod(ar);
  if (grupp === 'moms-ar') return momsperiod('år', ar, 1);
  if (grupp === 'moms-kvartal') return momsperiod('kvartal', ar, Number(nyckel.slice(-1)));
  return momsperiod('månad', ar, Number(nyckel.slice(5, 7)));
}

const giltigt = (d: string | null) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function GET(request: NextRequest) {
  const fran = request.nextUrl.searchParams.get('fran');
  const tom = request.nextUrl.searchParams.get('tom');
  if (!giltigt(fran) || !giltigt(tom)) return NextResponse.json({ error: 'fran och tom krävs (YYYY-MM-DD)' }, { status: 400 });

  try {
    const supabase = createServerClient();
    const idag = new Date().toISOString().slice(0, 10);
    const handelser = handelserMellan(fran!, tom!);

    const [profiler, gjorda, arenden, moten] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, company_name, moms_period'),
      supabase.from('inlamningar').select('id, profile_id, typ, period, inlamnad_at, kvittens_namn'),
      supabase.from('arenden').select('id, titel, beskrivning, datum, status, person_key, person_namn, kalla, created_at, klar_at')
        .eq('status', 'oppen').gte('datum', fran!).lte('datum', tom!),
      supabase.from('meetings').select('id, name, email, phone, date, time, message').gte('date', fran!).lte('date', tom!).order('time'),
    ]);
    const fel = profiler.error ?? gjorda.error ?? arenden.error ?? moten.error;
    if (fel) throw new Error(fel.message);

    // Ett kundkort per kund och deadline. Samma kund kan stå på flera dagar.
    const kortlistor: { nyckel: string; kunder: InlamningKund[] }[] = [];
    for (const h of handelser) {
      if (!h.grupp || !h.period) continue;
      const typ = h.grupp === 'ne' ? 'ne' : 'moms';
      const period = periodFor(h.grupp, h.period);
      const kunder: InlamningKund[] = (profiler.data ?? [])
        .filter((p) => h.grupp === 'ne' || p.moms_period === GRUPP_MOMS[h.grupp as Exclude<DeadlineGrupp, 'ne'>])
        .map((p) => {
          const gjord = (gjorda.data ?? []).find((g) => g.profile_id === p.id && g.typ === typ && g.period === period.period);
          return {
            profileId: p.id,
            email: p.email,
            namn: p.full_name?.trim() || p.company_name?.trim() || p.email || 'Okänd',
            foretag: p.company_name?.trim() || null,
            momsPeriod: p.moms_period as MomsPeriod | null,
            perioder: [{
              ...period,
              forsenad: period.deadline < idag && !gjord,
              inlamning: gjord ? { id: gjord.id, at: gjord.inlamnad_at, kvittensNamn: gjord.kvittens_namn } : null,
              flaggor: [],
            }],
          };
        });
      if (kunder.length) kortlistor.push({ nyckel: `${h.datum}|${h.grupp}`, kunder });
    }
    await flaggaBokforing(supabase, kortlistor.flatMap((k) => k.kunder));

    return NextResponse.json({
      handelser,
      kundkort: Object.fromEntries(kortlistor.map((k) => [k.nyckel, k.kunder])),
      arenden: (arenden.data ?? []).map((r): Arende => ({
        id: r.id, titel: r.titel, beskrivning: r.beskrivning, datum: r.datum, status: r.status,
        personKey: r.person_key, personNamn: r.person_namn, kalla: r.kalla, skapad: r.created_at, klar: r.klar_at,
      })),
      moten: (moten.data ?? []).map((m): AdminMote => ({
        id: m.id, namn: m.name, email: m.email, telefon: m.phone, datum: m.date, tid: m.time, meddelande: m.message,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/kalender]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'mote') return NextResponse.json({ error: "action måste vara 'mote'" }, { status: 400 });

  const namn = String(body.namn ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const tid = String(body.tid ?? '').trim();
  if (!namn || !email.includes('@')) return NextResponse.json({ error: 'Kunden behöver namn och mejladress' }, { status: 400 });
  if (!giltigt(body.datum) || !/^\d{2}:\d{2}$/.test(tid)) return NextResponse.json({ error: 'Datum och tid krävs' }, { status: 400 });

  const { data, error } = await createServerClient().from('meetings').insert({
    name: namn,
    email,
    phone: String(body.telefon ?? '').trim() || null,
    date: body.datum,
    time: tid,
    message: String(body.meddelande ?? '').trim() || null,
    source: 'admin',
  }).select('id, name, email, phone, date, time, message').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mote: AdminMote = { id: data.id, namn: data.name, email: data.email, telefon: data.phone, datum: data.date, tid: data.time, meddelande: data.message };
  return NextResponse.json({ mote });
}
