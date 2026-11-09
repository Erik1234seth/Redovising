import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hamtaK1Andringar, kontoText, loggaHistorik, sparaK1Andring, synligaKonton, taBortK1Konto, type Variant,
} from './k1-andringar';
import { medAndring, originalKonto, type K1Andring, type K1Konto } from './regelverk';

/**
 * Importerar kontobeskrivningar från en fil med samma struktur som
 * nedladdningen i Kontoplan: xlsx (fliken Kontobeskrivningar, kolumnerna i
 * scripts/k1-till-json.mjs, listor separerade med |) eller JSON som k1.json.
 *
 * Bara texten byrån kan ändra följer med — namn, beskrivning och listorna. Hela
 * texten sparas i kontoplanen, så det som står i filen är det som gäller.
 * Ett konto som inte finns i kontoplanen läggs till. Filen är hela kontoplanen:
 * konton som saknas i den tas bort ur vyn men finns kvar i historiken.
 * Gränsvärdena och regelmasterns regler importeras inte här: de har egna filer på fliken Regler (./regelmaster).
 */

const FALT = ['namn', 'beskrivning', 'anvandNar', 'anvandInteNar', 'beslutsregler', 'varningar', 'exempel', 'granskningNar', 'nyckelord'] as const;
type Falt = (typeof FALT)[number];
type Text = Pick<K1Konto, Falt> & { konto: string };

export const FALTNAMN: Record<Falt, string> = {
  namn: 'Namn', beskrivning: 'Beskrivning', anvandNar: 'Använd när', anvandInteNar: 'Använd inte när',
  beslutsregler: 'Beslutsregler', varningar: 'Varningar', exempel: 'Exempel', granskningNar: 'Granskning när', nyckelord: 'Sökord',
};

const text = (v: unknown) => String(v ?? '').trim();
const lista = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split('|')).map(text).filter(Boolean);

/** Läser kontona ur filen. Kastar ett fel som går att visa om filen inte har rätt struktur. */
export function lasKontoFil(data: Buffer, filnamn: string): Text[] {
  if (/\.json$/i.test(filnamn)) {
    let json: { konton?: Record<string, unknown>[] };
    try {
      json = JSON.parse(data.toString('utf8'));
    } catch {
      throw new Error('Filen är inte giltig JSON');
    }
    if (!Array.isArray(json.konton)) throw new Error('JSON-filen saknar listan "konton" (samma form som nedladdningen)');
    return json.konton.map((k) => ({
      konto: text(k.konto),
      namn: text(k.namn),
      beskrivning: text(k.beskrivning),
      ...Object.fromEntries(FALT.slice(2).map((f) => [f, lista(k[f])])),
    }) as Text).filter((k) => k.konto);
  }

  const wb = XLSX.read(data, { type: 'buffer' });
  const ark = wb.Sheets.Kontobeskrivningar;
  if (!ark) throw new Error('Fliken Kontobeskrivningar saknas i filen');
  const rader = XLSX.utils.sheet_to_json<Record<string, unknown>>(ark, { defval: '' });
  if (rader.length && !('account_number' in rader[0])) throw new Error('Fliken Kontobeskrivningar saknar kolumnen account_number');
  return rader
    .filter((r) => text(r.account_number) && (!text(r.status) || text(r.status) === 'active'))
    .map((r) => ({
      konto: text(r.account_number),
      namn: text(r.account_name),
      beskrivning: text(r.short_description),
      anvandNar: lista(r.use_when),
      anvandInteNar: lista(r.do_not_use_when),
      beslutsregler: lista(r.decision_rules),
      varningar: lista(r.warnings),
      exempel: lista(r.examples),
      granskningNar: lista(r.needs_human_review),
      nyckelord: lista(r.keywords),
    }));
}

export interface Importplan {
  andrade: { konto: string; namn: string; falt: string[] }[];
  /** Nya konton, och borttagna konton som finns i filen igen (`tillbaka`). */
  nya: { konto: string; namn: string; tillbaka?: boolean }[];
  /** Konton som syns nu men saknas i filen — de tas bort ur vyn men finns kvar i historiken. */
  borttagna: { konto: string; namn: string }[];
  ogiltiga: { konto: string; fel: string }[];
  oforandrade: number;
}

/**
 * Jämför filen med kontoplanen som den gäller nu, och sparar om `spara` är satt.
 * Filen är hela kontoplanen: ett konto som syns nu men saknas i filen tas bort
 * ur vyn. Byråns text för det ligger kvar och historiken visar det.
 */
export async function importeraKonton(
  supabase: SupabaseClient, variant: Variant, konton: Text[], spara: boolean, filnamn: string,
): Promise<Importplan> {
  const sparade = await hamtaK1Andringar(supabase, variant);
  const plan: Importplan = { andrade: [], nya: [], borttagna: [], ogiltiga: [], oforandrade: 0 };
  const sedda = new Set<string>();
  const skriv: (() => Promise<void>)[] = [];
  const historik: Parameters<typeof loggaHistorik>[1] = [];

  for (const k of konton) {
    if (sedda.has(k.konto)) { plan.ogiltiga.push({ konto: k.konto, fel: 'Finns två gånger i filen' }); continue; }
    if (!/^\d{4}$/.test(k.konto)) { plan.ogiltiga.push({ konto: k.konto, fel: 'Kontonumret ska vara fyra siffror' }); continue; }
    if (!k.namn) { plan.ogiltiga.push({ konto: k.konto, fel: 'Namn saknas' }); continue; }
    if (!k.beskrivning) { plan.ogiltiga.push({ konto: k.konto, fel: 'Beskrivning saknas' }); continue; }
    sedda.add(k.konto);

    const original = originalKonto(k.konto);
    const sparad = sparade.get(k.konto);
    const borttagen = !!sparad?.borttagenAt;
    const nu = original || sparad ? medAndring(k.konto, sparad?.andring) : null;
    const andrat = FALT.filter((f) => !nu || JSON.stringify(k[f]) !== JSON.stringify(nu[f]));
    if (!andrat.length && !borttagen) { plan.oforandrade++; continue; }

    if (!nu || borttagen) plan.nya.push({ konto: k.konto, namn: k.namn, ...(borttagen ? { tillbaka: true } : {}) });
    else plan.andrade.push({ konto: k.konto, namn: k.namn, falt: andrat.map((f) => FALTNAMN[f]) });
    historik.push({
      variant, konto: k.konto, handling: borttagen ? 'tillbaka' : nu ? 'importerad' : 'tillagd', kalla: filnamn,
      data: Object.fromEntries([['konto', k.konto], ...FALT.map((f) => [f, k[f]])]),
    });

    skriv.push(() => sparaK1Andring(supabase, variant, k.konto, Object.fromEntries(FALT.map((f) => [f, k[f]])) as K1Andring));
  }

  for (const nr of synligaKonton(sparade)) {
    if (sedda.has(nr)) continue;
    const text = kontoText(nr, sparade.get(nr)?.andring);
    plan.borttagna.push({ konto: nr, namn: String(text.namn ?? '') });
    historik.push({ variant, konto: nr, handling: 'borttagen', kalla: filnamn, data: text });
    skriv.push(() => taBortK1Konto(supabase, variant, nr));
  }

  if (spara) {
    for (const s of skriv) await s();
    await loggaHistorik(supabase, historik);
  }
  return plan;
}
