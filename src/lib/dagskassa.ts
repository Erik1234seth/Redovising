import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Det som är gemensamt för integrationerna som bokför en verifikation per dag
 * (Zettle, Shopify): kontoplanen de använder, summering i ören och bytet av
 * gamla dagskassor mot nya.
 */

export interface Konteringsrad {
  konto: string;
  kontonamn: string;
  /** Kronor, debet positivt och kredit negativt — samma som SIE-importen. */
  belopp: number;
}

export const KONTONAMN: Record<string, string> = {
  '1510': 'Kundfordringar',
  '1580': 'Fordringar för kontokort och kuponger',
  '1910': 'Kassa',
  '1930': 'Företagskonto',
  '2420': 'Förskott från kunder',
  '2611': 'Utgående moms på försäljning inom Sverige, 25 %',
  '2621': 'Utgående moms på försäljning inom Sverige, 12 %',
  '2631': 'Utgående moms på försäljning inom Sverige, 6 %',
  '2890': 'Övriga kortfristiga skulder',
  '3001': 'Försäljning inom Sverige, 25 % moms',
  '3002': 'Försäljning inom Sverige, 12 % moms',
  '3003': 'Försäljning inom Sverige, 6 % moms',
  '3004': 'Försäljning inom Sverige, momsfri',
  '3106': 'Försäljning varor till annat EU-land, momspliktig',
  '3740': 'Öres- och kronutjämning',
  '6570': 'Bankkostnader',
};

export const MOMSKONTON: Record<number, { intakt: string; moms: string }> = {
  25: { intakt: '3001', moms: '2611' },
  12: { intakt: '3002', moms: '2621' },
  6: { intakt: '3003', moms: '2631' },
};

/** Summerar per konto i ören, så att verifikationen balanserar på öret. */
export class Summor {
  private ore = new Map<string, number>();
  add(konto: string, belopp: number) {
    if (!belopp) return;
    this.ore.set(konto, (this.ore.get(konto) ?? 0) + belopp);
  }
  get(konto: string) {
    return this.ore.get(konto) ?? 0;
  }
  total() {
    let sum = 0;
    for (const v of this.ore.values()) sum += v;
    return sum;
  }
  rader(): Konteringsrad[] {
    return [...this.ore.entries()]
      .filter(([, v]) => v !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([konto, v]) => ({ konto, kontonamn: KONTONAMN[konto] ?? '', belopp: v / 100 }));
  }
}

const stockholmDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
/** Dagen i Sverige — ett köp kl 00:30 hör till den dagen, inte till gårdagen i UTC. */
export function svenskDag(d: Date): string {
  return stockholmDate.format(d);
}

export interface NyDagskassa {
  datum: string;
  text: string;
  externId: string;
  rader: Konteringsrad[];
}

const CHUNK = 500;

/**
 * Ersätter kundens dagskassor från en källa, från och med fromDag, med nya.
 * De gamla tas bort först när de nya ligger på plats, så att ett fel halvvägs
 * aldrig lämnar kunden utan verifikationer för dagarna.
 */
export async function ersattDagskassor(
  supabase: SupabaseClient,
  userId: string,
  kalla: 'zettle' | 'shopify',
  serie: string,
  signatur: string,
  fromDag: string,
  kassor: NyDagskassa[],
): Promise<number> {
  const registrerad = svenskDag(new Date());
  const vers: { id: string }[] = [];
  const rader: object[] = [];

  for (const k of kassor) {
    if (k.rader.length === 0) continue;
    const id = crypto.randomUUID();
    vers.push({
      id,
      user_id: userId,
      kalla,
      extern_id: k.externId,
      serie,
      nummer: k.datum.replace(/-/g, ''),
      datum: k.datum,
      text: k.text,
      registrerad,
      signatur,
      summa: k.rader.filter((r) => r.belopp > 0).reduce((s, r) => s + r.belopp, 0),
      balanserad: true,
    } as { id: string });
    k.rader.forEach((r, radnr) => rader.push({
      verifikation_id: id,
      radnr,
      konto: r.konto,
      kontonamn: r.kontonamn || null,
      belopp: r.belopp,
      datum: k.datum,
      text: null,
      objekt: [],
      borttagen: false,
      tillagd: false,
    }));
  }

  const { data: gamla, error: gamlaError } = await supabase
    .from('verifikationer')
    .select('id')
    .eq('user_id', userId)
    .eq('kalla', kalla)
    .gte('datum', fromDag);
  if (gamlaError) throw new Error(`Kunde inte läsa gamla dagskassor: ${gamlaError.message}`);

  const nyaIds = vers.map((v) => v.id);
  try {
    for (let i = 0; i < vers.length; i += CHUNK) {
      const { error } = await supabase.from('verifikationer').insert(vers.slice(i, i + CHUNK));
      if (error) throw new Error(`Kunde inte spara dagskassor: ${error.message}`);
    }
    for (let i = 0; i < rader.length; i += CHUNK) {
      const { error } = await supabase.from('verifikation_rader').insert(rader.slice(i, i + CHUNK));
      if (error) throw new Error(`Kunde inte spara konteringsrader: ${error.message}`);
    }
  } catch (err) {
    for (let i = 0; i < nyaIds.length; i += CHUNK) {
      await supabase.from('verifikationer').delete().in('id', nyaIds.slice(i, i + CHUNK));
    }
    throw err;
  }

  const gamlaIds = (gamla ?? []).map((g) => g.id as string);
  for (let i = 0; i < gamlaIds.length; i += CHUNK) {
    const { error } = await supabase.from('verifikationer').delete().in('id', gamlaIds.slice(i, i + CHUNK));
    if (error) throw new Error(`Kunde inte ta bort gamla dagskassor: ${error.message}`);
  }

  return vers.length;
}
