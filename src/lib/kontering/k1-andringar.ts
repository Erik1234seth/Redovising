import type { SupabaseClient } from '@supabase/supabase-js';
import { anvandAndringar, medAndring, originalNummer, type K1Andring, type K1Konto } from './regelverk';
import { anvandPrinciper, PRINCIPER } from './principer';

/**
 * Byråns kontoplaner, gjorda i adminpanelen. Det finns två: löpande bokföring
 * och bokslut, med var sina kontobeskrivningar och principer. Konteringen
 * använder den löpande.
 *
 * Originalet är k1.json, byggt från xlsx-filen med `npm run k1`. Ändringarna
 * sparas per kontoplan och konto i `k1_konto_andringar` och läggs ovanpå när en
 * kontering börjar, så att de gäller direkt utan ny deploy. Ett fält som är
 * null har originalets text. Ett konto med `borttagen_at` syns inte och kan
 * inte väljas, men texten ligger kvar.
 *
 * Allt som ändras skrivs också till `kontoplan_historik`, med kontots text
 * efteråt (vid borttagning: som den var).
 */

export const VARIANTER = ['lopande', 'bokslut'] as const;
export type Variant = (typeof VARIANTER)[number];
export const VARIANT_NAMN: Record<Variant, string> = { lopande: 'Löpande bokföring', bokslut: 'Bokslut' };

export function tolkaVariant(v: unknown): Variant | null {
  return VARIANTER.includes(v as Variant) ? (v as Variant) : null;
}

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
type Rad = { konto: string; updated_at: string; borttagen_at: string | null } & Partial<Record<Kolumn, unknown>>;

function franRad(r: Rad): K1Andring {
  const a: Record<string, unknown> = {};
  for (const [falt, kolumn] of Object.entries(FALT)) if (r[kolumn] !== null && r[kolumn] !== undefined) a[falt] = r[kolumn];
  return a as K1Andring;
}

export interface SparadAndring { andring: K1Andring; updatedAt: string; borttagenAt: string | null }

/** Alla ändringar i kontoplanen, per konto — också borttagna konton. */
export async function hamtaK1Andringar(supabase: SupabaseClient, variant: Variant): Promise<Map<string, SparadAndring>> {
  const { data, error } = await supabase.from('k1_konto_andringar').select('*').eq('variant', variant);
  if (error) throw new Error(`Kunde inte läsa ändringarna i kontobeskrivningarna: ${error.message}`);
  return new Map(((data ?? []) as Rad[]).map((r) => [r.konto, { andring: franRad(r), updatedAt: r.updated_at, borttagenAt: r.borttagen_at }]));
}

/** Kontona som syns i kontoplanen: k1.json plus tillagda, utan borttagna. */
export function synligaKonton(sparade: Map<string, SparadAndring>): string[] {
  return [...new Set([...originalNummer(), ...sparade.keys()])].filter((nr) => !sparade.get(nr)?.borttagenAt).sort();
}

/** Läser den löpande kontoplanen och principerna och låter konteringen använda dem. Anropas när en kontering börjar. */
export async function laddaK1Andringar(supabase: SupabaseClient): Promise<void> {
  const [alla, principer] = await Promise.all([hamtaK1Andringar(supabase, 'lopande'), hamtaPrinciper(supabase, 'lopande')]);
  const andringar = new Map([...alla].map(([k, v]) => [k, v.andring]));
  anvandAndringar(andringar, new Set([...alla].filter(([, v]) => v.borttagenAt).map(([k]) => k)));
  anvandPrinciper(principer.lista);
}

/** Sparar kontots ändrade fält. Ett fält som är null går tillbaka till originalet. Kontot syns igen om det var borttaget. */
export async function sparaK1Andring(supabase: SupabaseClient, variant: Variant, konto: string, andring: { [K in keyof K1Andring]?: K1Andring[K] | null }): Promise<void> {
  const rad: Record<string, unknown> = { variant, konto, updated_at: new Date().toISOString(), borttagen_at: null };
  for (const [falt, kolumn] of Object.entries(FALT)) {
    if (falt in andring) rad[kolumn] = andring[falt as keyof K1Andring] ?? null;
  }
  const { error } = await supabase.from('k1_konto_andringar').upsert(rad, { onConflict: 'variant,konto' });
  if (error) throw new Error(`Kunde inte spara kontobeskrivningen: ${error.message}`);
}

/** Tar bort alla ändringar för kontot — originalet gäller igen. */
export async function aterstallK1Konto(supabase: SupabaseClient, variant: Variant, konto: string): Promise<void> {
  const { error } = await supabase.from('k1_konto_andringar').delete().eq('variant', variant).eq('konto', konto);
  if (error) throw new Error(`Kunde inte återställa kontot: ${error.message}`);
}

/** Tar bort kontot ur vyn. Byråns text ligger kvar, så det kommer tillbaka som det var. */
export async function taBortK1Konto(supabase: SupabaseClient, variant: Variant, konto: string): Promise<void> {
  const nu = new Date().toISOString();
  const { error } = await supabase.from('k1_konto_andringar')
    .upsert({ variant, konto, borttagen_at: nu, updated_at: nu }, { onConflict: 'variant,konto' });
  if (error) throw new Error(`Kunde inte ta bort kontot: ${error.message}`);
}

/** Kontots text som den gäller, till historiken. */
export function kontoText(nr: string, andring: K1Andring | undefined) {
  const k: Partial<K1Konto> = medAndring(nr, andring);
  return Object.fromEntries(['konto', 'namn', ...Object.keys(FALT).slice(1)].map((f) => [f, k[f as keyof K1Konto]]));
}

export type Handling = 'sparad' | 'tillagd' | 'aterstalld' | 'borttagen' | 'importerad' | 'tillbaka' | 'principer';

export async function loggaHistorik(
  supabase: SupabaseClient,
  rader: { variant: Variant; konto: string | null; handling: Handling; data: object; kalla?: string | null }[],
): Promise<void> {
  if (!rader.length) return;
  const { error } = await supabase.from('kontoplan_historik').insert(rader.map((r) => ({ ...r, kalla: r.kalla ?? null })));
  if (error) throw new Error(`Kunde inte skriva historiken: ${error.message}`);
}

export async function hamtaPrinciper(supabase: SupabaseClient, variant: Variant): Promise<{ lista: string[]; updatedAt: string | null }> {
  const { data, error } = await supabase.from('kontoplan_principer').select('principer, updated_at').eq('variant', variant).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa principerna: ${error.message}`);
  return data ? { lista: data.principer as string[], updatedAt: data.updated_at } : { lista: PRINCIPER, updatedAt: null };
}

export async function sparaPrinciper(supabase: SupabaseClient, variant: Variant, lista: string[]): Promise<void> {
  const { error } = await supabase.from('kontoplan_principer')
    .upsert({ variant, principer: lista, updated_at: new Date().toISOString() }, { onConflict: 'variant' });
  if (error) throw new Error(`Kunde inte spara principerna: ${error.message}`);
  await loggaHistorik(supabase, [{ variant, konto: null, handling: 'principer', data: { principer: lista } }]);
}
