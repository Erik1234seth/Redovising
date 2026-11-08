import type { SupabaseClient } from '@supabase/supabase-js';
import { anvandAndringar, type K1Andring } from './regelverk';

/**
 * Byråns ändringar i K1-kontobeskrivningarna, gjorda i adminpanelen.
 *
 * Originalet är k1.json, byggt från xlsx-filen med `npm run k1`. Ändringarna
 * sparas per konto i `k1_konto_andringar` och läggs ovanpå när en kontering
 * börjar, så att de gäller direkt utan ny deploy. Ett fält som är null har
 * originalets text. Bygger man om k1.json från xlsx ligger ändringarna kvar
 * ovanpå — för in dem i xlsx-filen och ta bort dem här om de ska bli original.
 */

const FALT = {
  namn: 'namn',
  beskrivning: 'beskrivning',
  anvandNar: 'anvand_nar',
  anvandInteNar: 'anvand_inte_nar',
  beslutsregler: 'beslutsregler',
  varningar: 'varningar',
  exempel: 'exempel',
  granskningNar: 'granskning_nar',
  nyckelord: 'nyckelord',
} as const satisfies Record<keyof K1Andring, string>;

type Kolumn = (typeof FALT)[keyof typeof FALT];
type Rad = { konto: string; updated_at: string } & Partial<Record<Kolumn, unknown>>;

function franRad(r: Rad): K1Andring {
  const a: Record<string, unknown> = {};
  for (const [falt, kolumn] of Object.entries(FALT)) if (r[kolumn] !== null && r[kolumn] !== undefined) a[falt] = r[kolumn];
  return a as K1Andring;
}

export interface SparadAndring { andring: K1Andring; updatedAt: string }

/** Alla ändringar, per konto. */
export async function hamtaK1Andringar(supabase: SupabaseClient): Promise<Map<string, SparadAndring>> {
  const { data, error } = await supabase.from('k1_konto_andringar').select('*');
  if (error) throw new Error(`Kunde inte läsa ändringarna i kontobeskrivningarna: ${error.message}`);
  return new Map(((data ?? []) as Rad[]).map((r) => [r.konto, { andring: franRad(r), updatedAt: r.updated_at }]));
}

/** Läser ändringarna och låter konteringen använda dem. Anropas när en kontering börjar. */
export async function laddaK1Andringar(supabase: SupabaseClient): Promise<void> {
  const alla = await hamtaK1Andringar(supabase);
  anvandAndringar(new Map([...alla].map(([k, v]) => [k, v.andring])));
}

/** Sparar kontots ändrade fält. Ett fält som är null går tillbaka till originalet. */
export async function sparaK1Andring(supabase: SupabaseClient, konto: string, andring: { [K in keyof K1Andring]?: K1Andring[K] | null }): Promise<void> {
  const rad: Record<string, unknown> = { konto, updated_at: new Date().toISOString() };
  for (const [falt, kolumn] of Object.entries(FALT)) {
    if (falt in andring) rad[kolumn] = andring[falt as keyof K1Andring] ?? null;
  }
  const { error } = await supabase.from('k1_konto_andringar').upsert(rad, { onConflict: 'konto' });
  if (error) throw new Error(`Kunde inte spara kontobeskrivningen: ${error.message}`);
}

/** Tar bort alla ändringar för kontot — originalet gäller igen. */
export async function aterstallK1Konto(supabase: SupabaseClient, konto: string): Promise<void> {
  const { error } = await supabase.from('k1_konto_andringar').delete().eq('konto', konto);
  if (error) throw new Error(`Kunde inte återställa kontot: ${error.message}`);
}
