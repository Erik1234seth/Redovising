import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Testflöde: en kopia av Flöde som skriver till egna tabeller (supabase/testflode.sql),
 * så att det går att testa på riktiga kunders underlag utan att röra deras bokföring.
 *
 * Koden i @/lib/testflode använder samma tabellnamn som Flöde. Klienten härifrån
 * byter dem mot test_-tabellerna, också i den delade koden den skickas vidare till
 * (kontering, dubblettkoll, bankmatchning). Allt annat — profiler, mejl, bankrader,
 * kontoplan, regler och filerna i lagringen — läses från det riktiga.
 */
export const TESTTABELLER = new Set([
  'bokforing_underlag',
  'transaktioner',
  'konteringar',
  'verifikationer',
  'verifikation_rader',
  'kontering_prov',
  'underlag_kopplingar',
  'betalningskopplingar',
  'kundbilder',
  'flodes_instruktioner',
]);

export function testKlient(): SupabaseClient {
  const klient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const from = klient.from.bind(klient);
  klient.from = ((tabell: string) => {
    const builder = from(TESTTABELLER.has(tabell) ? `test_${tabell}` : tabell);
    const select = builder.select.bind(builder);
    builder.select = ((kolumner?: string, ...rest: unknown[]) =>
      (select as (k?: string, ...r: unknown[]) => unknown)(kolumner && inbaddade(kolumner), ...rest)) as typeof builder.select;
    return builder;
  }) as typeof klient.from;
  return klient;
}

/**
 * Inbäddade tabeller i en select, t.ex. "verifikation_rader(konto, belopp)", pekas
 * om till test_-tabellen men behåller namnet i svaret: "verifikation_rader:test_verifikation_rader(…)".
 */
function inbaddade(kolumner: string): string {
  return kolumner.replace(/(^|[\s,(])([a-z_]+)(![a-z_]+)?\(/g, (hel, fore: string, namn: string, tips: string | undefined) =>
    TESTTABELLER.has(namn) ? `${fore}${namn}:test_${namn}${tips ?? ''}(` : hel);
}
