import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accessTokenFor } from './oauth';
import { konteraDag, type Kontohandelse, type ZettlePurchase } from './kontering';

/**
 * Hämtar kundens köp och kontohändelser från Zettle och bygger om
 * dagskassorna för de dagar som hämtningen täcker.
 *
 * Rådatan sparas i zettle_kop och zettle_kontohandelser. Verifikationerna
 * byggs sedan från tabellerna och inte direkt från svaret, så en dag blir
 * alltid komplett även när hämtfönstret börjar mitt i den.
 *
 * Varje körning hämtar om de senaste dagarna (OVERLAP_DAYS). Återbetalningar
 * och avgifter kan dyka upp i efterhand, och upsert gör omhämtningen ofarlig.
 * Det betyder också att en Zettle-verifikation som ändrats för hand skrivs
 * över om dess dag hämtas om.
 */

const PURCHASE_BASE = 'https://purchase.izettle.com';
const FINANCE_BASE = 'https://finance.izettle.com/v2';
const OVERLAP_DAYS = 3;
/** Finance API vill ha start och slut; stora fönster delas upp i månader. */
const FINANCE_WINDOW_DAYS = 31;
const CHUNK = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ZettleSyncResult {
  kop: number;
  handelser: number;
  dagar: number;
  ohanterade: number;
}

const stockholmDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
/** Dagen i Sverige — ett köp kl 00:30 hör till den dagen, inte till gårdagen i UTC. */
function svenskDag(d: Date): string {
  return stockholmDate.format(d);
}

/** Zettle skriver "+0000" utan kolon och Finance-tider helt utan zon (de är UTC). */
function parseZettleTime(value: string): Date {
  const fixed = /[+-]\d{4}$/.test(value)
    ? value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
    : /Z|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  return new Date(fixed);
}

async function zettleGet<T>(url: string, token: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Zettle ${res.status} på ${new URL(url).pathname}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  }
}

interface ApiPurchase extends ZettlePurchase {
  purchaseUUID1: string;
  timestamp: string;
  currency: string;
}

async function hamtaKop(token: string, from: Date): Promise<ApiPurchase[]> {
  const out: ApiPurchase[] = [];
  let hash: string | undefined;
  for (;;) {
    const params = new URLSearchParams({ startDate: from.toISOString().slice(0, 16), limit: '1000' });
    if (hash) params.set('lastPurchaseHash', hash);
    const page = await zettleGet<{ purchases: ApiPurchase[]; lastPurchaseHash?: string }>(
      `${PURCHASE_BASE}/purchases/v2?${params}`,
      token,
    );
    out.push(...page.purchases);
    if (page.purchases.length < 1000 || !page.lastPurchaseHash) return out;
    hash = page.lastPurchaseHash;
  }
}

interface ApiTransaction {
  timestamp: string;
  amount: string | number;
  originatorTransactionType: string;
  originatorTransactionUuid: string;
}

async function hamtaHandelser(token: string, from: Date, to: Date): Promise<ApiTransaction[]> {
  const out: ApiTransaction[] = [];
  const fmt = (d: Date) => d.toISOString().slice(0, 19);
  for (let start = from; start < to; start = new Date(start.getTime() + FINANCE_WINDOW_DAYS * DAY_MS)) {
    const end = new Date(Math.min(start.getTime() + FINANCE_WINDOW_DAYS * DAY_MS, to.getTime()));
    for (let offset = 0; ; offset += 1000) {
      const params = new URLSearchParams({ start: fmt(start), end: fmt(end), limit: '1000', offset: String(offset) });
      const page = await zettleGet<ApiTransaction[]>(`${FINANCE_BASE}/accounts/liquid/transactions?${params}`, token);
      out.push(...page);
      if (page.length < 1000) break;
    }
  }
  return out;
}

async function upsertChunks(supabase: SupabaseClient, table: string, rows: object[], onConflict: string, ignoreDuplicates: boolean) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict, ignoreDuplicates });
    if (error) throw new Error(`Kunde inte spara ${table}: ${error.message}`);
  }
}

async function lasAlla<T>(supabase: SupabaseClient, table: string, columns: string, userId: string, fromDag: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq('user_id', userId)
      .gte('datum', fromDag)
      .order('datum')
      .range(from, from + 999);
    if (error) throw new Error(`Kunde inte läsa ${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < 1000) return out;
  }
}

export async function synkaZettle(supabase: SupabaseClient, userId: string): Promise<ZettleSyncResult> {
  const { data: koppling, error } = await supabase
    .from('zettle_kopplingar')
    .select('organization_uuid, synkad_till')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa Zettle-kopplingen: ${error.message}`);
  if (!koppling) throw new Error('Kunden har ingen Zettle-koppling');

  try {
    const result = await synka(supabase, userId, koppling.organization_uuid, koppling.synkad_till);
    await supabase.from('zettle_kopplingar').update({ senast_synkad_at: new Date().toISOString(), senaste_fel: null }).eq('user_id', userId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel';
    // Utgången koppling har redan fått ett begripligt felmeddelande i accessTokenFor
    await supabase.from('zettle_kopplingar').update({ senaste_fel: message }).eq('user_id', userId).eq('status', 'aktiv');
    throw err;
  }
}

async function synka(supabase: SupabaseClient, userId: string, orgUuid: string, synkadTill: string | null): Promise<ZettleSyncResult> {
  const now = new Date();
  // Första gången: från årets början, så att hela bokföringsåret kommer med
  const from = synkadTill
    ? new Date(new Date(synkadTill).getTime() - OVERLAP_DAYS * DAY_MS)
    : new Date(`${svenskDag(now).slice(0, 4)}-01-01T00:00:00+01:00`);
  const fromDag = svenskDag(from);

  const token = await accessTokenFor(supabase, userId);
  const [kop, handelser] = await Promise.all([hamtaKop(token, from), hamtaHandelser(token, from, now)]);

  await upsertChunks(supabase, 'zettle_kop', kop.map((p) => {
    const tid = parseZettleTime(p.timestamp);
    return {
      user_id: userId,
      purchase_uuid: p.purchaseUUID1,
      tidpunkt: tid.toISOString(),
      datum: svenskDag(tid),
      belopp: p.amount,
      moms: p.vatAmount,
      valuta: p.currency,
      data: p,
      hamtad_at: now.toISOString(),
    };
  }), 'user_id,purchase_uuid', false);

  await upsertChunks(supabase, 'zettle_kontohandelser', handelser.map((h) => {
    const tid = parseZettleTime(h.timestamp);
    return {
      user_id: userId,
      typ: h.originatorTransactionType,
      originator_uuid: h.originatorTransactionUuid,
      tidpunkt: tid.toISOString(),
      belopp: Number(h.amount),
      datum: svenskDag(tid),
    };
  }), 'user_id,typ,originator_uuid,tidpunkt,belopp', true);

  const { dagar, ohanterade } = await byggDagskassor(supabase, userId, orgUuid, fromDag);

  const { error } = await supabase.from('zettle_kopplingar').update({ synkad_till: now.toISOString() }).eq('user_id', userId);
  if (error) throw new Error(`Kunde inte spara synkdatum: ${error.message}`);

  return { kop: kop.length, handelser: handelser.length, dagar, ohanterade };
}

async function byggDagskassor(supabase: SupabaseClient, userId: string, orgUuid: string, fromDag: string) {
  const kop = await lasAlla<{ datum: string; valuta: string; data: ZettlePurchase }>(supabase, 'zettle_kop', 'datum, valuta, data', userId, fromDag);
  const handelser = await lasAlla<{ datum: string; typ: string; belopp: number }>(supabase, 'zettle_kontohandelser', 'datum, typ, belopp', userId, fromDag);

  const perDag = new Map<string, { kop: ZettlePurchase[]; handelser: Kontohandelse[]; valutor: Set<string> }>();
  const dag = (d: string) => {
    let v = perDag.get(d);
    if (!v) perDag.set(d, (v = { kop: [], handelser: [], valutor: new Set() }));
    return v;
  };
  for (const k of kop) {
    dag(k.datum).kop.push(k.data);
    dag(k.datum).valutor.add(k.valuta);
  }
  for (const h of handelser) dag(h.datum).handelser.push({ typ: h.typ, belopp: Number(h.belopp) });

  const registrerad = svenskDag(new Date());
  const vers: object[] = [];
  const rader: object[] = [];
  let ohanterade = 0;

  for (const [datum, d] of [...perDag.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const kassa = konteraDag(d.kop, d.handelser);
    if (kassa.rader.length === 0) continue;
    ohanterade += kassa.ohanterade.length;

    let text = `Zettle dagskassa ${datum} (${d.kop.length} köp)`;
    if (kassa.ohanterade.length) {
      text += ` – ej bokfört: ${[...new Set(kassa.ohanterade.map((h) => h.typ))].join(', ')}`;
    }
    const utlandsk = [...d.valutor].filter((v) => v !== 'SEK');
    if (utlandsk.length) text += ` – valuta ${utlandsk.join(', ')}`;

    const id = randomUUID();
    vers.push({
      id,
      user_id: userId,
      kalla: 'zettle',
      extern_id: `zettle|${orgUuid}|${datum}`,
      serie: 'Z',
      nummer: datum.replace(/-/g, ''),
      datum,
      text,
      registrerad,
      signatur: 'Zettle',
      summa: kassa.rader.filter((r) => r.belopp > 0).reduce((s, r) => s + r.belopp, 0),
      balanserad: true,
    });
    kassa.rader.forEach((r, radnr) => rader.push({
      verifikation_id: id,
      radnr,
      konto: r.konto,
      kontonamn: r.kontonamn || null,
      belopp: r.belopp,
      datum,
      text: null,
      objekt: [],
      borttagen: false,
      tillagd: false,
    }));
  }

  // De gamla dagskassorna tas bort först när de nya ligger på plats, så att
  // ett fel halvvägs aldrig lämnar kunden utan verifikationer för dagarna
  const { data: gamla, error: gamlaError } = await supabase
    .from('verifikationer')
    .select('id')
    .eq('user_id', userId)
    .eq('kalla', 'zettle')
    .gte('datum', fromDag);
  if (gamlaError) throw new Error(`Kunde inte läsa gamla dagskassor: ${gamlaError.message}`);

  const nyaIds = vers.map((v) => (v as { id: string }).id);
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

  return { dagar: vers.length, ohanterade };
}

/** För cron: synka alla aktiva kopplingar, en i taget. Ett fel stoppar inte de andra. */
export async function synkaAllaZettle(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('zettle_kopplingar').select('user_id').eq('status', 'aktiv');
  if (error) throw new Error(`Kunde inte läsa Zettle-kopplingar: ${error.message}`);
  const out = { synkade: 0, fel: 0 };
  for (const { user_id } of data ?? []) {
    try {
      await synkaZettle(supabase, user_id);
      out.synkade++;
    } catch (err) {
      console.error('[zettle] synk misslyckades för', user_id, err);
      out.fel++;
    }
  }
  return out;
}
