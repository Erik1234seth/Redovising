import { MOMSKONTON, Summor, type Konteringsrad } from '../dagskassa';

/**
 * Gör om en dags Shopify-händelser till en verifikation — en dagskassa.
 *
 * Händelserna har redan räknats om till ören när de hämtades (se sync.ts):
 *  - order: försäljningen bokas den dag ordern lades. Kredit intäkt och
 *    utgående moms per momssats, debet det kunden betalade per betalsätt.
 *    Det som inte är betalt än (faktura, manuell betalning) blir kundfordran.
 *  - retur: återbetalningen bokas den dag den gjordes, med omvända tecken.
 *  - avgift: Shopify Payments avgift per transaktion, mot 1580.
 *  - utbetalning: från Shopify Payments till banken, mot 1580.
 *
 * Nettot per momssats räknas fram ur momsen, som i Zettle-konteringen. Det
 * som blir kvar är momsfri försäljning, eller bara avrundning.
 */

export interface Betalning {
  gateway: string;
  belopp: number;
}

export interface Forsaljning {
  /** Det kunden betalade för ordern (eller fick tillbaka vid retur), inklusive moms. */
  total: number;
  dricks: number;
  presentkort: number;
  /** Moms per momssats i procent. */
  moms: Record<string, number>;
  /** Ordern innehåller varor eller frakt utan moms. */
  momsfritt: boolean;
  betalningar: Betalning[];
}

export interface OrderHandelse extends Forsaljning {
  ordernamn: string;
  /** Fler rader än vi hämtade — ordern kan vara ofullständigt bokförd. */
  ofullstandig?: boolean;
}

export interface ReturHandelse extends Forsaljning {
  ordernamn: string;
  /** Orderns försäljning inklusive moms per momssats ('0' = momsfritt), för returer utan varurader. */
  fordelning: Record<string, number>;
}

export interface AvgiftHandelse {
  typ: string;
  belopp: number;
  avgift: number;
}

export interface UtbetalningHandelse {
  /** Positivt när pengar går till banken, negativt när Shopify drar från den. */
  belopp: number;
}

export type Handelse =
  | { typ: 'order'; data: OrderHandelse }
  | { typ: 'retur'; data: ReturHandelse }
  | { typ: 'avgift'; data: AvgiftHandelse }
  | { typ: 'utbetalning'; data: UtbetalningHandelse };

/** Vart pengarna tar vägen för varje betalsätt. */
function betalkonto(gateway: string): string {
  const g = gateway.toLowerCase();
  // Presentkort löser in en skuld som bokades när kortet såldes
  if (g === 'gift_card') return '2420';
  // Swish via en betaltjänst hamnar direkt på bankkontot
  if (g.includes('swish')) return '1930';
  // Manuella betalsätt (faktura, bankinsättning, postförskott): pengarna kommer senare
  if (g === 'manual' || g.includes('cash on delivery') || g.includes('bank') || g.includes('invoice') || g.includes('faktura')) return '1510';
  // Shopify Payments, PayPal, Klarna, Stripe m.fl. — pengarna ligger hos betaltjänsten
  return '1580';
}

/** Dricks är inte försäljning, samma val som för Zettle. */
const DRICKSKONTO = '2890';
/** Utländsk moms (OSS) har inget eget konto än — bokas här och flaggas. */
const OSS = { intakt: '3106', moms: '2890' };

/**
 * Bokar försäljningssidan av en order (tecken -1, kredit) eller retur (+1, debet).
 * Returnerar de momssatser som inte är svenska.
 */
function bokaForsaljning(f: Forsaljning, tecken: 1 | -1, s: Summor, fordelning?: Record<string, number>): number[] {
  const utlandska: number[] = [];
  s.add(DRICKSKONTO, tecken * f.dricks);
  s.add('2420', tecken * f.presentkort);

  const intakter: Record<string, number> = {};
  let kvar = f.total - f.dricks - f.presentkort;
  let storsta: { konto: string; netto: number } | null = null;
  const bokaSats = (sats: number, moms: number) => {
    const konton = MOMSKONTON[sats] ?? OSS;
    if (!MOMSKONTON[sats]) utlandska.push(sats);
    const netto = Math.round((moms * 100) / sats);
    s.add(konton.moms, tecken * moms);
    s.add(konton.intakt, tecken * netto);
    intakter[konton.intakt] = (intakter[konton.intakt] ?? 0) + netto;
    kvar -= moms + netto;
    if (!storsta || Math.abs(netto) > Math.abs(storsta.netto)) storsta = { konto: konton.intakt, netto };
  };

  for (const [satsText, moms] of Object.entries(f.moms)) {
    const sats = Number(satsText);
    if (sats && moms) bokaSats(sats, moms);
  }

  // En retur utan varurader (bara ett belopp) fördelas som ordern var fördelad
  if (fordelning && Math.abs(kvar) > 100) {
    const orderTotal = Object.values(fordelning).reduce((a, b) => a + b, 0);
    if (orderTotal) {
      const rest = kvar;
      for (const [satsText, brutto] of Object.entries(fordelning)) {
        const sats = Number(satsText);
        if (!sats || !brutto) continue;
        const andel = Math.round((rest * brutto) / orderTotal);
        bokaSats(sats, Math.round((andel * sats) / (100 + sats)));
      }
    }
  }

  const s2 = storsta as { konto: string; netto: number } | null;
  if (!f.momsfritt && s2 && Math.abs(kvar) <= 100) s.add(s2.konto, tecken * kvar);
  else s.add('3004', tecken * kvar);
  return utlandska;
}

function bokaBetalningar(f: Forsaljning, tecken: 1 | -1, s: Summor) {
  let betalt = 0;
  for (const b of f.betalningar) {
    s.add(betalkonto(b.gateway), tecken * b.belopp);
    betalt += b.belopp;
  }
  // Det som inte betalats (eller inte betalats tillbaka) än är en fordran på kunden
  s.add('1510', tecken * (f.total - betalt));
}

/** Transaktionstyper hos Shopify Payments vars belopp redan bokas via order, retur eller utbetalning. */
const TACKTA_TYPER = new Set(['CHARGE', 'REFUND', 'PAYOUT', 'PAYOUT_FAILURE', 'PAYOUT_CANCELLATION']);

export interface Dagskassa {
  rader: Konteringsrad[];
  /** Sådant som inte kunde bokas säkert och bör ses över. */
  ohanterade: string[];
  ordrar: number;
}

export function konteraDag(handelser: Handelse[]): Dagskassa {
  const s = new Summor();
  const ohanterade = new Set<string>();
  let ordrar = 0;

  for (const h of handelser) {
    switch (h.typ) {
      case 'order': {
        ordrar++;
        bokaBetalningar(h.data, 1, s);
        for (const sats of bokaForsaljning(h.data, -1, s)) ohanterade.add(`utländsk moms ${sats} %`);
        if (h.data.ofullstandig) ohanterade.add(`order ${h.data.ordernamn} har fler rader än vad som hämtades`);
        break;
      }
      case 'retur': {
        bokaBetalningar(h.data, -1, s);
        for (const sats of bokaForsaljning(h.data, 1, s, h.data.fordelning)) ohanterade.add(`utländsk moms ${sats} %`);
        break;
      }
      case 'avgift': {
        s.add('6570', h.data.avgift);
        s.add('1580', -h.data.avgift);
        if (!TACKTA_TYPER.has(h.data.typ) && h.data.belopp) ohanterade.add(`Shopify Payments ${h.data.typ}`);
        break;
      }
      case 'utbetalning': {
        s.add('1930', h.data.belopp);
        s.add('1580', -h.data.belopp);
        break;
      }
    }
  }

  // Går Shopifys siffror inte jämnt ut syns det på 3740 i stället för att verifikationen blir obalanserad
  s.add('3740', -s.total());

  return { rader: s.rader(), ohanterade: [...ohanterade], ordrar };
}
