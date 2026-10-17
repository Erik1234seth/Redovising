import type { SupabaseClient } from '@supabase/supabase-js';
import { isSieFile, tolkaSie, type SieResultat } from './parse';

/**
 * Ingående balanser ur kundens SIE-filer, till NE-bilagan.
 *
 * Kunder som kommer från en annan byrå skickar en SIE-export, och den har
 * #IB per konto för räkenskapsåret (och ofta året före). Det är samma sak som
 * förra årets utgående B-rader, så NE behöver inte fyllas i för hand.
 *
 * Läses ur filen första gången och sparas på underlaget (ingaende_balans),
 * så att filen bara laddas ner en gång. Hör flera filer till samma år vinner
 * den senast inskickade — den är den nyaste exporten.
 */

const BUCKET = 'bokforing-underlag';

export interface SparadIb {
  start: string;
  slut: string;
  saldon: Record<string, number>;
}

export interface SieIb {
  /** Filen saldona kommer från. */
  fil: string;
  /** Räkenskapsårets första dag. */
  start: string;
  saldon: Record<string, number>;
}

/** #IB grupperade per räkenskapsår i filen. År utan #IB-rader tas inte med. */
export function ibPerAr(sie: SieResultat): SparadIb[] {
  return sie.header.rakenskapsar.flatMap((rar) => {
    const rader = sie.ingaendeBalans.filter((ib) => ib.rar === rar.id);
    if (!rader.length) return [];
    const saldon: Record<string, number> = {};
    for (const r of rader) saldon[r.konto] = Math.round(((saldon[r.konto] ?? 0) + r.belopp) * 100) / 100;
    return [{ start: rar.start, slut: rar.slut, saldon }];
  });
}

/** Per inkomstår ("2026") — året räkenskapsåret slutar, som på NE. */
export async function sieIngaendeBalans(
  supabase: SupabaseClient,
  owner: { userIds: string[]; emails: string[] },
): Promise<Record<string, SieIb>> {
  const parts = [
    ...(owner.userIds.length ? [`user_id.in.(${owner.userIds.join(',')})`] : []),
    ...(owner.emails.length ? [`sender_email.in.(${owner.emails.map((e) => `"${e}"`).join(',')})`] : []),
  ];
  if (!parts.length) return {};

  const { data, error } = await supabase
    .from('bokforing_underlag')
    .select('id, file_name, file_path, ingaende_balans')
    .or(parts.join(','))
    .order('created_at');
  if (error) throw new Error(`Kunde inte läsa SIE-filerna: ${error.message}`);

  const out: Record<string, SieIb> = {};
  for (const row of data ?? []) {
    if (!isSieFile(row.file_name)) continue;
    let ib = row.ingaende_balans as SparadIb[] | null;
    if (!ib) {
      ib = await lasFil(supabase, row.file_path);
      if (!ib) continue;
      await supabase.from('bokforing_underlag').update({ ingaende_balans: ib }).eq('id', row.id);
    }
    // I inkomstordning — en senare fil skriver över en tidigare för samma år
    for (const ar of ib) {
      if (!/^\d{4}/.test(ar.slut)) continue;
      out[ar.slut.slice(0, 4)] = { fil: row.file_name, start: ar.start, saldon: ar.saldon };
    }
  }
  return out;
}

async function lasFil(supabase: SupabaseClient, path: string): Promise<SparadIb[] | null> {
  const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !file) {
    console.error('[sie/ingaende-balans] kunde inte hämta filen:', error?.message);
    return null;
  }
  return ibPerAr(tolkaSie(new Uint8Array(await file.arrayBuffer())));
}
