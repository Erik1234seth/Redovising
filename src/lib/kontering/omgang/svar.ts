import type { SupabaseClient } from '@supabase/supabase-js';
import { konteringUrBeslut, verifikationsrader, OMVAND_KONTONAMN, type Beslut, type Kontering, type Transaktion } from '../kontera';
import { laddaK1Andringar as laddK1Andringar } from '../k1-andringar';
import { iKronor, raknaOmTillKronor, type Kronor } from '../kronor';
import { slaUppKonto, type Flagga } from '../regelverk';
import type { Svar, SvarTransaktion } from './anrop';
import type { Filpost, Hoppad, Kontext } from './forbered';

/**
 * Svaret från omgången, prövat i kod.
 *
 * Modellen har valt konto och moms. Koden räknar om till kronor, räknar
 * momsen, prövar kontona mot K1 och beloppsgränserna och bygger
 * verifikationsraderna — samma kod som när en transaktion konteras ensam.
 *
 * Grön blir en transaktion när säkerheten är hög, inget saknas, den inte är
 * en möjlig dubblett och inga kontroller slagit till. Allt annat går till
 * Granska.
 *
 * Kontrollerna över hela svaret: varje fil som skickades ska ha fått svar,
 * och hänvisningar till rader och filer ska finnas. Grannsidorna (G1, G2 …)
 * är sammanhang ur delarna bredvid: de får inget svar här, men en sida kan
 * vara del_av en av dem (./forbered).
 */

export interface ResultatTransaktion {
  nr: number;
  datum: string | null;
  beskrivning: string;
  motpart: string;
  belopp: number;
  moms: number;
  valuta: string;
  riktning: 'in' | 'ut';
  vat_nummer: string;
  anteckning: string;
  uppgifter: Record<string, unknown>;
  /** Omräkningen när underlaget är i en annan valuta. */
  kronor: Kronor | null;
  /** refText är dubbletten som byrån ser den — datum, belopp och motpart, eller filens namn. */
  dublett: SvarTransaktion['dublett'] & { transaktionId: string | null; refText: string };
  saknas: SvarTransaktion['saknas'];
  antaganden: string;
  kontering: (Pick<Kontering, 'konto' | 'momssats' | 'momsdelar' | 'omvand' | 'motivering' | 'regler' | 'flaggor' | 'omdome' | 'granskning'> & {
    kontonamn: string;
    sakerhet: 'hog' | 'medel' | 'lag';
    momshantering: string;
  }) | null;
  verifikation: { konto: string; kontonamn: string; belopp: number }[] | null;
  fel: string | null;
  /** Byrån har godkänt en gul kontering som den är. */
  godkand?: { at: string } | null;
  /** Transaktionen i bokföringen, när svaret skrivits dit (./skriv). */
  transaktionId?: string;
}

export interface GammalTransaktion {
  id: string;
  datum: string | null;
  belopp: number;
  valuta: string | null;
  riktning: 'in' | 'ut';
  motpart: string | null;
  beskrivning: string | null;
  dublett: boolean;
  forslag: { modell: string; konto: string | null; momssats: number | null; omdome: string }[];
  vald: string | null;
  bokfort: string[];
}

export interface ResultatFil {
  fil: string;
  underlagId: string;
  namn: string;
  sort: string | null;
  vad: string;
  delAv: string;
  transaktioner: ResultatTransaktion[];
  gammalt: GammalTransaktion[];
  /** Vad som hände med filen när svaret skrevs till bokföringen (./skriv). */
  skrivet?: string;
}

export interface Resultat {
  filer: ResultatFil[];
  anteckningar: string[];
  /** Det som inte stämde med svaret som helhet. */
  kontroller: string[];
  hoppade: Hoppad[];
}

const ore = (n: number) => Math.round(n * 100) / 100;
const kontonamn = (k: string) => slaUppKonto(k)?.namn ?? OMVAND_KONTONAMN[k] ?? '';

/** Fälten modellen lämnade tomma tas bort, så att uppgifterna ser ut som förut. */
function rensaUppgifter(u: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(u ?? {}).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)));
}

/**
 * Kursen slås upp på valutakoden, så ett tecken som "$" eller "€" blir en kod.
 * Ett ensamt dollartecken tolkas som USD — det vanligaste.
 */
function valutakod(v: string | null | undefined): string {
  const s = (v || 'SEK').trim().toUpperCase();
  return ({ $: 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', KR: 'SEK', 'KR.': 'SEK' } as Record<string, string>)[s] ?? s;
}

/** Betal- och momskonton säger inget om vad affären är. */
const BETAL_OCH_MOMS = /^(1930|2013|2017|26\d\d)$/;

/** Det som redan finns för underlagen: transaktionerna, förslagen, valet och bokföringen. */
export async function gamlaKonteringar(supabase: SupabaseClient, underlagIds: string[]): Promise<Map<string, GammalTransaktion[]>> {
  const ut = new Map<string, GammalTransaktion[]>();
  if (!underlagIds.length) return ut;
  const { data: tx } = await supabase.from('transaktioner')
    .select('id, underlag_id, radnr, datum, belopp, valuta, riktning, motpart, beskrivning, dublett_av, vald_kontering')
    .in('underlag_id', underlagIds).order('radnr');
  const ids = (tx ?? []).map((t) => t.id as string);
  const [{ data: forslag }, { data: verif }] = ids.length
    ? await Promise.all([
      supabase.from('konteringar').select('transaktion_id, modell, konto, momssats, omdome').in('transaktion_id', ids),
      supabase.from('verifikationer').select('transaktion_id, verifikation_rader(konto, borttagen)').in('transaktion_id', ids),
    ])
    : [{ data: [] }, { data: [] }];
  for (const t of tx ?? []) {
    const bokfort = (verif ?? []).filter((v) => v.transaktion_id === t.id)
      .flatMap((v) => ((v.verifikation_rader ?? []) as { konto: string; borttagen: boolean }[]).filter((r) => !r.borttagen && !BETAL_OCH_MOMS.test(r.konto)).map((r) => r.konto));
    const rad: GammalTransaktion = {
      id: t.id,
      datum: t.datum,
      belopp: Number(t.belopp),
      valuta: t.valuta,
      riktning: t.riktning,
      motpart: t.motpart,
      beskrivning: t.beskrivning,
      dublett: !!t.dublett_av,
      forslag: (forslag ?? []).filter((k) => k.transaktion_id === t.id).map((k) => ({ modell: k.modell, konto: k.konto, momssats: k.momssats, omdome: k.omdome })),
      vald: (t.vald_kontering as { konto?: string } | null)?.konto ?? null,
      bokfort: [...new Set(bokfort)],
    };
    ut.set(t.underlag_id, [...(ut.get(t.underlag_id) ?? []), rad]);
  }
  return ut;
}

/** En transaktion ur svaret, prövad som om den konterats ensam. */
async function provaTransaktion(
  supabase: SupabaseClient,
  userId: string,
  underlagId: string,
  id: string,
  nr: number,
  s: SvarTransaktion,
  kontext: Kontext,
  finns: (ref: string) => { ok: boolean; transaktionId: string | null },
): Promise<ResultatTransaktion> {
  const uppgifter = rensaUppgifter(s.uppgifter);
  const ref = s.dublett.status === 'unik' ? null : finns(s.dublett.ref.trim().toUpperCase());
  const bas = {
    nr,
    datum: /^\d{4}-\d{2}-\d{2}$/.test(s.datum) ? s.datum : null,
    beskrivning: s.beskrivning,
    motpart: s.motpart,
    belopp: Math.abs(Number(s.belopp) || 0),
    moms: Math.abs(Number(s.moms) || 0),
    valuta: valutakod(s.valuta),
    riktning: s.riktning,
    vat_nummer: s.vat_nummer,
    anteckning: s.anteckning,
    uppgifter,
    dublett: { ...s.dublett, transaktionId: ref?.transaktionId ?? null, refText: '' },
    saknas: s.saknas ?? [],
    antaganden: s.antaganden,
  };

  let t: Transaktion = {
    id,
    user_id: userId,
    customer_email: null,
    underlag_id: underlagId,
    datum: bas.datum,
    beskrivning: bas.beskrivning || null,
    motpart: bas.motpart || null,
    belopp: bas.belopp,
    moms: bas.moms || null,
    valuta: bas.valuta,
    riktning: bas.riktning,
    anteckning: bas.anteckning || null,
    detaljer: null,
    vat_nummer: bas.vat_nummer || null,
    uppgifter,
    komplettering: null,
    // En tveksam dubblett flaggas av konteringen själv
    dublettkoll: s.dublett.status === 'tveksam' ? { status: 'tveksam', motivering: s.dublett.motivering, avFil: s.dublett.ref || null } : null,
    tillrackligt: null,
    kalla: 'underlag',
    kronor: null,
  };

  if (!(bas.belopp > 0)) return { ...bas, kronor: null, kontering: null, verifikation: null, fel: 'Beloppet är 0 — inget att bokföra' };

  try {
    t = await raknaOmTillKronor(supabase, t, { spara: false });
    const iKr = iKronor(t);
    // Modellen gav delarna i underlagets valuta. Är transaktionen omräknad räknas de om med samma kurs.
    const kurs = iKr.valuta === 'SEK' && t.valuta !== 'SEK' && t.kronor ? t.kronor.kurs : 1;
    const beslut: Beslut = {
      analys: '',
      delar: s.kontering.delar.map((d) => ({ ...d, belopp: ore(d.belopp * kurs), moms: d.moms === null ? null : ore(d.moms * kurs) })),
      momshantering: s.kontering.momshantering,
      omvand_typ: s.kontering.omvand_typ,
      sakerhet: s.kontering.sakerhet,
      motivering: s.kontering.motivering,
      regler: s.kontering.regler,
      brutna_regler: s.kontering.brutna_regler,
      granskning_kravs: s.kontering.granskning_kravs,
    };
    const k = konteringUrBeslut(iKr, kontext.betalsatt, beslut, kontext.regelIdn);

    // Det som också hindrar grönt i omgången
    const flaggor: Flagga[] = [...k.flaggor];
    if (s.kontering.sakerhet === 'medel') flaggor.push({ typ: 'osaker', allvar: 'granskning', text: 'Modellens säkerhet: medel.' });
    if (bas.saknas.length) flaggor.push({ typ: 'saknas', allvar: 'granskning', text: `Saknas: ${bas.saknas.map((x) => x.vad).join(', ')}` });
    if (s.dublett.status === 'dublett') flaggor.push({ typ: 'dublett', allvar: 'stopp', text: 'Dubblett — bokförs inte.' });
    if (ref && !ref.ok) flaggor.push({ typ: 'dublett', allvar: 'granskning', text: 'Dubbletten pekar på en rad som inte finns.' });

    let verifikation: ResultatTransaktion['verifikation'] = null;
    let fel: string | null = null;
    if (k.konto) {
      try {
        const rader = verifikationsrader(t, k.konto, k.momssats ?? 0, kontext.betalsatt, undefined, k.momsdelar, k.omvand);
        verifikation = rader.map((r) => ({ konto: r.konto, kontonamn: kontonamn(r.konto), belopp: ore(r.belopp) }));
        const summa = ore(rader.reduce((x, r) => x + r.belopp, 0));
        if (Math.abs(summa) > 0.005) flaggor.push({ typ: 'balans', allvar: 'stopp', text: `Verifikationen går inte jämnt ut (${summa} kr).` });
      } catch (err) {
        fel = `Verifikationen gick inte att bygga: ${err instanceof Error ? err.message : err}`;
        flaggor.push({ typ: 'verifikation', allvar: 'stopp', text: fel });
      }
    }

    const omdome = flaggor.some((f) => f.allvar === 'stopp') ? 'rod' : flaggor.length ? 'gul' : 'gron';
    return {
      ...bas,
      kronor: t.kronor,
      kontering: {
        konto: k.konto,
        kontonamn: k.konto ? kontonamn(k.konto) : '',
        momssats: k.momssats,
        momsdelar: k.momsdelar,
        omvand: k.omvand,
        motivering: k.motivering,
        regler: k.regler,
        granskning: k.granskning,
        flaggor,
        omdome,
        sakerhet: s.kontering.sakerhet,
        momshantering: s.kontering.momshantering,
      },
      verifikation,
      fel,
    };
  } catch (err) {
    return { ...bas, kronor: t.kronor, kontering: null, verifikation: null, fel: err instanceof Error ? err.message : String(err) };
  }
}

/** Tolkar och prövar svaret för en del av omgången. */
export async function provaSvar(
  supabase: SupabaseClient,
  userId: string,
  filer: Filpost[],
  svar: Svar,
  kontext: Kontext,
  hoppade: Hoppad[],
): Promise<Resultat> {
  // Spärrarna i kontoreglerna prövas med byråns ändringar
  await laddK1Andringar(supabase);
  const kontroller: string[] = [];
  // Grannsidorna (G1, G2 …) kan pekas på som sida eller dubblett men får inget eget svar — de läses i sin egen del
  const perFil = new Map(filer.map((f) => [f.fil.toUpperCase(), f]));
  const egna = filer.filter((f) => !f.granne);
  const svarPerFil = new Map<string, Svar['filer'][number]>();
  for (const f of svar.filer ?? []) {
    const nr = String(f.fil ?? '').trim().toUpperCase();
    if (perFil.get(nr)?.granne) continue;
    if (!perFil.has(nr)) { kontroller.push(`Svaret har en fil ${f.fil} som inte skickades.`); continue; }
    if (svarPerFil.has(nr)) { kontroller.push(`${nr} finns två gånger i svaret — den första gäller.`); continue; }
    svarPerFil.set(nr, f);
  }

  const finns = (ref: string) => {
    if (/^K\d+$/.test(ref)) return { ok: ref in kontext.kNummer, transaktionId: kontext.kNummer[ref] ?? null };
    if (/^[FG]\d+$/.test(ref)) return { ok: perFil.has(ref), transaktionId: null };
    if (/^BOK\d+$/.test(ref)) return { ok: ref in (kontext.vNummer ?? {}), transaktionId: null };
    return { ok: false, transaktionId: null };
  };

  const gammalt = await gamlaKonteringar(supabase, egna.map((f) => f.underlagId));
  const resultat: ResultatFil[] = [];
  for (const f of egna) {
    const s = svarPerFil.get(f.fil.toUpperCase());
    if (!s) kontroller.push(`${f.fil} (${f.namn}) fick inget svar — skickas med nästa gång.`);
    const delAv = (s?.del_av ?? '').trim().toUpperCase();
    if (delAv && (!perFil.has(delAv) || delAv === f.fil.toUpperCase())) kontroller.push(`${f.fil} sägs vara en sida av ${s?.del_av}, som inte finns i omgången.`);
    if (s && s.sort !== 'underlag' && s.transaktioner.length) kontroller.push(`${f.fil} är sorterad som ${s.sort} men har transaktioner — de räknas inte.`);
    if (s && delAv && s.transaktioner.length) kontroller.push(`${f.fil} är en sida av ${delAv} men har egna transaktioner — de räknas inte.`);

    const tx = s && s.sort === 'underlag' && !delAv ? s.transaktioner : [];
    const transaktioner = await Promise.all(tx.map((t, i) => provaTransaktion(supabase, userId, f.underlagId, `${f.fil}-${i + 1}`, i + 1, t, kontext, finns)));
    resultat.push({
      fil: f.fil,
      underlagId: f.underlagId,
      namn: f.namn,
      sort: s?.sort ?? null,
      vad: s?.vad ?? '',
      delAv,
      transaktioner,
      gammalt: gammalt.get(f.underlagId) ?? [],
    });
  }
  // Dubbletterna som byrån ser dem: den gamla transaktionen eller filen, inte ett radnummer
  const refIds = [...new Set(resultat.flatMap((f) => f.transaktioner).map((t) => t.dublett.transaktionId).filter((x): x is string => !!x))];
  const { data: refRader } = refIds.length
    ? await supabase.from('transaktioner').select('id, datum, belopp, valuta, motpart, beskrivning').in('id', refIds)
    : { data: [] };
  const refPer = new Map((refRader ?? []).map((r) => [r.id as string, r]));
  for (const t of resultat.flatMap((f) => f.transaktioner)) {
    if (t.dublett.status === 'unik') continue;
    const r = t.dublett.transaktionId ? refPer.get(t.dublett.transaktionId) : null;
    const ref = t.dublett.ref.trim().toUpperCase();
    const fil = perFil.get(ref);
    const verifikation = kontext.vNummer?.[ref];
    t.dublett.refText = r
      ? `${r.datum ?? 'okänt datum'} ${Number(r.belopp)} ${r.valuta || 'SEK'} ${r.motpart || r.beskrivning || ''}`.trim()
      : fil ? `filen ${fil.namn}` : verifikation ? `verifikation ${verifikation}` : 'okänd rad';
  }

  return { filer: resultat, anteckningar: (svar.anteckningar ?? []).filter((a) => String(a).trim()), kontroller, hoppade };
}
