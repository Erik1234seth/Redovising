import type { SupabaseClient } from '@supabase/supabase-js';
import { kostnadOpenAI, loggaOpenAI } from '@/lib/ai-logg';
import { MODELL, type Svar } from './anrop';
import { forberedOmgang, type Filpost, type Hoppad, type Kontext } from './forbered';
import { avbryt, hamtaSvar, raderaFil, skickaIBakgrunden } from './openai';
import { skrivResultat, godkannTransaktion } from './skriv';
import { provaSvar, type Resultat } from './svar';

/**
 * Flöde: konteringen sedan 2026-11-07. Omgången körs på valda underlag i
 * bakgrundsläget (fullpris, svar på några minuter). Svaret prövas i kod och
 * skrivs till bokföringen (./skriv) — transaktioner och konteringar — och
 * körningen sparas i `kontering_prov` så att den syns i fliken Flöde.
 *
 * Varje del av omgången är en rad. Svaret hämtas när adminsidan frågar
 * (`uppdateraProv`), och då raderas filerna hos OpenAI.
 */

export interface Provrad {
  id: string;
  created_at: string;
  user_id: string;
  korning: string;
  del: number;
  delar: number;
  status: 'forbereder' | 'skickad' | 'tar-emot' | 'klar' | 'fel';
  underlag_ids: string[];
  filer: Filpost[];
  varningar: Hoppad[];
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

async function raderaFiler(filer: Filpost[]) {
  await Promise.all(filer.filter((f) => f.fileId).map((f) => raderaFil(f.fileId!).catch((err) =>
    console.error(`[kontering-prov] kunde inte radera ${f.fileId}:`, err instanceof Error ? err.message : err))));
}

/** Startar en provkörning. Svarar med körningens id när alla delar är skickade. */
export async function startaProv(supabase: SupabaseClient, userId: string, underlagIds: string[]): Promise<string> {
  const korning = crypto.randomUUID();
  const forb = await forberedOmgang(supabase, userId, underlagIds);
  const delar = forb.delar.length;

  // Inget gick att skicka — raden visar varför
  if (!delar) {
    const { error } = await supabase.from('kontering_prov').insert({
      user_id: userId, korning, status: 'klar', underlag_ids: underlagIds, varningar: forb.hoppade, kontext: forb.kontext,
      resultat: { filer: [], anteckningar: [], kontroller: ['Inget underlag gick att skicka.'], hoppade: forb.hoppade }, klar_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Kunde inte spara provkörningen: ${error.message}`);
    return korning;
  }

  for (const [i, d] of forb.delar.entries()) {
    const { data: rad, error } = await supabase.from('kontering_prov').insert({
      user_id: userId,
      korning,
      del: i + 1,
      delar,
      status: 'forbereder',
      underlag_ids: d.filer.map((f) => f.underlagId),
      filer: d.filer,
      // Filerna som inte skickades står på första delen
      varningar: i === 0 ? forb.hoppade : [],
      kontext: forb.kontext,
      uppskattade_tokens: d.tokens,
    }).select('id').single();
    if (error) {
      await raderaFiler(d.filer);
      throw new Error(`Kunde inte spara provkörningen: ${error.message}`);
    }
    try {
      const openaiId = await skickaIBakgrunden(d.kropp);
      await supabase.from('kontering_prov').update({ status: 'skickad', openai_id: openaiId }).eq('id', rad.id);
    } catch (err) {
      await raderaFiler(d.filer);
      await supabase.from('kontering_prov').update({ status: 'fel', fel: err instanceof Error ? err.message : String(err), klar_at: new Date().toISOString() }).eq('id', rad.id);
    }
  }
  return korning;
}

/**
 * Hämtar svaret för en skickad del om det är klart, prövar det och sparar
 * resultatet. Bara en fråga åt gången tar emot samma rad.
 */
export async function uppdateraProv(supabase: SupabaseClient, rad: Provrad): Promise<void> {
  if (rad.status !== 'skickad' || !rad.openai_id) return;
  const svar = await hamtaSvar(rad.openai_id);
  if (!svar.klar) return;

  // Ta raden — en annan flik kan fråga samtidigt
  const { data: tagen } = await supabase.from('kontering_prov').update({ status: 'tar-emot' }).eq('id', rad.id).eq('status', 'skickad').select('id');
  if (!tagen?.length) return;

  await loggaOpenAI({ steg: STEG, userId: rad.user_id }, svar.modell || MODELL, svar.usage);
  const kostnad = kostnadOpenAI(svar.modell || MODELL, svar.usage);
  const klar = { usage: svar.usage, kostnad_usd: kostnad, klar_at: new Date().toISOString() };

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
    await skrivResultat(supabase, rad.user_id, rad.filer, resultat);
    await supabase.from('kontering_prov').update({ ...klar, status: 'klar', svar: data, resultat }).eq('id', rad.id);
  } catch (err) {
    await supabase.from('kontering_prov').update({ ...klar, status: 'fel', fel: err instanceof Error ? err.message : String(err) }).eq('id', rad.id);
  } finally {
    await raderaFiler(rad.filer);
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
  await godkannTransaktion(supabase, userId, t, godkand);
  t.godkand = godkand ? { at: new Date().toISOString() } : null;
  const { error: uFel } = await supabase.from('kontering_prov').update({ resultat }).eq('id', radId);
  if (uFel) throw new Error(`Kunde inte spara godkännandet: ${uFel.message}`);
}

/**
 * Tar bort en körning ur listan. En del som inte är klar avbryts hos OpenAI.
 * Det som redan skrivits till bokföringen ligger kvar.
 */
export async function raderaProv(supabase: SupabaseClient, userId: string, korning: string): Promise<void> {
  const { data, error } = await supabase.from('kontering_prov').select('id, status, openai_id, filer').eq('user_id', userId).eq('korning', korning);
  if (error) throw new Error(`Kunde inte läsa körningen: ${error.message}`);
  for (const r of (data ?? []) as Pick<Provrad, 'id' | 'status' | 'openai_id' | 'filer'>[]) {
    if (r.status === 'skickad' && r.openai_id) await avbryt(r.openai_id).catch(() => {});
    if (r.status === 'skickad' || r.status === 'forbereder') await raderaFiler(r.filer ?? []);
  }
  const { error: dFel } = await supabase.from('kontering_prov').delete().eq('user_id', userId).eq('korning', korning);
  if (dFel) throw new Error(`Kunde inte ta bort körningen: ${dFel.message}`);
}
