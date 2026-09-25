/**
 * Gör om en dags Zettle-data till en verifikation — en "dagskassa".
 *
 * Köpen (Purchase API) ger försäljningen: intäkt och utgående moms per
 * momssats på kreditsidan, och på debetsidan det betalsätt kunden betalade med.
 * Kortbetalningar hamnar på 1580 (fordran på Zettle) tills Zettle betalar ut.
 *
 * Kontohändelserna (Finance API) ger det som händer med pengarna hos Zettle:
 * avgifter och utbetalningar till banken, båda mot 1580. PAYMENT-händelserna
 * hoppas över — det är samma kortbetalningar som redan bokats via köpen.
 *
 * Allt räknas i ören och avrundas först när raderna byggs, så att
 * verifikationen alltid balanserar på öret. Återbetalningar har negativa
 * belopp i Zettle och vänder därmed tecknen av sig själva.
 */

export interface ZettleProduct {
  type?: string;
  quantity?: string;
  unitPrice?: number;
  discountValue?: number;
  vatPercentage?: number;
}

export interface ZettlePayment {
  type: string;
  amount: number;
  gratuityAmount?: number;
}

export interface ZettlePurchase {
  amount: number;
  vatAmount: number;
  groupedVatAmounts?: Record<string, number>;
  products?: ZettleProduct[];
  payments?: ZettlePayment[];
}

export interface Kontohandelse {
  typ: string;
  belopp: number;
}

export interface Konteringsrad {
  konto: string;
  kontonamn: string;
  /** Kronor, debet positivt och kredit negativt — samma som SIE-importen. */
  belopp: number;
}

const KONTONAMN: Record<string, string> = {
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
  '3740': 'Öres- och kronutjämning',
  '6570': 'Bankkostnader',
};

const MOMSKONTON: Record<number, { intakt: string; moms: string }> = {
  25: { intakt: '3001', moms: '2611' },
  12: { intakt: '3002', moms: '2621' },
  6: { intakt: '3003', moms: '2631' },
};

/** Vart pengarna tar vägen för varje betalsätt. */
function betalkonto(typ: string): string {
  switch (typ) {
    case 'IZETTLE_CASH':
      return '1910';
    // Swish går direkt till kundens bank, inte via Zettle-kontot
    case 'SWISH':
      return '1930';
    case 'IZETTLE_INVOICE':
      return '1510';
    // Presentkort och tillgodokvitton löser in en skuld som bokades när de såldes
    case 'GIFTCARD':
    case 'STORE_CREDIT':
      return '2420';
    // Kort, onlinekort, PayPal och Klarna — pengarna går via Zettle
    default:
      return '1580';
  }
}

/**
 * Motkontot till 1580 för varje typ av kontohändelse. Typer som saknas här
 * (förskott, frysta medel, justeringar) bokas inte automatiskt utan räknas
 * upp som ohanterade, så att någon tittar på dem.
 */
const HANDELSEKONTO: Record<string, string | null> = {
  PAYMENT: null,
  PAYMENT_FEE: '6570',
  INVOICE_PAYMENT_FEE: '6570',
  CASHBACK: '6570',
  PAYOUT: '1930',
  FAILED_PAYOUT: '1930',
  INVOICE_PAYMENT: '1510',
};

/** Dricks är personalens pengar, inte försäljning. */
const DRICKSKONTO = '2890';

class Summor {
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

function konteraKop(p: ZettlePurchase, s: Summor) {
  // Debet: det kunden betalade, per betalsätt. Betalningarna räknas med
  // dricksen, så försäljningen blir betalt minus dricks — oavsett om Zettle
  // tar med dricksen i köpets amount eller inte
  let betalt = 0;
  let dricks = 0;
  if (p.payments?.length) {
    for (const pay of p.payments) {
      s.add(betalkonto(pay.type), pay.amount);
      betalt += pay.amount;
      dricks += pay.gratuityAmount ?? 0;
    }
  } else {
    s.add('1580', p.amount);
    betalt = p.amount;
  }
  s.add(DRICKSKONTO, -dricks);
  const forsaljning = betalt - dricks;

  // Sålda presentkort är en skuld tills de används, inte en intäkt
  const presentkort = (p.products ?? [])
    .filter((r) => r.type === 'GIFTCARD')
    .reduce((sum, r) => sum + Math.round((r.unitPrice ?? 0) * Number(r.quantity ?? 1)) - (r.discountValue ?? 0), 0);
  s.add('2420', -presentkort);

  // Intäkt och moms per momssats. Nettot räknas fram ur momsen — det är den
  // Zettle redovisar per sats och den som ska stämma mot momsdeklarationen.
  let nettoKvar = forsaljning - p.vatAmount - presentkort;
  let storstaIntakt: { konto: string; netto: number } | null = null;
  for (const [satsText, moms] of Object.entries(p.groupedVatAmounts ?? {})) {
    const sats = Number(satsText);
    if (!sats || !moms) continue;
    const konton = MOMSKONTON[sats] ?? MOMSKONTON[25];
    const netto = Math.round((moms * 100) / sats);
    s.add(konton.moms, -moms);
    s.add(konton.intakt, -netto);
    nettoKvar -= netto;
    if (!storstaIntakt || Math.abs(netto) > Math.abs(storstaIntakt.netto)) storstaIntakt = { konto: konton.intakt, netto };
  }

  // Det som blir kvar är momsfri försäljning — eller bara avrundning, när
  // köpet saknar momsfria varor och resten är några ören
  const harMomsfritt = (p.products ?? []).some((r) => r.type !== 'GIFTCARD' && !r.vatPercentage);
  if (!harMomsfritt && storstaIntakt && Math.abs(nettoKvar) <= 100) s.add(storstaIntakt.konto, -nettoKvar);
  else s.add('3004', -nettoKvar);
}

export interface Dagskassa {
  rader: Konteringsrad[];
  /** Kontohändelser som inte bokades automatiskt, t.ex. förskott eller frysta medel. */
  ohanterade: Kontohandelse[];
}

export function konteraDag(kop: ZettlePurchase[], handelser: Kontohandelse[]): Dagskassa {
  const s = new Summor();
  for (const p of kop) konteraKop(p, s);

  const ohanterade: Kontohandelse[] = [];
  for (const h of handelser) {
    const motkonto = HANDELSEKONTO[h.typ];
    if (motkonto === null) continue;
    if (motkonto === undefined) {
      ohanterade.push(h);
      continue;
    }
    // Pengar in på Zettle-kontot är positiva: 1580 ökar, motkontot krediteras
    s.add('1580', h.belopp);
    s.add(motkonto, -h.belopp);
  }

  // Ska inte hända, men om Zettles siffror inte går jämnt ut syns det på
  // 3740 i stället för att verifikationen blir obalanserad
  s.add('3740', -s.total());

  return { rader: s.rader(), ohanterade };
}
