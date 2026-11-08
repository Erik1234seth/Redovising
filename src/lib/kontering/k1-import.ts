import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aterstallK1Konto, hamtaK1Andringar, sparaK1Andring } from './k1-andringar';
import { medAndring, originalKonto, type K1Andring, type K1Konto } from './regelverk';

/**
 * Importerar kontobeskrivningar från en fil med samma struktur som
 * nedladdningen i Kontoplan: xlsx (fliken Kontobeskrivningar, kolumnerna i
 * scripts/k1-till-json.mjs, listor separerade med |) eller JSON som k1.json.
 *
 * Bara texten byrån kan ändra följer med — namn, beskrivning och listorna.
 * Ett konto som inte finns i k1.json läggs till. Konton som saknas i filen
 * rörs inte, och gränsvärdena (parametrar och regler) importeras inte: de
 * ändras i k1.json.
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
  nya: { konto: string; namn: string }[];
  ogiltiga: { konto: string; fel: string }[];
  oforandrade: number;
}

/** Jämför filen med kontona som de gäller nu, och sparar om `spara` är satt. */
export async function importeraKonton(supabase: SupabaseClient, konton: Text[], spara: boolean): Promise<Importplan> {
  const sparade = await hamtaK1Andringar(supabase);
  const plan: Importplan = { andrade: [], nya: [], ogiltiga: [], oforandrade: 0 };
  const sedda = new Set<string>();
  const skriv: (() => Promise<void>)[] = [];

  for (const k of konton) {
    if (sedda.has(k.konto)) { plan.ogiltiga.push({ konto: k.konto, fel: 'Finns två gånger i filen' }); continue; }
    sedda.add(k.konto);
    if (!/^\d{4}$/.test(k.konto)) { plan.ogiltiga.push({ konto: k.konto, fel: 'Kontonumret ska vara fyra siffror' }); continue; }
    if (!k.namn) { plan.ogiltiga.push({ konto: k.konto, fel: 'Namn saknas' }); continue; }
    if (!k.beskrivning) { plan.ogiltiga.push({ konto: k.konto, fel: 'Beskrivning saknas' }); continue; }

    const original = originalKonto(k.konto);
    const nu = original || sparade.has(k.konto) ? medAndring(k.konto, sparade.get(k.konto)?.andring) : null;
    const andrat = FALT.filter((f) => !nu || JSON.stringify(k[f]) !== JSON.stringify(nu[f]));
    if (!andrat.length) { plan.oforandrade++; continue; }

    if (!nu) plan.nya.push({ konto: k.konto, namn: k.namn });
    else plan.andrade.push({ konto: k.konto, namn: k.namn, falt: andrat.map((f) => FALTNAMN[f]) });

    if (!original) {
      // Tillagt konto: hela texten sparas
      skriv.push(() => sparaK1Andring(supabase, k.konto, Object.fromEntries(FALT.map((f) => [f, k[f]])) as K1Andring));
      continue;
    }
    // Bara det som skiljer från k1.json sparas, som när man ändrar i rutan
    const andring = Object.fromEntries(FALT.map((f) => [f, JSON.stringify(k[f]) === JSON.stringify(original[f]) ? null : k[f]]));
    skriv.push(() => Object.values(andring).every((v) => v === null)
      ? aterstallK1Konto(supabase, k.konto)
      : sparaK1Andring(supabase, k.konto, andring as K1Andring));
  }

  if (spara) for (const s of skriv) await s();
  return plan;
}
