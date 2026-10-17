import type { SupabaseClient } from '@supabase/supabase-js';
import { markeraDubbletter } from '../transaktioner/dubbletter';
import { decrypt, wooGet, WooFel, type Nycklar } from './api';

/**
 * Hämtar betalda ordrar och återbetalningar från kundens WooCommerce-butik
 * och lägger in dem som vanliga rader i transaktioner (kalla='woocommerce').
 * Ingenting bokförs — raderna konteras som allt annat.
 *
 * En order blir en rad in, den dag den betalades. En återbetalning blir en
 * rad ut, den dag den gjordes. Obetalda ordrar (väntar på betalning, avbrutna,
 * misslyckade) hoppas över. Ordrarna hämtas efter senast ändrad, så en order
 * som får en återbetalning i efterhand kommer med igen. Samma order skrivs
 * över, inte dubbelt (extern_id).
 */

const PER_SIDA = 100;
const STATUSAR = 'processing,completed,refunded';

interface Rad {
  total?: string;
  total_tax?: string;
}

interface WooOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  date_paid: string | null;
  date_modified_gmt: string | null;
  total: string;
  total_tax: string;
  shipping_total: string;
  discount_total: string;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  billing: { first_name?: string; last_name?: string; company?: string; country?: string; email?: string };
  line_items: (Rad & { name: string; quantity: number })[];
  shipping_lines: (Rad & { method_title: string })[];
  fee_lines: (Rad & { name: string })[];
  coupon_lines: { code: string; discount: string }[];
  tax_lines: { label: string; rate_percent?: number; tax_total: string; shipping_tax_total: string }[];
  refunds: { id: number; total: string; reason: string }[];
}

interface WooRefund {
  id: number;
  date_created: string;
  amount: string;
  reason: string;
  line_items: (Rad & { name: string; quantity: number })[];
}

const kr = (v: string | number | undefined) => Math.round(Math.abs(Number(v ?? 0)) * 100) / 100;

/** Första hämtningen: från årsskiftet förra året, så bokslutsåret kommer med. */
function forstaTid() {
  return `${new Date().getUTCFullYear() - 1}-01-01T00:00:00`;
}

function motpart(o: WooOrder): string | null {
  const namn = [o.billing.first_name, o.billing.last_name].filter(Boolean).join(' ').trim();
  return o.billing.company?.trim() || namn || null;
}

/** Allt om ordern som konteringen kan behöva, som text. */
function detaljer(o: WooOrder): string {
  const rader = [
    ...o.line_items.map((l) => `${l.quantity} st ${l.name}: ${kr(l.total)} kr + moms ${kr(l.total_tax)} kr`),
    ...o.shipping_lines.map((s) => `Frakt (${s.method_title}): ${kr(s.total)} kr + moms ${kr(s.total_tax)} kr`),
    ...o.fee_lines.map((f) => `Avgift (${f.name}): ${kr(f.total)} kr + moms ${kr(f.total_tax)} kr`),
    ...o.coupon_lines.map((c) => `Rabattkod ${c.code}: −${kr(c.discount)} kr`),
    ...o.tax_lines.map((t) => `Moms ${t.label}${t.rate_percent !== undefined ? ` (${t.rate_percent} %)` : ''}: ${kr(Number(t.tax_total) + Number(t.shipping_tax_total))} kr`),
    `Betalsätt: ${o.payment_method_title || o.payment_method || 'okänt'}${o.transaction_id ? ` (${o.transaction_id})` : ''}`,
    o.billing.country ? `Kundens land: ${o.billing.country}` : '',
    `Status i WooCommerce: ${o.status}`,
  ];
  return rader.filter(Boolean).join('\n');
}

function orderRad(userId: string, o: WooOrder) {
  return {
    user_id: userId,
    kalla: 'woocommerce',
    extern_id: `order:${o.id}`,
    radnr: 0,
    datum: o.date_paid!.slice(0, 10),
    beskrivning: `Order #${o.number} i webbutiken`,
    motpart: motpart(o),
    belopp: kr(o.total),
    moms: kr(o.total_tax),
    valuta: o.currency || 'SEK',
    riktning: 'in',
    detaljer: detaljer(o),
  };
}

function returRad(userId: string, o: WooOrder, r: WooRefund) {
  const moms = r.line_items.reduce((s, l) => s + kr(l.total_tax), 0);
  return {
    user_id: userId,
    kalla: 'woocommerce',
    extern_id: `refund:${r.id}`,
    radnr: 0,
    datum: r.date_created.slice(0, 10),
    beskrivning: `Återbetalning order #${o.number} i webbutiken`,
    motpart: motpart(o),
    belopp: kr(r.amount),
    moms: r.line_items.length ? Math.round(moms * 100) / 100 : null,
    valuta: o.currency || 'SEK',
    riktning: 'ut',
    detaljer: [
      r.reason ? `Orsak: ${r.reason}` : '',
      ...r.line_items.map((l) => `${Math.abs(l.quantity)} st ${l.name}: ${kr(l.total)} kr + moms ${kr(l.total_tax)} kr`),
      `Betalsätt: ${o.payment_method_title || o.payment_method || 'okänt'}`,
    ].filter(Boolean).join('\n'),
  };
}

export interface WooSyncResult {
  ordrar: number;
  aterbetalningar: number;
  /** false när tiden tog slut — tryck Hämta nu igen för resten. */
  klar: boolean;
}

/** Hämtar det som ändrats sedan förra gången för en kund. */
export async function synkaWoo(supabase: SupabaseClient, userId: string): Promise<WooSyncResult> {
  const { data: butik, error } = await supabase
    .from('woocommerce_butiker')
    .select('url, consumer_key, consumer_secret, synkad_till')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa WooCommerce-kopplingen: ${error.message}`);
  if (!butik) throw new WooFel('Ingen WooCommerce-butik kopplad');

  try {
    const result = await synka(supabase, userId, butik);
    await supabase.from('woocommerce_butiker')
      .update({ senast_synkad_at: new Date().toISOString(), senaste_fel: null, status: 'aktiv' })
      .eq('user_id', userId);
    return result;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    await supabase.from('woocommerce_butiker').update({ senaste_fel: text.slice(0, 500) }).eq('user_id', userId);
    throw err;
  }
}

async function synka(
  supabase: SupabaseClient,
  userId: string,
  butik: { url: string; consumer_key: string; consumer_secret: string; synkad_till: string | null },
): Promise<WooSyncResult> {
  const n: Nycklar = { url: butik.url, key: decrypt(butik.consumer_key), secret: decrypt(butik.consumer_secret) };
  const deadline = Date.now() + 240_000;
  // Lite överlapp: en order som ändrades samma sekund som förra hämtningen ska med
  const fran = butik.synkad_till
    ? new Date(new Date(butik.synkad_till).getTime() - 60 * 60 * 1000).toISOString().slice(0, 19)
    : forstaTid();

  let ordrar = 0;
  let aterbetalningar = 0;
  let senastAndrad: string | null = null;
  let klar = true;

  for (let sida = 1; ; sida++) {
    if (Date.now() > deadline) {
      klar = false;
      break;
    }
    const { data, totalPages } = await wooGet<WooOrder[]>(n, '/orders', {
      status: STATUSAR,
      modified_after: fran,
      dates_are_gmt: 'true',
      orderby: 'modified',
      order: 'asc',
      per_page: String(PER_SIDA),
      page: String(sida),
    });

    const rader: (ReturnType<typeof orderRad> | ReturnType<typeof returRad>)[] = [];
    for (const o of data) {
      if (o.date_modified_gmt) senastAndrad = o.date_modified_gmt;
      if (!o.date_paid) continue;
      rader.push(orderRad(userId, o));
      ordrar++;
      if (o.refunds?.length) {
        const { data: refunds } = await wooGet<WooRefund[]>(n, `/orders/${o.id}/refunds`, { per_page: '100' });
        for (const r of refunds) {
          rader.push(returRad(userId, o, r));
          aterbetalningar++;
        }
      }
    }

    if (rader.length) {
      const { error } = await supabase.from('transaktioner').upsert(rader, { onConflict: 'user_id,kalla,extern_id' });
      if (error) throw new Error(`Kunde inte lägga in ordrarna: ${error.message}`);
    }
    if (data.length < PER_SIDA || sida >= totalPages) break;
  }

  // Nästa gång från den senast ändrade ordern vi hann med
  if (senastAndrad) {
    await supabase.from('woocommerce_butiker')
      .update({ synkad_till: `${senastAndrad.replace(/Z$/, '')}Z` })
      .eq('user_id', userId);
  }

  await markeraDubbletter(supabase, userId);
  return { ordrar, aterbetalningar, klar };
}

/** Morgonkörningen för alla kopplade butiker. */
export async function synkaAllaWoo(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('woocommerce_butiker').select('user_id').eq('status', 'aktiv');
  if (error) throw new Error(`Kunde inte läsa WooCommerce-butikerna: ${error.message}`);
  const out = { synkade: 0, fel: 0 };
  for (const { user_id } of data ?? []) {
    try {
      await synkaWoo(supabase, user_id);
      out.synkade++;
    } catch (err) {
      console.error('[woocommerce] synk misslyckades för', user_id, err instanceof Error ? err.message : err);
      out.fel++;
    }
  }
  return out;
}
