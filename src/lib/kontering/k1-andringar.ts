import type { SupabaseClient } from '@supabase/supabase-js';
import { anvandAndringar, anvandRegelmaster, helText, medAndring, originalNummer, type K1Andring, type K1Konto } from './regelverk';
import { hamtaAiRegler, hamtaRegelmaster } from './regelmaster';
import { anvandPrinciper, PRINCIPER } from './principer';
import { anvandAiRegler } from './airegler';

/**
 * Byråns kontoplaner, gjorda i adminpanelen. Det finns två: löpande bokföring
 * och bokslut, med var sina kontobeskrivningar och principer. Konteringen
 * använder den löpande.
 *
 * Varje kontoplan är en hel kopia: `k1_konto_andringar` har en rad per
 * kontoplan och konto med hela texten, och den läses när en kontering börjar,
 * så att det som ändras gäller direkt utan ny deploy. k1.json (byggd från
 * xlsx-filen med `npm run k1`) är bara utgångsläget som "Återställ" går
 * tillbaka till — en ny k1.json ändrar ingen kontoplan. Ett konto med
 * `borttagen_at` syns inte och kan inte väljas, men texten ligger kvar.
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

/** Kontona som syns i kontoplanen: dess rader utan borttagna (utgångsläget om den inte har några). */
export function synligaKonton(sparade: Map<string, SparadAndring>): string[] {
  return [...(sparade.size ? sparade.keys() : originalNummer())].filter((nr) => !sparade.get(nr)?.borttagenAt).sort();
}

/**
 * Läser den löpande kontoplanen, principerna och regelmastern och låter
 * konteringen använda dem. Anropas när en kontering börjar.
 */
export async function laddaK1Andringar(supabase: SupabaseClient): Promise<void> {
  const [alla, principer, rm, ai] = await Promise.all([
    hamtaK1Andringar(supabase, 'lopande'), hamtaPrinciper(supabase, 'lopande'), hamtaRegelmaster(supabase, 'lopande'),
    hamtaAiRegler(supabase, 'lopande'),
  ]);
  anvandRegelmaster(rm);
  anvandAiRegler(ai.regler);
  const andringar = new Map([...alla].map(([k, v]) => [k, v.andring]));
  anvandAndringar(andringar, new Set([...alla].filter(([, v]) => v.borttagenAt).map(([k]) => k)));
  anvandPrinciper(principer.lista);
}

/**
 * Sparar kontots hela text: ändringen ovanpå det som gäller nu (`nu`, kontots
 * sparade text). Kontot syns igen om det var borttaget.
 */
export async function sparaK1Andring(supabase: SupabaseClient, variant: Variant, konto: string, andring: K1Andring, nu?: K1Andring): Promise<void> {
  const hel = helText(konto, { ...nu, ...andring });
  const rad: Record<string, unknown> = { variant, konto, updated_at: new Date().toISOString(), borttagen_at: null };
  for (const [falt, kolumn] of Object.entries(FALT)) rad[kolumn] = hel[falt as keyof K1Andring];
  const { error } = await supabase.from('k1_konto_andringar').upsert(rad, { onConflict: 'variant,konto' });
  if (error) throw new Error(`Kunde inte spara kontobeskrivningen: ${error.message}`);
}

/** Ger kontot utgångslägets (k1.json) text igen. Raden finns kvar — den är kontot i kontoplanen. */
export async function aterstallK1Konto(supabase: SupabaseClient, variant: Variant, konto: string): Promise<void> {
  await sparaK1Andring(supabase, variant, konto, {});
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
