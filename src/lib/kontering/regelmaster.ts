import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import { K1_REGELMASTER, type Parameter, type Regel, type Regelmaster } from './regelverk';
import { loggaHistorik, type Variant } from './k1-andringar';

/**
 * Regelmastern består av två delar som laddas ner och importeras var för sig
 * på fliken Regler:
 *
 *   - Gränsvärdena (parametrarna: prisbasbelopp, momssatser, schabloner …) är
 *     GEMENSAMMA för löpande bokföring och bokslut. En rad i `gransvarden`;
 *     utan rad gäller k1.json. Filen är xlsx med fliken Gränsvärden (kolumnen
 *     value_id först) eller JSON med listan `parametrar`.
 *   - Reglerna (rule_id: vilket värde, vilken jämförelse, vilka konton) är per
 *     kontoplan, i `kontoplan_regelmaster` (kolumnen parametrar används inte
 *     längre). Utan rad gäller k1.json. Filen är xlsx med en tabell som börjar
 *     med rule_id eller JSON med listan `regler`.
 *
 * En import ersätter allt i sin del: det som saknas i filen slutar gälla. Varje
 * ändrad, ny och borttagen regel och parameter skrivs till `kontoplan_historik`
 * (konto null, data.slag 'regel' eller 'parameter' — parametrar har ett eget
 * fält typ). Gränsvärdena loggas i båda kontoplanernas historik.
 */

const VARIANTER: Variant[] = ['lopande', 'bokslut'];

export interface Gransvarden { kalla: string; parametrar: Parameter[]; updatedAt: string | null }

export async function hamtaGransvarden(supabase: SupabaseClient): Promise<Gransvarden> {
  const { data, error } = await supabase.from('gransvarden').select('kalla, parametrar, updated_at').maybeSingle();
  if (error) throw new Error(`Kunde inte läsa gränsvärdena: ${error.message}`);
  if (!data) return { kalla: K1_REGELMASTER.kalla, parametrar: K1_REGELMASTER.parametrar, updatedAt: null };
  return { kalla: data.kalla, parametrar: data.parametrar as Parameter[], updatedAt: data.updated_at };
}

async function hamtaRegler(supabase: SupabaseClient, variant: Variant): Promise<{ kalla: string; regler: Regel[]; updatedAt: string | null }> {
  const { data, error } = await supabase.from('kontoplan_regelmaster')
    .select('kalla, regler, updated_at').eq('variant', variant).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa regelmasterns regler: ${error.message}`);
  if (!data) return { kalla: K1_REGELMASTER.kalla, regler: K1_REGELMASTER.regler, updatedAt: null };
  return { kalla: data.kalla, regler: data.regler as Regel[], updatedAt: data.updated_at };
}

export interface SparadRegelmaster extends Regelmaster {
  /** När reglerna importerades — `kalla` är reglernas fil. */
  updatedAt: string | null;
  gransvarden: { kalla: string; updatedAt: string | null };
}

/** Kontoplanens regler med de gemensamma gränsvärdena — det konteringen och fliken Regler använder. */
export async function hamtaRegelmaster(supabase: SupabaseClient, variant: Variant): Promise<SparadRegelmaster> {
  const [gv, r] = await Promise.all([hamtaGransvarden(supabase), hamtaRegler(supabase, variant)]);
  return {
    kalla: r.kalla, regler: r.regler, updatedAt: r.updatedAt,
    parametrar: gv.parametrar, gransvarden: { kalla: gv.kalla, updatedAt: gv.updatedAt },
  };
}

const text = (v: unknown) => String(v ?? '').trim();
const lista = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split('|')).map(text).filter(Boolean);
const tal = (v: unknown) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** Excel lagrar datum som serienummer; 25569 är 1970-01-01. Nedladdningen skriver 2026-01-01. */
const datum = (v: unknown) => {
  if (/^\d{4}-\d{2}-\d{2}/.test(text(v))) return text(v).slice(0, 10);
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n) || n < 1000) return null;
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
};

function parameter(p: Record<string, unknown>): Parameter {
  return {
    id: text(p.id), namn: text(p.namn), varde: tal(p.varde) ?? text(p.varde), enhet: text(p.enhet),
    basParameter: text(p.basParameter) || null, multiplikator: tal(p.multiplikator),
    gallerFran: datum(p.gallerFran), gallerTill: datum(p.gallerTill), typ: text(p.typ),
    senastKontrollerad: datum(p.senastKontrollerad), version: text(p.version),
  };
}

function regel(r: Record<string, unknown>): Regel {
  return {
    id: text(r.id), namn: text(r.namn), parameterId: text(r.parameterId), operator: text(r.operator),
    omfattning: text(r.omfattning), moms: text(r.moms), gallerFran: datum(r.gallerFran), gallerTill: datum(r.gallerTill),
    konton: lista(r.konton), anteckning: text(r.anteckning), version: text(r.version),
  };
}

function lasJson(data: Buffer): Record<string, unknown> {
  try {
    return JSON.parse(data.toString('utf8'));
  } catch {
    throw new Error('Filen är inte giltig JSON');
  }
}

type Rader = unknown[][];
const rader = (ark: XLSX.WorkSheet): Rader => XLSX.utils.sheet_to_json<unknown[]>(ark, { header: 1, blankrows: false, defval: '' });
const objekt = (rubriker: unknown[], rad: unknown[]) => Object.fromEntries(rubriker.map((k, i) => [text(k), rad[i] ?? '']));
const aktiv = (o: Record<string, unknown>) => !text(o.status) || text(o.status) === 'active';

/** En tabell i arket: rubrikraden som börjar med `forsta`, och raderna under den fram till nästa rubrikrad. */
function tabell(gv: Rader, forsta: string, nastaRubrik: string): Record<string, unknown>[] | null {
  const start = gv.findIndex((r) => text(r[0]) === forsta);
  if (start === -1) return null;
  const slut = gv.findIndex((r, i) => i > start && text(r[0]) === nastaRubrik);
  return gv.slice(start + 1, slut === -1 ? undefined : slut).filter((r) => text(r[0])).map((r) => objekt(gv[start], r)).filter(aktiv);
}

/**
 * Läser gränsvärdena ur filen: xlsx med fliken Gränsvärden (eller ett ark som
 * börjar med value_id) eller JSON med listan `parametrar`. En gammal fil med
 * regeltabellen under värdena går också — reglerna där läses inte.
 */
export function lasGransvardenFil(data: Buffer, filnamn: string): Parameter[] {
  if (/\.json$/i.test(filnamn)) {
    const json = lasJson(data);
    const p = Array.isArray(json) ? json : json.parametrar;
    if (!Array.isArray(p)) throw new Error('JSON-filen saknar listan "parametrar" (samma form som nedladdningen)');
    return p.map(parameter);
  }
  const wb = XLSX.read(data, { type: 'buffer' });
  const namn = wb.SheetNames.find((n) => n === 'Gränsvärden')
    ?? wb.SheetNames.find((n) => text(rader(wb.Sheets[n])[0]?.[0]) === 'value_id');
  if (!namn) throw new Error('Hittar inte gränsvärdena: filen ska ha fliken Gränsvärden med kolumnen value_id först');
  const p = tabell(rader(wb.Sheets[namn]), 'value_id', 'rule_id');
  if (!p) throw new Error(`Fliken ${namn} saknar rubriken value_id`);
  return p.map((x) => parameter({
    id: x.value_id, namn: x.parameter_name, varde: x.value, enhet: x.unit, basParameter: x.base_parameter_id,
    multiplikator: x.multiplier, gallerFran: x.valid_from, gallerTill: x.valid_to, typ: x.parameter_type,
    senastKontrollerad: x.last_verified_at, version: x.version,
  }));
}

/** Läser regelmasterns regler ur filen: xlsx med en tabell som börjar med rule_id, eller JSON med listan `regler`. */
export function lasReglerFil(data: Buffer, filnamn: string): Regel[] {
  if (/\.json$/i.test(filnamn)) {
    const json = lasJson(data);
    const r = Array.isArray(json) ? json : json.regler;
    if (!Array.isArray(r)) throw new Error('JSON-filen saknar listan "regler" (samma form som nedladdningen)');
    return r.map(regel);
  }
  const wb = XLSX.read(data, { type: 'buffer' });
  for (const namn of wb.SheetNames) {
    const g = tabell(rader(wb.Sheets[namn]), 'rule_id', 'value_id');
    if (g) {
      return g.map((x) => regel({
        id: x.rule_id, namn: x.rule_name, parameterId: x.value_id, operator: x.comparison_operator,
        omfattning: x.aggregation_scope, moms: x.vat_treatment, gallerFran: x.valid_from, gallerTill: x.valid_to,
        konton: x.applies_to_accounts, anteckning: x.rule_notes, version: x.version,
      }));
    }
  }
  throw new Error('Hittar inga regler: filen ska ha en tabell som börjar med kolumnen rule_id');
}

const PARAMETERFALT: Record<string, string> = {
  namn: 'Namn', varde: 'Värde', enhet: 'Enhet', basParameter: 'Baseras på', multiplikator: 'Multiplikator',
  gallerFran: 'Gäller från', gallerTill: 'Gäller till', typ: 'Typ', senastKontrollerad: 'Kontrollerat', version: 'Version',
};
const REGELFALT: Record<string, string> = {
  namn: 'Namn', parameterId: 'Värde', operator: 'Jämförelse', omfattning: 'Omfattning', moms: 'Moms',
  gallerFran: 'Gäller från', gallerTill: 'Gäller till', konton: 'Konton', anteckning: 'Anteckning', version: 'Version',
};

export interface Jamforelse {
  andrade: { id: string; namn: string; falt: string[] }[];
  nya: { id: string; namn: string }[];
  borttagna: { id: string; namn: string }[];
  oforandrade: number;
}

function jamfor<T extends { id: string; namn: string }>(nu: T[], fil: T[], falt: Record<string, string>): Jamforelse {
  const forut = new Map(nu.map((x) => [x.id, x]));
  const iFilen = new Set(fil.map((x) => x.id));
  const j: Jamforelse = { andrade: [], nya: [], borttagna: [], oforandrade: 0 };
  for (const x of fil) {
    const f = forut.get(x.id);
    if (!f) { j.nya.push({ id: x.id, namn: x.namn }); continue; }
    const andrat = Object.keys(falt).filter((k) => JSON.stringify(x[k as keyof T] ?? null) !== JSON.stringify(f[k as keyof T] ?? null));
    if (andrat.length) j.andrade.push({ id: x.id, namn: x.namn, falt: andrat.map((k) => falt[k]) });
    else j.oforandrade++;
  }
  for (const f of nu) if (!iFilen.has(f.id)) j.borttagna.push({ id: f.id, namn: f.namn });
  return j;
}

const antal = (j: Jamforelse) => j.andrade.length + j.nya.length + j.borttagna.length;

type Ogiltiga = { id: string; fel: string }[];

/** Rader som saknar id eller namn, eller finns två gånger, hoppas över. */
function giltiga<T extends { id: string; namn: string }>(rader: T[], slag: string, ogiltiga: Ogiltiga): T[] {
  const sedda = new Set<string>();
  return rader.filter((r) => {
    if (!r.id) { ogiltiga.push({ id: r.namn || '(tom rad)', fel: `${slag} utan id` }); return false; }
    if (sedda.has(r.id)) { ogiltiga.push({ id: r.id, fel: `${slag}en finns två gånger i filen` }); return false; }
    if (!r.namn) { ogiltiga.push({ id: r.id, fel: `${slag}en saknar namn` }); return false; }
    sedda.add(r.id);
    return true;
  });
}

/** Historikrader för det som ändrats, kommit till och försvunnit. */
function historikrader<T extends { id: string }>(
  variant: Variant, slag: 'regel' | 'parameter', j: Jamforelse, efter: T[], forut: T[], kalla: string,
): Parameters<typeof loggaHistorik>[1] {
  const ny = new Map(efter.map((x) => [x.id, x]));
  const gammal = new Map(forut.map((x) => [x.id, x]));
  return [
    ...j.andrade.map((x) => ({ variant, konto: null, handling: 'importerad' as const, kalla, data: { ...ny.get(x.id), slag, falt: x.falt } })),
    ...j.nya.map((x) => ({ variant, konto: null, handling: 'tillagd' as const, kalla, data: { ...ny.get(x.id), slag } })),
    ...j.borttagna.map((x) => ({ variant, konto: null, handling: 'borttagen' as const, kalla, data: { ...gammal.get(x.id), slag } })),
  ];
}

export interface GransvardenPlan {
  parametrar: Jamforelse;
  ogiltiga: Ogiltiga;
  /** Inget har importerats förut (k1.json gäller): filen sparas även om värdena är desamma, så att den står som källa. */
  forstaImport: boolean;
  /** Regler i någon kontoplan som pekar på ett värde som inte finns i filen — de prövas inte längre i kod. */
  reglerUtanVarde: { variant: Variant; id: string; namn: string; parameterId: string }[];
}

/** Jämför filen med de gemensamma gränsvärdena och ersätter dem om `spara` är satt. */
export async function importeraGransvarden(
  supabase: SupabaseClient, fil: Parameter[], spara: boolean, filnamn: string,
): Promise<GransvardenPlan> {
  const [nu, ...regler] = await Promise.all([hamtaGransvarden(supabase), ...VARIANTER.map((v) => hamtaRegler(supabase, v))]);
  const ogiltiga: Ogiltiga = [];
  const parametrar = giltiga(fil, 'Parameter', ogiltiga);
  const ids = new Set(parametrar.map((p) => p.id));
  for (const p of parametrar) {
    if (p.basParameter && !ids.has(p.basParameter)) ogiltiga.push({ id: p.id, fel: `Baseras på ${p.basParameter}, som inte finns i filen` });
  }
  const plan: GransvardenPlan = {
    parametrar: jamfor(nu.parametrar, parametrar, PARAMETERFALT),
    ogiltiga,
    forstaImport: !nu.updatedAt,
    reglerUtanVarde: VARIANTER.flatMap((variant, i) => regler[i].regler
      .filter((r) => r.parameterId && !ids.has(r.parameterId))
      .map((r) => ({ variant, id: r.id, namn: r.namn, parameterId: r.parameterId }))),
  };

  if (spara && (antal(plan.parametrar) || plan.forstaImport)) {
    const { error } = await supabase.from('gransvarden').upsert(
      { id: 'gemensam', kalla: filnamn, parametrar, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error(`Kunde inte spara gränsvärdena: ${error.message}`);
    // Gemensamma: syns i båda kontoplanernas historik
    await loggaHistorik(supabase, VARIANTER.flatMap((v) => historikrader(v, 'parameter', plan.parametrar, parametrar, nu.parametrar, filnamn)));
  }
  return plan;
}

export interface ReglerPlan { regler: Jamforelse; ogiltiga: Ogiltiga; forstaImport: boolean }

/** Jämför filen med kontoplanens regler och ersätter dem om `spara` är satt. */
export async function importeraRegler(
  supabase: SupabaseClient, variant: Variant, fil: Regel[], spara: boolean, filnamn: string,
): Promise<ReglerPlan> {
  const [nu, gv] = await Promise.all([hamtaRegler(supabase, variant), hamtaGransvarden(supabase)]);
  const ogiltiga: Ogiltiga = [];
  const ids = new Set(gv.parametrar.map((p) => p.id));
  const regler = giltiga(fil, 'Regel', ogiltiga).filter((r) => {
    // En regel utan värde är tillåten (t.ex. kundens val av bokslutsmetod), men ett värde som saknas är ett fel
    if (r.parameterId && !ids.has(r.parameterId)) {
      ogiltiga.push({ id: r.id, fel: `Värdet ${r.parameterId} finns inte bland gränsvärdena` });
      return false;
    }
    return true;
  });
  const plan: ReglerPlan = { regler: jamfor(nu.regler, regler, REGELFALT), ogiltiga, forstaImport: !nu.updatedAt };

  if (spara && (antal(plan.regler) || plan.forstaImport)) {
    const { error } = await supabase.from('kontoplan_regelmaster').upsert(
      { variant, kalla: filnamn, regler, updated_at: new Date().toISOString() }, { onConflict: 'variant' });
    if (error) throw new Error(`Kunde inte spara reglerna: ${error.message}`);
    await loggaHistorik(supabase, historikrader(variant, 'regel', plan.regler, regler, nu.regler, filnamn));
  }
  return plan;
}
