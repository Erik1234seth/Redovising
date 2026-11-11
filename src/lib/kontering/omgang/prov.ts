import type { SupabaseClient } from '@supabase/supabase-js';
import type { Svar } from './anrop';
import { kanSkickas } from './filer';
import { forberedOmgang, type Filpost, type Hoppad, type Kontext } from './forbered';
import { leverantor, type Flodesmodell } from './leverantor';
import { skrivResultat, godkannTransaktion } from './skriv';
import { provaSvar, type Resultat } from './svar';
import { valjKonto } from '../kontera';
import { slaUppKonto } from '../regelverk';

/**
 * Flöde: konteringen sedan 2026-11-07. Omgången körs på valda underlag med
 * GPT-6.1 Sol eller Claude Opus 5.5 (./leverantor). Svaret prövas i kod och
 * skrivs till bokföringen (./skriv) — transaktioner och konteringar — och
 * körningen sparas i `kontering_prov` så att den syns i fliken Flöde.
 *
 * Varje del av omgången är en rad. Svaret hämtas när adminsidan frågar
 * (`uppdateraProv`), och då raderas filerna hos leverantören.
 *
 * Jämförelse (`jamfor_med`): samma underlag körs också med den andra
 * modellen, men det svaret skrivs inte till bokföringen. Det prövas först när
 * huvudkörningen är klar, så att "Förut" i Flöde visar huvudmodellens
 * kontering bredvid. Byrån kan välja jämförelsen i stället (`anvandJamforelse`).
 */

export interface Provrad {
  id: string;
  created_at: string;
  user_id: string;
  korning: string;
  del: number;
  delar: number;
  status: 'forbereder' | 'skickad' | 'tar-emot' | 'klar' | 'fel';
  /** Modellen som körde (./leverantor). */
  modell: string;
  /** Jämförelse med huvudkörningen (dess `korning`): skrivs inte till bokföringen. */
  jamfor_med: string | null;
  underlag_ids: string[];
  filer: Filpost[];
  varningar: Hoppad[];
  /** Svarets id hos leverantören — OpenAI-svaret eller Claudes batch. */
  openai_id: string | null;
  kontext: Kontext | null;
  resultat: unknown;
  usage: Record<string, unknown> | null;
  kostnad_usd: number | null;
  uppskattade_tokens: number | null;
  fel: string | null;
  klar_at: string | null;
}

const STEG = 'flode';

async function raderaFiler(modell: string, filer: Filpost[]) {
  const lev = leverantor(modell);
  await Promise.all(filer.filter((f) => f.fileId).map((f) => lev.raderaFil(f.fileId!).catch((err) =>
    console.error(`[kontering-prov] kunde inte radera ${f.fileId}:`, err instanceof Error ? err.message : err))));
}

/**
 * Underlagen som Kör Flöde tar: de som inte lästs i Flöde, eller där kunden
 * skickat något nytt sedan dess. Inte övriga filer, sidor av ett annat
 * underlag, filer vars verifikationer redan lästs in (SIE, verifikationslistor,
 * Plocka verif) eller filtyper AI:n inte läser. Det Flöde själv bokfört hindrar
 * inte — det ersätts när filen körs om. Med `alla` tas även de som redan körts
 * (Kör om alla).
 */
export async function underlagAttKora(supabase: SupabaseClient, userId: string, alla = false): Promise<string[]> {
  const { data, error } = await supabase.from('bokforing_underlag')
    .select('id, file_name, mime_type, sortering, del_av, flode_at, kund_svar_at, verifikationer_inlagda_at')
    .eq('user_id', userId).limit(5000);
  if (error) throw new Error(`Kunde inte läsa underlagen: ${error.message}`);
  const kandidater = (data ?? []).filter((u) =>
    (!u.sortering || u.sortering === 'underlag')
    && !u.del_av
    && !u.verifikationer_inlagda_at
    && kanSkickas(u)
    && (alla || !u.flode_at || (!!u.kund_svar_at && u.kund_svar_at > u.flode_at)));
  if (!kandidater.length) return [];

  // Verifikationer på filen som inte kommer från en transaktion (SIE, Plocka verif)
  const ids = kandidater.map((u) => u.id);
  const bokforda = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: ver } = await supabase.from('verifikationer').select('underlag_id').in('underlag_id', ids.slice(i, i + 200)).is('transaktion_id', null);
    for (const v of ver ?? []) bokforda.add(v.underlag_id as string);
  }
  return ids.filter((id) => !bokforda.has(id));
}

/**
 * Startar en körning med modellen. Svarar med körningens id när alla delar är
 * skickade. Med `jamforMed` blir det en jämförelse med den körningen.
 */
export async function startaProv(
  supabase: SupabaseClient, userId: string, underlagIds: string[],
  o: { modell: Flodesmodell; korning?: string; jamforMed?: string | null },
): Promise<string> {
  const korning = o.korning ?? crypto.randomUUID();
  const lev = leverantor(o.modell);
  const bas = { modell: lev.modell, jamfor_med: o.jamforMed ?? null };
  const forb = await forberedOmgang(supabase, userId, underlagIds, lev);
  const delar = forb.delar.length;

  // Inget gick att skicka — raden visar varför
  if (!delar) {
    const { error } = await supabase.from('kontering_prov').insert({
      ...bas, user_id: userId, korning, status: 'klar', underlag_ids: underlagIds, varningar: forb.hoppade, kontext: forb.kontext,
      resultat: { filer: [], anteckningar: [], kontroller: ['Inget underlag gick att skicka.'], hoppade: forb.hoppade }, klar_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Kunde inte spara provkörningen: ${error.message}`);
    return korning;
  }

  for (const [i, d] of forb.delar.entries()) {
    const { data: rad, error } = await supabase.from('kontering_prov').insert({
      ...bas,
      user_id: userId,
      korning,
      del: i + 1,
      delar,
      status: 'forbereder',
      // Grannsidorna läses i sina egna delar; filerna står ändå med så att de raderas med delen
      underlag_ids: d.filer.filter((f) => !f.granne).map((f) => f.underlagId),
      filer: d.filer,
      // Filerna som inte skickades står på första delen
      varningar: i === 0 ? forb.hoppade : [],
      kontext: forb.kontext,
      uppskattade_tokens: d.tokens,
    }).select('id').single();
    if (error) {
      await raderaFiler(lev.modell, d.filer);
      throw new Error(`Kunde inte spara provkörningen: ${error.message}`);
    }
    try {
      const id = await lev.skicka(d.kropp);
      await supabase.from('kontering_prov').update({ status: 'skickad', openai_id: id }).eq('id', rad.id);
    } catch (err) {
      await raderaFiler(lev.modell, d.filer);
      await supabase.from('kontering_prov').update({ status: 'fel', fel: err instanceof Error ? err.message : String(err), klar_at: new Date().toISOString() }).eq('id', rad.id);
    }
  }
  return korning;
}

/**
 * Hämtar svaret för en skickad del om det är klart, prövar det och sparar
 * resultatet. Bara en fråga åt gången tar emot samma rad. En jämförelse väntar
 * tills huvudkörningen är klar, och skrivs inte.
 */
export async function uppdateraProv(supabase: SupabaseClient, rad: Provrad): Promise<void> {
  if (rad.status !== 'skickad' || !rad.openai_id) return;
  if (rad.jamfor_med) {
    const { count } = await supabase.from('kontering_prov').select('id', { count: 'exact', head: true })
      .eq('korning', rad.jamfor_med).in('status', ['forbereder', 'skickad', 'tar-emot']);
    if (count) return;
  }
  const lev = leverantor(rad.modell);
  const svar = await lev.hamtaSvar(rad.openai_id);
  if (!svar.klar) return;

  // Ta raden — en annan flik kan fråga samtidigt
  const { data: tagen } = await supabase.from('kontering_prov').update({ status: 'tar-emot' }).eq('id', rad.id).eq('status', 'skickad').select('id');
  if (!tagen?.length) return;

  const kostnad = await lev.logga({ steg: STEG, userId: rad.user_id }, svar);
  // Sökningarna sparas med användningen, så att det syns vad modellen letade efter
  const klar = { usage: { ...svar.usage, webbsokningar: svar.sokningar }, kostnad_usd: kostnad, klar_at: new Date().toISOString() };

  try {
    if (!svar.ok) throw new Error(svar.fel);
    let data: Svar;
    try {
      data = JSON.parse(svar.text) as Svar;
    } catch {
      throw new Error(`Svaret var inte JSON: ${svar.text.slice(0, 200)}`);
    }
    if (!rad.kontext) throw new Error('Körningens kontext saknas');
    const resultat = await provaSvar(supabase, rad.user_id, rad.filer, data, rad.kontext, rad.varningar ?? []);
    if (!rad.jamfor_med) await skrivResultat(supabase, rad.user_id, rad.filer, resultat, svar.modell || lev.modell);
    await supabase.from('kontering_prov').update({ ...klar, status: 'klar', svar: data, resultat }).eq('id', rad.id);
  } catch (err) {
    await supabase.from('kontering_prov').update({ ...klar, status: 'fel', fel: err instanceof Error ? err.message : String(err) }).eq('id', rad.id);
  } finally {
    await raderaFiler(lev.modell, rad.filer);
  }
}

/**
 * Byrån väljer jämförelsen i stället för huvudkörningen: svaret prövas på nytt
 * mot det som nu är bokfört och skrivs, och körningen blir en vanlig körning.
 * Den är nyare än huvudkörningen och ersätter den därför i listan.
 */
export async function anvandJamforelse(supabase: SupabaseClient, userId: string, korning: string): Promise<void> {
  const { data, error } = await supabase.from('kontering_prov').select('id, status, modell, jamfor_med, filer, kontext, varningar, svar')
    .eq('user_id', userId).eq('korning', korning).order('del');
  if (error) throw new Error(`Kunde inte läsa körningen: ${error.message}`);
  const delar = (data ?? []) as (Pick<Provrad, 'id' | 'status' | 'modell' | 'jamfor_med' | 'filer' | 'kontext' | 'varningar'> & { svar: Svar | null })[];
  if (!delar.length) throw new Error('Körningen finns inte');
  if (!delar.some((d) => d.jamfor_med)) throw new Error('Körningen är redan bokförd');
  if (delar.some((d) => d.status !== 'klar' && d.status !== 'fel')) throw new Error('Jämförelsen är inte klar än');
  for (const d of delar) {
    if (d.status === 'klar' && d.svar && d.kontext) {
      const resultat = await provaSvar(supabase, userId, d.filer, d.svar, d.kontext, d.varningar ?? []);
      await skrivResultat(supabase, userId, d.filer, resultat, d.modell);
      const { error: uFel } = await supabase.from('kontering_prov').update({ resultat, jamfor_med: null }).eq('id', d.id);
      if (uFel) throw new Error(`Kunde inte spara körningen: ${uFel.message}`);
    } else {
      await supabase.from('kontering_prov').update({ jamfor_med: null }).eq('id', d.id);
    }
  }
}

/**
 * Byrån godkänner en gul kontering som den är, eller ångrar det. Det blir
 * samma sak som att välja kontot i Kontering, och sparas också på körningen.
 */
export async function godkannProv(
  supabase: SupabaseClient, userId: string, radId: string, fil: string, nr: number, godkand: boolean,
): Promise<void> {
  const { data, error } = await supabase.from('kontering_prov').select('resultat').eq('id', radId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa körningen: ${error.message}`);
  const resultat = data?.resultat as Resultat | null;
  const t = resultat?.filer.find((f) => f.fil === fil)?.transaktioner.find((x) => x.nr === nr);
  if (!resultat || !t) throw new Error('Transaktionen finns inte i körningen');
  if (godkand && t.kontering?.omdome !== 'gul') throw new Error('Bara gula konteringar kan godkännas');
  if (!t.transaktionId) throw new Error('Transaktionen är inte bokförd — välj körningen först');
  await godkannTransaktion(supabase, userId, t, godkand);
  t.godkand = godkand ? { at: new Date().toISOString() } : null;
  const { error: uFel } = await supabase.from('kontering_prov').update({ resultat }).eq('id', radId);
  if (uFel) throw new Error(`Kunde inte spara godkännandet: ${uFel.message}`);
}

/** Det byrån kan ändra på en transaktion i Flöde. */
export interface Redigering {
  datum: string;
  beskrivning: string;
  motpart: string;
  belopp: number;
  konto: string;
  momssats: number;
}

const ore = (n: number) => Math.round(n * 100) / 100;

/** Momssatsen konteringen har: den enda, eller den första delens. */
function konteringensSats(k: Resultat['filer'][number]['transaktioner'][number]['kontering']): number {
  return Number(k?.momssats ?? k?.momsdelar?.[0]?.momssats ?? 0) || 0;
}

/**
 * Byrån ändrar en transaktion i Flöde: datum, förklaring, motpart, belopp,
 * konto och moms. Den bokförs direkt med byråns val, som när kontot väljs i
 * Kontering, och den gamla verifikationen ersätts. Det gamla står i
 * transaktionens anteckning. Byts konto, moms eller belopp blir det en
 * kontering med ett konto och en sats. Körs filen om ersätts ändringen.
 */
export async function redigeraProv(
  supabase: SupabaseClient, userId: string, radId: string, fil: string, nr: number, r: Redigering,
): Promise<void> {
  const { data, error } = await supabase.from('kontering_prov').select('resultat, jamfor_med').eq('id', radId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa körningen: ${error.message}`);
  const resultat = data?.resultat as Resultat | null;
  const t = resultat?.filer.find((f) => f.fil === fil)?.transaktioner.find((x) => x.nr === nr);
  if (!resultat || !t) throw new Error('Transaktionen finns inte i körningen — ladda om sidan');
  if (data?.jamfor_med) throw new Error('En jämförelse är inte bokförd — välj den först');
  if (!t.transaktionId) throw new Error('Transaktionen finns inte i bokföringen');
  if (t.dublett.status === 'dublett') throw new Error('En dubblett bokförs inte');

  const datum = String(r.datum ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Error('Datumet ska skrivas ÅÅÅÅ-MM-DD');
  const belopp = ore(Number(r.belopp));
  if (!(belopp > 0)) throw new Error('Beloppet måste vara större än noll');
  const momssats = Number(r.momssats);
  if (![0, 6, 12, 25].includes(momssats)) throw new Error('Momsen måste vara 0, 6, 12 eller 25 %');
  const konto = String(r.konto ?? '').trim();
  if (!slaUppKonto(konto)) throw new Error(`${konto || 'Kontot'} finns inte bland K1-kontona`);
  const beskrivning = String(r.beskrivning ?? '').trim();
  const motpart = String(r.motpart ?? '').trim();

  const { data: rad, error: tFel } = await supabase.from('transaktioner')
    .select('datum, beskrivning, motpart, belopp, moms, anteckning').eq('id', t.transaktionId).eq('user_id', userId).maybeSingle();
  if (tFel) throw new Error(`Kunde inte läsa transaktionen: ${tFel.message}`);
  if (!rad) throw new Error('Transaktionen finns inte längre i bokföringen — ladda om sidan');

  const k = t.kontering;
  const gammalSats = konteringensSats(k);
  const sammaKontering = k?.konto === konto && gammalSats === momssats;
  const sammaBelopp = Number(rad.belopp) === belopp;
  // Underlagets moms står kvar så länge belopp och sats är desamma, annars räknas den fram
  const moms = sammaKontering && sammaBelopp ? rad.moms : momssats ? ore((belopp * momssats) / (100 + momssats)) : null;
  const momsdelar = sammaKontering && sammaBelopp ? k?.momsdelar ?? null : null;
  const omvand = sammaKontering ? k?.omvand ?? null : null;

  const byten = ([
    ['datum', rad.datum, datum],
    ['förklaring', rad.beskrivning, beskrivning],
    ['motpart', rad.motpart, motpart],
    ['belopp', rad.belopp, belopp],
    ['konto', k?.konto, konto],
    ['moms', k ? `${gammalSats} %` : null, `${momssats} %`],
  ] as [string, unknown, unknown][])
    .filter(([, fore, efter]) => String(fore ?? '') !== String(efter ?? ''))
    .map(([namn, fore, efter]) => `${namn} ${fore || '—'} → ${efter || '—'}`);
  const nu = new Date().toISOString();
  const logg = `${nu.slice(0, 10)}: Ändrat av byrån i Flöde${byten.length ? ` (${byten.join(', ')})` : ''}`;

  const { error: uFel } = await supabase.from('transaktioner').update({
    datum, beskrivning: beskrivning || null, motpart: motpart || null, belopp, moms,
    anteckning: [rad.anteckning, logg].filter(Boolean).join('\n'),
  }).eq('id', t.transaktionId).eq('user_id', userId);
  if (uFel) throw new Error(`Kunde inte spara ändringen: ${uFel.message}`);

  // Bokförs direkt med byråns val; en tidigare verifikation byts ut
  await valjKonto(supabase, userId, t.transaktionId, konto, momssats, undefined, momsdelar, omvand);

  // Körningen visar det som nu är bokfört
  const [{ data: ny }, { data: ver }] = await Promise.all([
    supabase.from('transaktioner').select('kronor').eq('id', t.transaktionId).maybeSingle(),
    supabase.from('verifikationer').select('datum, betalning, verifikation_rader(radnr, konto, kontonamn, belopp, borttagen)')
      .eq('transaktion_id', t.transaktionId).eq('user_id', userId).order('betalning'),
  ]);
  type VerRad = { radnr: number; konto: string; kontonamn: string | null; belopp: number; borttagen: boolean };
  const visa = (rader: VerRad[]) => [...rader].filter((x) => !x.borttagen).sort((a, b) => a.radnr - b.radnr)
    .map((x) => ({ konto: x.konto, kontonamn: x.kontonamn ?? '', belopp: Number(x.belopp) }));
  const vers = (ver ?? []) as { datum: string; betalning: boolean; verifikation_rader: VerRad[] }[];

  Object.assign(t, { datum, beskrivning, motpart, belopp, moms: moms ?? 0, kronor: ny?.kronor ?? null, fel: null, godkand: null, andrad: { at: nu } });
  t.kontering = {
    motivering: '', regler: [], granskning: null, sakerhet: 'hog', momshantering: omvand ? 'omvand' : momssats || momsdelar ? 'svensk' : 'ingen',
    ...(k ?? {}),
    konto, kontonamn: slaUppKonto(konto)?.namn ?? '', momssats, momsdelar, omvand, flaggor: [], omdome: 'gron',
  };
  t.verifikation = vers[0] ? visa(vers[0].verifikation_rader ?? []) : null;
  t.faktura = vers[1] ? { datum: vers[0].datum, betalning: { datum: vers[1].datum, rader: visa(vers[1].verifikation_rader ?? []) } } : null;

  const { error: sFel } = await supabase.from('kontering_prov').update({ resultat }).eq('id', radId);
  if (sFel) throw new Error(`Ändringen bokfördes, men körningen kunde inte uppdateras: ${sFel.message}`);
}

/**
 * Byrån raderar transaktioner som inte ska bokföras. Transaktionen tas bort,
 * och med den konteringarna, verifikationerna, kopplingarna och anteckningarna
 * (on delete cascade). Den försvinner också ur körningen. Körs filen om kommer
 * den tillbaka. Svarar med hur många som raderades.
 */
export async function raderaTransaktioner(
  supabase: SupabaseClient, userId: string, valda: { id: string; fil: string; nr: number }[],
): Promise<number> {
  const radIds = [...new Set(valda.map((v) => v.id))];
  const { data, error } = await supabase.from('kontering_prov').select('id, resultat, jamfor_med').eq('user_id', userId).in('id', radIds);
  if (error) throw new Error(`Kunde inte läsa körningen: ${error.message}`);
  const rader = new Map((data ?? []).map((r) => [r.id as string, r as { id: string; resultat: Resultat | null; jamfor_med: string | null }]));

  const txIds = new Set<string>();
  for (const v of valda) {
    const rad = rader.get(v.id);
    const t = rad?.resultat?.filer.find((f) => f.fil === v.fil)?.transaktioner.find((x) => x.nr === v.nr);
    if (!rad || !t) throw new Error('En av transaktionerna finns inte i körningen — ladda om sidan');
    if (rad.jamfor_med) throw new Error('En jämförelse är inte bokförd — det finns inget att radera');
    if (!t.transaktionId) throw new Error(`${t.datum ?? 'Utan datum'} ${t.belopp} ${t.motpart || t.beskrivning || ''} är ingen egen transaktion i bokföringen och kan inte raderas`.trim());
    txIds.add(t.transaktionId);
  }

  const ids = [...txIds];
  for (let i = 0; i < ids.length; i += 200) {
    const { error: dFel } = await supabase.from('transaktioner').delete().eq('user_id', userId).in('id', ids.slice(i, i + 200));
    if (dFel) throw new Error(`Kunde inte radera transaktionerna: ${dFel.message}`);
  }

  for (const rad of rader.values()) {
    if (!rad.resultat) continue;
    for (const f of rad.resultat.filer) f.transaktioner = f.transaktioner.filter((t) => !t.transaktionId || !txIds.has(t.transaktionId));
    const { error: uFel } = await supabase.from('kontering_prov').update({ resultat: rad.resultat }).eq('id', rad.id);
    if (uFel) throw new Error(`Transaktionerna raderades, men körningen kunde inte uppdateras: ${uFel.message}`);
  }
  return ids.length;
}

/**
 * Tar bort en körning ur listan. En del som inte är klar avbryts hos
 * leverantören. Det som redan skrivits till bokföringen ligger kvar.
 */
export async function raderaProv(supabase: SupabaseClient, userId: string, korning: string): Promise<void> {
  const { data, error } = await supabase.from('kontering_prov').select('id, status, modell, openai_id, filer').eq('user_id', userId).eq('korning', korning);
  if (error) throw new Error(`Kunde inte läsa körningen: ${error.message}`);
  for (const r of (data ?? []) as Pick<Provrad, 'id' | 'status' | 'modell' | 'openai_id' | 'filer'>[]) {
    if (r.status === 'skickad' && r.openai_id) await leverantor(r.modell).avbryt(r.openai_id).catch(() => {});
    if (r.status === 'skickad' || r.status === 'forbereder') await raderaFiler(r.modell, r.filer ?? []);
  }
  const { error: dFel } = await supabase.from('kontering_prov').delete().eq('user_id', userId).eq('korning', korning);
  if (dFel) throw new Error(`Kunde inte ta bort körningen: ${dFel.message}`);
}
