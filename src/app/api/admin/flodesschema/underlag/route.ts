import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { FlodesKund, FlodesUnderlag } from '@/lib/admin-types';
import { definieraUnderlag } from '@/lib/underlag/definiera';
import { lasUtTransaktioner } from '@/lib/transaktioner/import';
import { importSieUnderlag } from '@/lib/sie/import';
import { isSieFile } from '@/lib/sie/parse';
import { kompletteraUnderlag } from '@/lib/transaktioner/komplettera';
import { kollaDubbletter } from '@/lib/transaktioner/dublettkoll';
import { kollaTillrackligt } from '@/lib/transaktioner/tillrackligt';
import { skrivFragemejl } from '@/lib/transaktioner/fragemejl';
import { konteraTransaktioner, valjKonto, type ValdKontering } from '@/lib/kontering/kontera';
import { rensaMomsdelar } from '@/lib/kontering/momsdelar';
import { bokforForfallna, slutligKontering, verifikationFran } from '@/lib/kontering/preliminar';
import { slaUppKonto } from '@/lib/kontering/regelverk';
import { hamtaInstruktioner, reglerFor } from '@/lib/transaktioner/instruktioner';

export const maxDuration = 300;

/**
 * Underlagen att följa genom flödesschemat.
 *
 * GET        → { kunder: FlodesKund[] }, kunderna med sina underlag, nyast först
 * GET ?id=   → { underlag: FlodesUnderlag }, allt som hänt med ett underlag
 * POST { id, steg } → kör ett steg på underlaget och svarar { underlag, ... } som GET ?id=
 *            steg: definiera | plocka-trans | plocka-verif | komplettera | dublett | tillrackligt | konteras | skapa-verif
 *            | skriv-mejl (kundens samlade frågemejl nu, i stället för kl 18; med omkorning: true är det inget fel om inget finns att fråga om)
 *            (skapa-verif med val: { transaktionId, konto, momssats, momsdelar? } bokför en granskad för hand)
 *
 * Varje steg är ett eget anrop, så att vart och ett har hela tidsgränsen på
 * sig. "Skicka in i flödet" på sidan kör dem efter varandra. Konteringen tar
 * ungefär en minut per transaktion och görs några i taget: { steg: 'konteras',
 * fran } konterar dem som inte konterats sedan fran och svarar med kvar.
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

const STEG = ['definiera', 'plocka-trans', 'plocka-verif', 'komplettera', 'dublett', 'tillrackligt', 'skriv-mejl', 'konteras', 'skapa-verif'];
/** Transaktioner per konteringsanrop. Båda modellerna, två pass var, ryms inom tidsgränsen. */
const KONTERA_PER_ANROP = 3;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Underlag saknas' }, { status: 400 });
  if (!STEG.includes(body.steg)) return NextResponse.json({ error: 'Okänt steg' }, { status: 400 });
  const supabase = createServerClient();
  const extra: Record<string, unknown> = {};
  try {
    if (body.steg === 'definiera') extra.kategori = (await definieraUnderlag(supabase, body.id)).kategori;
    if (body.steg === 'plocka-trans') {
      // Felet i avläsningen skrivs på underlaget och syns i spåret
      const res = await lasUtTransaktioner(supabase, body.id);
      if (res.fel) throw new Error(res.fel);
      extra.typ = res.typ;
    }
    if (body.steg === 'plocka-verif') extra.typ = await plockaVerifikationer(supabase, body.id);
    if (body.steg === 'komplettera') await kompletteraUnderlag(supabase, body.id);
    if (body.steg === 'dublett') await kollaDubbletter(supabase, body.id);
    if (body.steg === 'tillrackligt') await kollaTillrackligt(supabase, body.id);
    if (body.steg === 'skriv-mejl') await fragemejl(body.id, body.omkorning === true);
    if (body.steg === 'konteras') extra.kvar = await kontera(body.id, typeof body.fran === 'string' ? body.fran : new Date().toISOString());
    if (body.steg === 'skapa-verif') extra.bokforda = await skapaVerifikationer(body.id, body.val);
  } catch (e) {
    // Felet står på underlaget och syns i spåret, så underlaget skickas med ändå
    const fel = e instanceof Error ? e.message : 'Internt fel';
    const underlag = await ettUnderlag(body.id).catch(() => null);
    return NextResponse.json({ error: fel, underlag }, { status: 500 });
  }
  return NextResponse.json({ underlag: await ettUnderlag(body.id), ...extra });
}

/**
 * Läser in verifikationerna ur ett redan bokfört underlag. SIE-filer tolkas
 * med kod, allt annat (PDF, Excel, CSV, TSV …) läses av AI:n med Definieras
 * svar som utgångsläge. Körs det igen ersätts det som lästes förra gången.
 * Svarar med vad filen blev, ifall AI:n ändå kom fram till något annat.
 */
async function plockaVerifikationer(supabase: ReturnType<typeof createServerClient>, underlagId: string): Promise<string> {
  const { data: u } = await supabase.from('bokforing_underlag').select('file_name').eq('id', underlagId).maybeSingle();
  if (!u) throw new Error('Underlaget finns inte');
  if (isSieFile(u.file_name)) {
    // Importen läser bara filer som inte lästs in. Det filen redan lagt in
    // känns igen och läggs inte in igen.
    await supabase.from('bokforing_underlag').update({ verifikationer_inlagda_at: null }).eq('id', underlagId);
    const res = await importSieUnderlag(supabase, underlagId);
    if (res?.fel) throw new Error(res.fel);
    return 'verifikationer';
  }
  const res = await lasUtTransaktioner(supabase, underlagId);
  if (res.fel) throw new Error(res.fel);
  return res.typ;
}

/** Skriver underlagets kunds frågemejl nu, med alla frågor kunden inte fått än — inte bara det här underlagets. */
async function fragemejl(underlagId: string, omkorning = false) {
  const supabase = createServerClient();
  const { data: u } = await supabase.from('bokforing_underlag').select('user_id').eq('id', underlagId).maybeSingle();
  if (!u?.user_id) throw new Error('Underlaget hör inte till någon kund');
  // Vid omkörning efter en instruktion är det bra om inget finns kvar att fråga om
  if (!(await skrivFragemejl(supabase, u.user_id)) && !omkorning) throw new Error('Inget att fråga om — allt är redan frågat, eller inget saknas');
}

/**
 * Konterar nästa omgång av underlagets transaktioner med båda modellerna och
 * sparar konteringarna — preliminärt. Gröna, båda modellerna säkra och överens
 * om konto och moms, blir verifikationer om 14 dagar; resten väntar på Granska.
 * Dubbletter och de som saknar uppgifter konteras inte. Svarar med hur många
 * som är kvar.
 */
async function kontera(underlagId: string, fran: string): Promise<number> {
  const supabase = createServerClient();
  const { data: u } = await supabase.from('bokforing_underlag').select('user_id').eq('id', underlagId).maybeSingle();
  if (!u?.user_id) throw new Error('Underlaget hör inte till ett kundkonto — det går inte att kontera');

  const { data: trans, error } = await supabase.from('transaktioner')
    .select('id, belopp, dublett_av, dublett_orsak, tillrackligt').eq('underlag_id', underlagId).order('radnr');
  if (error) throw new Error(error.message);
  const ids = (trans ?? []).map((t) => t.id);
  if (!ids.length) throw new Error('Underlaget har inga transaktioner att kontera');
  const [{ data: k }, { data: v }] = await Promise.all([
    supabase.from('konteringar').select('transaktion_id, created_at').in('transaktion_id', ids),
    supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', ids),
  ]);
  const bokforda = new Set((v ?? []).map((x) => x.transaktion_id));
  const konteradSedan = new Set((k ?? []).filter((x) => x.created_at >= fran).map((x) => x.transaktion_id));

  const att = (trans ?? []).filter((t) => !t.dublett_av && !t.dublett_orsak && Number(t.belopp) > 0
    && (t.tillrackligt as { status?: string } | null)?.status !== 'saknar' && !bokforda.has(t.id));
  const kvar = att.filter((t) => !konteradSedan.has(t.id));
  if (!kvar.length) return 0;

  const omgang = kvar.slice(0, KONTERA_PER_ANROP).map((t) => t.id);
  const utfall = await konteraTransaktioner(supabase, u.user_id, omgang);
  const fel = utfall.filter((x) => x.fel);
  // Går ingen i omgången att kontera stannar körningen här — annars försöker
  // sidan med samma transaktioner igen och igen
  if (fel.length === omgang.length) throw new Error(fel.map((x) => x.fel).join('; '));
  return kvar.length - omgang.length + fel.length;
}

/**
 * Steget "Skapa verifikationer".
 *
 * Med val sparas kontot och momsen Erik valt för en granskad transaktion —
 * preliminärt, som modellernas konteringar. Utan val blir underlagets klara
 * konteringar verifikationer direkt, i stället för om 14 dagar (se
 * `@/lib/kontering/preliminar`). Det som redan är bokfört rörs inte, och
 * dubbletter bokförs aldrig. Svarar med hur många som bokfördes.
 */
async function skapaVerifikationer(underlagId: string, val: unknown): Promise<number> {
  const supabase = createServerClient();
  const { data: u } = await supabase.from('bokforing_underlag').select('user_id').eq('id', underlagId).maybeSingle();
  if (!u?.user_id) throw new Error('Underlaget hör inte till ett kundkonto — det går inte att bokföra');

  if (val && typeof val === 'object') {
    const v = val as { transaktionId?: unknown; konto?: unknown; momssats?: unknown; momsdelar?: unknown };
    if (typeof v.transaktionId !== 'string' || typeof v.konto !== 'string') throw new Error('Välj transaktion och konto');
    const { data: t } = await supabase.from('transaktioner').select('underlag_id, dublett_av').eq('id', v.transaktionId).maybeSingle();
    if (t?.underlag_id !== underlagId) throw new Error('Transaktionen hör inte till underlaget');
    if (t.dublett_av) throw new Error('Transaktionen är markerad som dublett och bokförs inte');
    // Valet är preliminärt och blir verifikation om 14 dagar, som allt annat
    await valjKonto(supabase, u.user_id, v.transaktionId, v.konto.trim(), Number(v.momssats ?? 0), undefined, rensaMomsdelar(v.momsdelar));
    return 0;
  }

  // Knappen: allt som är klart blir verifikation nu, utan att vänta 14 dagar
  const { bokforda, fel } = await bokforForfallna(supabase, { underlagId, nu: true });
  if (fel.length) throw new Error(`${bokforda} bokförda, ${fel.length} gick inte: ${fel.join('; ')}`);
  return bokforda;
}

async function allaKunder(): Promise<FlodesKund[]> {
  const supabase = createServerClient();
  const { data: rader, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, file_name, created_at, source, sortering, del_av, sidor_saknas, sida:definition->sida, antal_sidor:definition->antalSidor')
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
    // Sidor i ett dokument märks, så att det syns vilka som hör ihop
    const sidor = r.antal_sidor
      ? r.sidor_saknas?.length
        ? `sida ${r.sida}/${r.antal_sidor}, väntar på sida ${r.sidor_saknas.join(', ')}`
        : `sida ${r.sida}/${r.antal_sidor}${r.del_av ? ', läses med första sidan' : ''}`
      : null;
    kunder.get(key)!.underlag.push({ id: r.id, fileName: r.file_name, at: r.created_at, source: r.source ?? 'app', sortering: r.sortering ?? null, sidor });
  }
  return [...kunder.values()].sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
}

async function ettUnderlag(id: string): Promise<FlodesUnderlag> {
  const supabase = createServerClient();
  const { data: u, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, file_name, created_at, source, sortering, sortering_orsak, definition, definierad_at, definition_fel, del_av, sidor_saknas,kontroll_status, kontroll_saknas, kontroll_at, transaktioner_utlasta_at, transaktioner_antal, transaktioner_fel, kompletterad_at, komplettering_fel, dublettkollad_at, dublettkoll_fel, tillrackligt_at, tillrackligt_fel, verifikationer_inlagda_at, verifikationer_antal, verifikationer_dubbletter, verifikationer_fel')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!u) throw new Error('Underlaget finns inte');

  const [trans, verif, profil] = await Promise.all([
    supabase.from('transaktioner').select('id, datum, beskrivning, motpart, belopp, moms, valuta, riktning, vat_nummer, anteckning, detaljer, uppgifter, komplettering, dublettkoll, dublett_av, tillrackligt, fraga_utkast_id, vald_kontering, preliminar_at').eq('underlag_id', id).order('radnr'),
    supabase.from('verifikationer').select('id, transaktion_id, serie, nummer, datum, signatur, verifikation_rader(radnr, konto, kontonamn, belopp, borttagen)').eq('underlag_id', id),
    u.user_id ? supabase.from('profiles').select('email').eq('id', u.user_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const fel = trans.error ?? verif.error;
  if (fel) throw new Error(fel.message);

  const transIds = (trans.data ?? []).map((t) => t.id);
  const { data: konteringar, error: kFel } = transIds.length
    ? await supabase.from('konteringar').select('transaktion_id, modell, konto, momssats, momsdelar, omdome, motivering, regler, granskning, flaggor').in('transaktion_id', transIds)
    : { data: [], error: null };
  if (kFel) throw new Error(kFel.message);

  // Frågemejlet: det senaste utkastet som underlagets transaktioner frågats om i
  const utkastIds = [...new Set((trans.data ?? []).map((t) => t.fraga_utkast_id).filter(Boolean))];
  const { data: utkast } = utkastIds.length
    ? await supabase.from('mejl_utkast').select('id, status, till_email, amne, text, created_at, sent_at').in('id', utkastIds)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  // Byråns kontext och regler: alla steg, men bara det som gäller det här underlaget
  const transIdSet = new Set(transIds);
  const instruktioner = (await hamtaInstruktioner(supabase, { userId: u.user_id, underlagIds: [id] }))
    .filter((i) => i.omfang === 'alla' || i.omfang === 'kund' || i.underlag_id === id || (i.transaktion_id && transIdSet.has(i.transaktion_id)));
  const regelnamn = new Map(reglerFor(instruktioner, u.user_id).map((r) => [r.id, r.namn]));

  // Ett dokument i flera sidor: huvudunderlaget och de andra sidorna
  const { data: dokument } = u.definition?.antalSidor
    ? await supabase.from('bokforing_underlag').select('id, file_name, created_at, definition, sidor_fraga_utkast_id')
      .or(`id.eq.${u.del_av ?? u.id},del_av.eq.${u.del_av ?? u.id}`)
    : { data: null };
  const huvudRad = (dokument ?? []).find((d) => d.id === (u.del_av ?? u.id));
  const { data: fraga } = huvudRad?.sidor_fraga_utkast_id
    ? await supabase.from('mejl_utkast').select('created_at').eq('id', huvudRad.sidor_fraga_utkast_id).maybeSingle()
    : { data: null };
  const sidor: FlodesUnderlag['sidor'] = u.definition?.antalSidor ? {
    sida: u.definition.sida ?? null,
    antal: u.definition.antalSidor,
    saknas: u.sidor_saknas ?? [],
    huvud: u.del_av ? huvudRad?.file_name ?? null : null,
    huvudId: u.del_av ?? null,
    delar: (dokument ?? []).map((d) => ({
      id: d.id, fileName: d.file_name, at: d.created_at, sida: d.definition?.sida ?? null,
      dokumentnummer: d.definition?.dokumentnummer ?? null, datum: d.definition?.datum ?? null, motpart: d.definition?.motpart ?? null,
    })).sort((a, b) => (a.sida ?? 0) - (b.sida ?? 0)),
    fragadAt: fraga?.created_at ?? null,
  } : null;

  const bokforda = new Set((verif.data ?? []).map((v) => v.transaktion_id).filter(Boolean));
  const epost =(profil.data?.email?.trim() || u.sender_email?.trim() || '').toLowerCase();

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
    sidor,
    kontroll: u.kontroll_status ? { status: u.kontroll_status, saknas: u.kontroll_saknas ?? [], at: u.kontroll_at } : null,
    utlasning: u.transaktioner_utlasta_at ? { at: u.transaktioner_utlasta_at, antal: u.transaktioner_antal ?? 0, fel: u.transaktioner_fel } : null,
    komplettering: u.kompletterad_at ? { at: u.kompletterad_at, fel: u.komplettering_fel } : null,
    dublettkoll: u.dublettkollad_at ? { at: u.dublettkollad_at, fel: u.dublettkoll_fel } : null,
    tillrackligt: u.tillrackligt_at ? { at: u.tillrackligt_at, fel: u.tillrackligt_fel } : null,
    mejl: utkast ? {
      id: utkast.id, status: utkast.status, till: utkast.till_email, amne: utkast.amne,
      text: utkast.text, at: utkast.created_at, skickat: utkast.sent_at,
      antal: (trans.data ?? []).filter((t) => t.fraga_utkast_id === utkast.id).length,
    } : null,
    sie: u.verifikationer_inlagda_at ? {
      at: u.verifikationer_inlagda_at,
      antal: u.verifikationer_antal ?? 0,
      dubbletter: u.verifikationer_dubbletter ?? 0,
      fel: u.verifikationer_fel,
    } : null,
    transaktioner: (trans.data ?? []).map((t) => {
      const k = (konteringar ?? []).filter((x) => x.transaktion_id === t.id);
      // Samma regel som när den blir verifikation: byråns val, eller båda modellerna gröna och överens
      const vald = t.vald_kontering as ValdKontering | null;
      const slutlig = slutligKontering(vald, k);
      const gron = !!slutlig;
      return {
        vald: vald ? { konto: vald.konto, momssats: Number(vald.momssats) || 0, momsdelar: rensaMomsdelar(vald.momsdelar) } : null,
        verifikationFran: slutlig && !bokforda.has(t.id) ? verifikationFran(t.preliminar_at) : null,
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
        kontering: gron ? 'gron' : k.length === 0 ? 'ingen' : 'granska',
        bokford: bokforda.has(t.id),
        forslag: k.map((x) => ({ modell: x.modell, konto: x.konto, kontonamn: x.konto ? slaUppKonto(x.konto)?.namn ?? null : null, momssats: Number(x.momssats ?? 0), momsdelar: rensaMomsdelar(x.momsdelar), omdome: x.omdome, motivering: x.motivering ?? '', granskning: x.granskning ?? null, flaggor: x.flaggor ?? [], regler: (Array.isArray(x.regler) ? x.regler as string[] : []).map((r) => regelnamn.get(r) ?? 'Borttagen regel') })),
        verifikation: (() => {
          const v = (verif.data ?? []).find((x) => x.transaktion_id === t.id);
          if (!v) return null;
          const rader = ((v.verifikation_rader ?? []) as { radnr: number; konto: string; kontonamn: string | null; belopp: number; borttagen: boolean }[])
            .filter((r) => !r.borttagen).sort((a, b) => a.radnr - b.radnr)
            .map((r) => ({ konto: r.konto, kontonamn: r.kontonamn, belopp: Number(r.belopp) }));
          return { id: v.id, datum: v.datum, signatur: v.signatur ?? '', rader };
        })(),
      };
    }),
    verifikationer: (verif.data ?? []).length,
    instruktioner: instruktioner.map((i) => ({
      id: i.id, typ: i.typ, omfang: i.omfang, steg: i.steg, transaktionId: i.transaktion_id,
      namn: i.namn, galler: i.galler, text: i.text, at: i.created_at,
    })),
  };
}
