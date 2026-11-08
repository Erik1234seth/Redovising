import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import { K1_REGELMASTER, type Parameter, type Regel, type Regelmaster } from './regelverk';
import { loggaHistorik, type Variant } from './k1-andringar';

/**
 * Regelmasterns gränsvärden och regler per kontoplan (löpande bokföring och
 * bokslut), i tabellen `kontoplan_regelmaster`. Utan rad gäller k1.json.
 *
 * Byrån laddar ner och importerar hela regelmastern från fliken Regler, som
 * xlsx (fliken Gränsvärden, samma form som i kontobeskrivningsfilen) eller JSON
 * med listorna `parametrar` och `regler` (som k1.json). En import ersätter
 * allt: det som saknas i filen slutar gälla. Varje ändrad, ny och borttagen
 * regel och parameter skrivs till `kontoplan_historik` (konto null,
 * data.slag 'regel' eller 'parameter' — parametrar har ett eget fält typ).
 */

export interface SparadRegelmaster extends Regelmaster { updatedAt: string | null }

export async function hamtaRegelmaster(supabase: SupabaseClient, variant: Variant): Promise<SparadRegelmaster> {
  const { data, error } = await supabase.from('kontoplan_regelmaster')
    .select('kalla, parametrar, regler, updated_at').eq('variant', variant).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa regelmastern: ${error.message}`);
  if (!data) return { ...K1_REGELMASTER, updatedAt: null };
  return { kalla: data.kalla, parametrar: data.parametrar as Parameter[], regler: data.regler as Regel[], updatedAt: data.updated_at };
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

/** Läser regelmastern ur filen. Kastar ett fel som går att visa om filen inte har rätt struktur. */
export function lasRegelmasterFil(data: Buffer, filnamn: string): Pick<Regelmaster, 'parametrar' | 'regler'> {
  if (/\.json$/i.test(filnamn)) {
    let json: { parametrar?: Record<string, unknown>[]; regler?: Record<string, unknown>[] };
    try {
      json = JSON.parse(data.toString('utf8'));
    } catch {
      throw new Error('Filen är inte giltig JSON');
    }
    if (!Array.isArray(json.regler) || !Array.isArray(json.parametrar)) {
      throw new Error('JSON-filen saknar listorna "parametrar" och "regler" (samma form som nedladdningen)');
    }
    return { parametrar: json.parametrar.map(parameter), regler: json.regler.map(regel) };
  }

  const wb = XLSX.read(data, { type: 'buffer' });
  const ark = wb.Sheets['Gränsvärden'];
  if (!ark) throw new Error('Fliken Gränsvärden saknas i filen');
  const gv = XLSX.utils.sheet_to_json<unknown[]>(ark, { header: 1, blankrows: false, defval: '' });
  if (text(gv[0]?.[0]) !== 'value_id') throw new Error('Fliken Gränsvärden ska börja med parametertabellen (kolumnen value_id)');
  const brytpunkt = gv.findIndex((r, i) => i > 0 && text(r[0]) === 'rule_id');
  if (brytpunkt === -1) throw new Error('Hittar inte regeltabellen (rubriken rule_id) i Gränsvärden');
  const objekt = (rubriker: unknown[], rad: unknown[]) => Object.fromEntries(rubriker.map((k, i) => [text(k), rad[i] ?? '']));
  const aktiv = (o: Record<string, unknown>) => !text(o.status) || text(o.status) === 'active';

  const parametrar = gv.slice(1, brytpunkt).filter((r) => text(r[0])).map((r) => objekt(gv[0], r)).filter(aktiv)
    .map((p) => parameter({
      id: p.value_id, namn: p.parameter_name, varde: p.value, enhet: p.unit, basParameter: p.base_parameter_id,
      multiplikator: p.multiplier, gallerFran: p.valid_from, gallerTill: p.valid_to, typ: p.parameter_type,
      senastKontrollerad: p.last_verified_at, version: p.version,
    }));
  const regler = gv.slice(brytpunkt + 1).filter((r) => text(r[0])).map((r) => objekt(gv[brytpunkt], r)).filter(aktiv)
    .map((g) => regel({
      id: g.rule_id, namn: g.rule_name, parameterId: g.value_id, operator: g.comparison_operator,
      omfattning: g.aggregation_scope, moms: g.vat_treatment, gallerFran: g.valid_from, gallerTill: g.valid_to,
      konton: g.applies_to_accounts, anteckning: g.rule_notes, version: g.version,
    }));
  return { parametrar, regler };
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

export interface RegelmasterPlan {
  regler: Jamforelse;
  parametrar: Jamforelse;
  ogiltiga: { id: string; fel: string }[];
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

/** Rader som saknar id eller namn, eller finns två gånger, hoppas över. */
function giltiga<T extends { id: string; namn: string }>(rader: T[], slag: string, ogiltiga: RegelmasterPlan['ogiltiga']): T[] {
  const sedda = new Set<string>();
  return rader.filter((r) => {
    if (!r.id) { ogiltiga.push({ id: r.namn || '(tom rad)', fel: `${slag} utan id` }); return false; }
    if (sedda.has(r.id)) { ogiltiga.push({ id: r.id, fel: `${slag}en finns två gånger i filen` }); return false; }
    if (!r.namn) { ogiltiga.push({ id: r.id, fel: `${slag}en saknar namn` }); return false; }
    sedda.add(r.id);
    return true;
  });
}

/** Jämför filen med kontoplanens regelmaster och ersätter den om `spara` är satt. */
export async function importeraRegelmaster(
  supabase: SupabaseClient, variant: Variant, fil: Pick<Regelmaster, 'parametrar' | 'regler'>, spara: boolean, filnamn: string,
): Promise<RegelmasterPlan> {
  const nu = await hamtaRegelmaster(supabase, variant);
  const ogiltiga: RegelmasterPlan['ogiltiga'] = [];
  const parametrar = giltiga(fil.parametrar, 'Parameter', ogiltiga);
  const ids = new Set(parametrar.map((p) => p.id));
  const regler = giltiga(fil.regler, 'Regel', ogiltiga).filter((r) => {
    // En regel utan värde är tillåten (t.ex. kundens val av bokslutsmetod), men ett värde som saknas är ett fel
    if (r.parameterId && !ids.has(r.parameterId)) {
      ogiltiga.push({ id: r.id, fel: `Värdet ${r.parameterId} finns inte bland parametrarna i filen` });
      return false;
    }
    return true;
  });

  const plan: RegelmasterPlan = {
    regler: jamfor(nu.regler, regler, REGELFALT),
    parametrar: jamfor(nu.parametrar, parametrar, PARAMETERFALT),
    ogiltiga,
  };

  if (spara && (plan.regler.andrade.length + plan.regler.nya.length + plan.regler.borttagna.length
    + plan.parametrar.andrade.length + plan.parametrar.nya.length + plan.parametrar.borttagna.length)) {
    const { error } = await supabase.from('kontoplan_regelmaster').upsert(
      { variant, kalla: filnamn, parametrar, regler, updated_at: new Date().toISOString() }, { onConflict: 'variant' });
    if (error) throw new Error(`Kunde inte spara regelmastern: ${error.message}`);

    const historik: Parameters<typeof loggaHistorik>[1] = [];
    const logga = (typ: 'regel' | 'parameter', j: Jamforelse, efter: (Regel | Parameter)[], forut: (Regel | Parameter)[]) => {
      const ny = new Map(efter.map((x) => [x.id, x]));
      const gammal = new Map(forut.map((x) => [x.id, x]));
      for (const x of j.andrade) historik.push({ variant, konto: null, handling: 'importerad', kalla: filnamn, data: { ...ny.get(x.id), slag: typ, falt: x.falt } });
      for (const x of j.nya) historik.push({ variant, konto: null, handling: 'tillagd', kalla: filnamn, data: { ...ny.get(x.id), slag: typ } });
      for (const x of j.borttagna) historik.push({ variant, konto: null, handling: 'borttagen', kalla: filnamn, data: { ...gammal.get(x.id), slag: typ } });
    };
    logga('regel', plan.regler, regler, nu.regler);
    logga('parameter', plan.parametrar, parametrar, nu.parametrar);
    await loggaHistorik(supabase, historik);
  }
  return plan;
}
