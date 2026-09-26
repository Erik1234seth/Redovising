import type { SupabaseClient } from '@supabase/supabase-js';
import { ersattDagskassor, svenskDag, type NyDagskassa } from '../dagskassa';
import { accessTokenFor, shopifyGraphql } from './auth';
import {
  konteraDag,
  type Betalning,
  type Handelse,
  type OrderHandelse,
  type ReturHandelse,
} from './kontering';

/**
 * Hämtar butikens ordrar, returer, avgifter och utbetalningar och bygger om
 * dagskassorna.
 *
 * Ordrarna hämtas efter senast ändrad, så en retur eller betalning på en
 * gammal order kommer med. Varje order och retur sparas som en händelse i
 * shopify_handelser, omräknad till ören. Verifikationerna byggs sedan om från
 * tabellen, från den tidigaste dag som något ändrats på.
 *
 * Första hämtningen går från årets början. En stor butik hinner inte med allt
 * på en gång: då sparas hur långt vi kom och nästa körning fortsätter därifrån.
 */

const OVERLAP_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Serverless-funktionen får 300 s. Resten går till att bygga dagskassorna. */
const TIDSBUDGET_MS = 200 * 1000;
const CHUNK = 500;

// Så många rader per order ryms i Shopifys kostnadsgräns för en fråga.
const RADER_PER_ORDER = 50;
const ORDERS_QUERY = `
query Ordrar($after: String, $query: String) {
  orders(first: 8, after: $after, query: $query, sortKey: UPDATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      name
      processedAt
      updatedAt
      test
      cancelledAt
      displayFinancialStatus
      currencyCode
      totalPriceSet { shopMoney { amount } }
      totalTipReceivedSet { shopMoney { amount } }
      lineItems(first: ${RADER_PER_ORDER}) {
        pageInfo { hasNextPage }
        nodes {
          isGiftCard
          discountedTotalSet { shopMoney { amount } }
          taxLines { ratePercentage priceSet { shopMoney { amount } } }
        }
      }
      shippingLines(first: 5) {
        nodes {
          discountedPriceSet { shopMoney { amount } }
          taxLines { ratePercentage priceSet { shopMoney { amount } } }
        }
      }
      transactions(first: 20) {
        gateway
        kind
        status
        amountSet { shopMoney { amount } }
      }
      refunds(first: 5) {
        id
        createdAt
        totalRefundedSet { shopMoney { amount } }
        transactions(first: 5) {
          nodes {
            gateway
            kind
            status
            amountSet { shopMoney { amount } }
          }
        }
        refundLineItems(first: 20) {
          nodes {
            subtotalSet { shopMoney { amount } }
            totalTaxSet { shopMoney { amount } }
            lineItem { isGiftCard taxLines { ratePercentage } }
          }
        }
        refundShippingLines(first: 2) {
          nodes {
            subtotalAmountSet { shopMoney { amount } }
            taxAmountSet { shopMoney { amount } }
            shippingLine { taxLines { ratePercentage } }
          }
        }
      }
    }
  }
}`;

const AVGIFTER_QUERY = `
query Avgifter($after: String, $query: String) {
  shopifyPaymentsAccount {
    balanceTransactions(first: 100, after: $after, query: $query, sortKey: PROCESSED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes { id type test transactionDate amount { amount currencyCode } fee { amount } }
    }
  }
}`;

const UTBETALNINGAR_QUERY = `
query Utbetalningar($after: String, $query: String) {
  shopifyPaymentsAccount {
    payouts(first: 100, after: $after, query: $query, sortKey: ISSUED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes { id issuedAt status transactionType net { amount currencyCode } }
    }
  }
}`;

type Money = { shopMoney: { amount: string } } | null | undefined;
const ore = (m: Money) => Math.round(Number(m?.shopMoney.amount ?? 0) * 100);
const oreV2 = (m: { amount: string } | null | undefined) => Math.round(Number(m?.amount ?? 0) * 100);

interface TaxLine { ratePercentage: number; priceSet?: Money }
interface Transaktion { gateway: string; kind: string; status: string; amountSet: Money }
interface ApiOrder {
  id: string;
  name: string;
  processedAt: string;
  updatedAt: string;
  test: boolean;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  currencyCode: string;
  totalPriceSet: Money;
  totalTipReceivedSet: Money;
  lineItems: { pageInfo: { hasNextPage: boolean }; nodes: { isGiftCard: boolean; discountedTotalSet: Money; taxLines: TaxLine[] }[] };
  shippingLines: { nodes: { discountedPriceSet: Money; taxLines: TaxLine[] }[] };
  transactions: Transaktion[];
  refunds: {
    id: string;
    createdAt: string;
    totalRefundedSet: Money;
    transactions: { nodes: Transaktion[] };
    refundLineItems: { nodes: { subtotalSet: Money; totalTaxSet: Money; lineItem: { isGiftCard: boolean; taxLines: { ratePercentage: number }[] } | null }[] };
    refundShippingLines: { nodes: { subtotalAmountSet: Money; taxAmountSet: Money; shippingLine: { taxLines: { ratePercentage: number }[] } | null }[] };
  }[];
}

interface Rad {
  shop: string;
  typ: string;
  extern_id: string;
  datum: string;
  data: object;
  hamtad_at: string;
}

function lyckadeBetalningar(transaktioner: Transaktion[], slag: string[]): Betalning[] {
  const perGateway = new Map<string, number>();
  for (const t of transaktioner) {
    if (t.status !== 'SUCCESS' || !slag.includes(t.kind)) continue;
    perGateway.set(t.gateway, (perGateway.get(t.gateway) ?? 0) + ore(t.amountSet));
  }
  return [...perGateway.entries()].map(([gateway, belopp]) => ({ gateway, belopp }));
}

function laggTill(moms: Record<string, number>, sats: number, belopp: number) {
  if (!belopp) return;
  const key = String(sats);
  moms[key] = (moms[key] ?? 0) + belopp;
}

/** En order blir en orderhändelse plus en returhändelse per återbetalning. */
function tolkaOrder(o: ApiOrder, shop: string, hamtad: string): Rad[] {
  // Testordrar och avbrutna ordrar som aldrig betalades är inte försäljning
  if (o.test) return [];
  const status = o.displayFinancialStatus ?? '';
  if (status === 'VOIDED' || status === 'EXPIRED') return [];

  const moms: Record<string, number> = {};
  const fordelning: Record<string, number> = {};
  let presentkort = 0;
  let momsfritt = false;
  const rader = [
    ...o.lineItems.nodes,
    ...o.shippingLines.nodes.map((l) => ({ isGiftCard: false, discountedTotalSet: l.discountedPriceSet, taxLines: l.taxLines })),
  ];
  for (const rad of rader) {
    if (rad.isGiftCard) {
      presentkort += ore(rad.discountedTotalSet);
      continue;
    }
    const skatt = rad.taxLines.filter((t) => ore(t.priceSet));
    if (!skatt.length && ore(rad.discountedTotalSet)) momsfritt = true;
    for (const t of skatt) {
      const belopp = ore(t.priceSet);
      laggTill(moms, t.ratePercentage, belopp);
      if (t.ratePercentage) laggTill(fordelning, t.ratePercentage, Math.round((belopp * (100 + t.ratePercentage)) / t.ratePercentage));
    }
  }

  const total = ore(o.totalPriceSet);
  const dricks = ore(o.totalTipReceivedSet);
  const taxat = Object.values(fordelning).reduce((a, b) => a + b, 0);
  laggTill(fordelning, 0, total - dricks - presentkort - taxat);

  const betalningar = lyckadeBetalningar(o.transactions, ['SALE', 'CAPTURE']);
  // Avbruten och obetald: ingen försäljning. Avbruten och betald: returen tar ut den.
  if (o.cancelledAt && betalningar.length === 0) return [];

  const order: OrderHandelse = {
    ordernamn: o.name,
    total,
    dricks,
    presentkort,
    moms,
    momsfritt,
    betalningar,
    ofullstandig: o.lineItems.pageInfo.hasNextPage || undefined,
  };
  const ut: Rad[] = [{
    shop,
    typ: 'order',
    extern_id: o.id,
    datum: svenskDag(new Date(o.processedAt)),
    data: { ...order, valuta: o.currencyCode },
    hamtad_at: hamtad,
  }];

  for (const r of o.refunds) {
    const rMoms: Record<string, number> = {};
    let rPresentkort = 0;
    let rMomsfritt = false;
    for (const rl of r.refundLineItems.nodes) {
      if (rl.lineItem?.isGiftCard) {
        rPresentkort += ore(rl.subtotalSet) + ore(rl.totalTaxSet);
        continue;
      }
      const skatt = ore(rl.totalTaxSet);
      const sats = rl.lineItem?.taxLines[0]?.ratePercentage ?? 0;
      if (skatt && sats) laggTill(rMoms, sats, skatt);
      else if (ore(rl.subtotalSet)) rMomsfritt = true;
    }
    for (const rs of r.refundShippingLines.nodes) {
      const skatt = ore(rs.taxAmountSet);
      const sats = rs.shippingLine?.taxLines[0]?.ratePercentage ?? 0;
      if (skatt && sats) laggTill(rMoms, sats, skatt);
      else if (ore(rs.subtotalAmountSet)) rMomsfritt = true;
    }

    const retur: ReturHandelse = {
      ordernamn: o.name,
      total: ore(r.totalRefundedSet),
      dricks: 0,
      presentkort: rPresentkort,
      moms: rMoms,
      momsfritt: rMomsfritt,
      betalningar: lyckadeBetalningar(r.transactions.nodes, ['REFUND']),
      fordelning,
    };
    if (!retur.total) continue;
    ut.push({
      shop,
      typ: 'retur',
      extern_id: r.id,
      datum: svenskDag(new Date(r.createdAt)),
      data: { ...retur, valuta: o.currencyCode },
      hamtad_at: hamtad,
    });
  }
  return ut;
}

async function sparaRader(supabase: SupabaseClient, rader: Rad[]) {
  for (let i = 0; i < rader.length; i += CHUNK) {
    const { error } = await supabase.from('shopify_handelser').upsert(rader.slice(i, i + CHUNK), { onConflict: 'shop,typ,extern_id' });
    if (error) throw new Error(`Kunde inte spara Shopify-händelser: ${error.message}`);
  }
}

/** Sökfilter för Shopify: tidpunkten måste stå inom citattecken. */
const efter = (falt: string, d: Date) => `${falt}:>='${d.toISOString()}'`;

interface Hamtning {
  rader: Rad[];
  /** Tidpunkten vi kom fram till om tiden tog slut, annars null. */
  avbrutenVid: string | null;
}

async function hamtaOrdrar(shop: string, token: string, from: Date, deadline: number, hamtad: string): Promise<Hamtning & { ordrar: number }> {
  const rader: Rad[] = [];
  let ordrar = 0;
  let after: string | null = null;
  let senast: string | null = null;
  for (;;) {
    if (Date.now() > deadline && senast) return { rader, ordrar, avbrutenVid: senast };
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ApiOrder[] } } =
      await shopifyGraphql(shop, token, ORDERS_QUERY, { after, query: efter('updated_at', from) });
    for (const o of data.orders.nodes) {
      rader.push(...tolkaOrder(o, shop, hamtad));
      senast = o.updatedAt;
      ordrar++;
    }
    if (!data.orders.pageInfo.hasNextPage) return { rader, ordrar, avbrutenVid: null };
    after = data.orders.pageInfo.endCursor;
  }
}

type Konto<N> = { shopifyPaymentsAccount: { [k: string]: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: N[] } } | null };

/** Butiker utan Shopify Payments har inget konto — då finns inget att hämta. */
async function hamtaKonto<N>(shop: string, token: string, query: string, falt: string, filter: string): Promise<N[]> {
  const ut: N[] = [];
  let after: string | null = null;
  for (;;) {
    const data: Konto<N> = await shopifyGraphql(shop, token, query, { after, query: filter });
    const conn = data.shopifyPaymentsAccount?.[falt];
    if (!conn) return ut;
    ut.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) return ut;
    after = conn.pageInfo.endCursor;
  }
}

async function hamtaShopifyPayments(shop: string, token: string, from: Date, hamtad: string): Promise<Rad[]> {
  const [avgifter, utbetalningar] = await Promise.all([
    hamtaKonto<{ id: string; type: string; test: boolean; transactionDate: string; amount: { amount: string; currencyCode: string }; fee: { amount: string } }>(
      shop, token, AVGIFTER_QUERY, 'balanceTransactions', efter('processed_at', from)),
    hamtaKonto<{ id: string; issuedAt: string; status: string; transactionType: string; net: { amount: string; currencyCode: string } }>(
      shop, token, UTBETALNINGAR_QUERY, 'payouts', efter('issued_at', from)),
  ]);

  const rader: Rad[] = [];
  for (const t of avgifter) {
    if (t.test) continue;
    rader.push({
      shop,
      typ: 'avgift',
      extern_id: t.id,
      datum: svenskDag(new Date(t.transactionDate)),
      data: { typ: t.type, belopp: oreV2(t.amount), avgift: oreV2(t.fee), valuta: t.amount.currencyCode },
      hamtad_at: hamtad,
    });
  }
  for (const p of utbetalningar) {
    // Schemalagda har inte lämnat kontot än; misslyckade och avbrutna kom aldrig fram
    if (p.status !== 'PAID' && p.status !== 'IN_TRANSIT') continue;
    const belopp = Math.abs(oreV2(p.net));
    rader.push({
      shop,
      typ: 'utbetalning',
      extern_id: p.id,
      datum: svenskDag(new Date(p.issuedAt)),
      data: { belopp: p.transactionType === 'WITHDRAWAL' ? -belopp : belopp, valuta: p.net.currencyCode },
      hamtad_at: hamtad,
    });
  }
  return rader;
}

export interface ShopifySyncResult {
  ordrar: number;
  dagar: number;
  ohanterade: number;
  /** Fler ordrar återstår — nästa körning fortsätter. */
  klar: boolean;
}

export async function synkaShopify(supabase: SupabaseClient, shop: string): Promise<ShopifySyncResult> {
  const { data: butik, error } = await supabase
    .from('shopify_butiker')
    .select('user_id, synkad_till')
    .eq('shop', shop)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa Shopify-butiken: ${error.message}`);
  if (!butik?.user_id) throw new Error('Butiken är inte kopplad till något konto');

  try {
    const result = await synka(supabase, shop, butik.user_id, butik.synkad_till);
    await supabase.from('shopify_butiker').update({
      senast_synkad_at: new Date().toISOString(),
      senaste_fel: null,
    }).eq('shop', shop);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Okänt fel';
    await supabase.from('shopify_butiker').update({ senaste_fel: message }).eq('shop', shop);
    throw err;
  }
}

async function synka(supabase: SupabaseClient, shop: string, userId: string, synkadTill: string | null): Promise<ShopifySyncResult> {
  const now = new Date();
  const deadline = Date.now() + TIDSBUDGET_MS;
  const hamtad = now.toISOString();
  const from = synkadTill
    ? new Date(new Date(synkadTill).getTime() - OVERLAP_DAYS * DAY_MS)
    : new Date(`${svenskDag(now).slice(0, 4)}-01-01T00:00:00+01:00`);

  const token = await accessTokenFor(supabase, shop);
  const ordrar = await hamtaOrdrar(shop, token, from, deadline, hamtad);
  const betaltjanst = await hamtaShopifyPayments(shop, token, from, hamtad);
  const rader = [...ordrar.rader, ...betaltjanst];
  await sparaRader(supabase, rader);

  // Allt från den tidigaste dag som fick en ny eller ändrad händelse byggs om
  const fromDag = [svenskDag(from), ...rader.map((r) => r.datum)].sort()[0];
  const { dagar, ohanterade } = await byggDagskassor(supabase, shop, userId, fromDag);

  // Kom vi inte ända fram fortsätter nästa körning där ordrarna tog slut
  const nyttSynkdatum = ordrar.avbrutenVid
    ? new Date(new Date(ordrar.avbrutenVid).getTime() + OVERLAP_DAYS * DAY_MS).toISOString()
    : now.toISOString();
  const { error } = await supabase.from('shopify_butiker').update({ synkad_till: nyttSynkdatum }).eq('shop', shop);
  if (error) throw new Error(`Kunde inte spara synkdatum: ${error.message}`);

  return { ordrar: ordrar.ordrar, dagar, ohanterade, klar: !ordrar.avbrutenVid };
}

async function byggDagskassor(supabase: SupabaseClient, shop: string, userId: string, fromDag: string) {
  const perDag = new Map<string, { handelser: Handelse[]; valutor: Set<string> }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('shopify_handelser')
      .select('typ, datum, data')
      .eq('shop', shop)
      .gte('datum', fromDag)
      .order('datum')
      .range(from, from + 999);
    if (error) throw new Error(`Kunde inte läsa Shopify-händelser: ${error.message}`);
    for (const h of data ?? []) {
      let d = perDag.get(h.datum);
      if (!d) perDag.set(h.datum, (d = { handelser: [], valutor: new Set() }));
      d.handelser.push({ typ: h.typ, data: h.data } as Handelse);
      if (h.data?.valuta) d.valutor.add(h.data.valuta);
    }
    if ((data ?? []).length < 1000) break;
  }

  const kassor: NyDagskassa[] = [];
  let ohanterade = 0;
  for (const [datum, d] of [...perDag.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const kassa = konteraDag(d.handelser);
    ohanterade += kassa.ohanterade.length;

    let text = `Shopify dagskassa ${datum} (${kassa.ordrar} ordrar)`;
    if (kassa.ohanterade.length) text += ` – kontrollera: ${kassa.ohanterade.join(', ')}`;
    const utlandsk = [...d.valutor].filter((v) => v !== 'SEK');
    if (utlandsk.length) text += ` – valuta ${utlandsk.join(', ')}`;

    kassor.push({ datum, text, externId: `shopify|${shop}|${datum}`, rader: kassa.rader });
  }

  const dagar = await ersattDagskassor(supabase, userId, 'shopify', 'S', 'Shopify', fromDag, kassor);
  return { dagar, ohanterade };
}

/** För cron: alla aktiva, kopplade butiker, en i taget. Ett fel stoppar inte de andra. */
export async function synkaAllaShopify(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('shopify_butiker')
    .select('shop')
    .eq('status', 'aktiv')
    .not('user_id', 'is', null);
  if (error) throw new Error(`Kunde inte läsa Shopify-butiker: ${error.message}`);
  const out = { synkade: 0, fel: 0 };
  for (const { shop } of data ?? []) {
    try {
      await synkaShopify(supabase, shop);
      out.synkade++;
    } catch (err) {
      console.error('[shopify] synk misslyckades för', shop, err);
      out.fel++;
    }
  }
  return out;
}
