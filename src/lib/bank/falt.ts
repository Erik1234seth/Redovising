import type { EbTransaktion } from './enablebanking';

/**
 * Det banken skickar om en transaktion utöver datum, belopp och text, i fasta
 * fält. Läses ur bankens hela svar (bank_transaktioner.data), så det gäller
 * även rader som hämtades innan fälten fanns. Det banken inte skickar lämnas
 * bort — många banker fyller bara i en del, Handelsbanken nästan inget.
 */
export interface BankFalt {
  /** Dagen köpet gjordes. Kortköp bokförs ofta 1–5 dagar senare. */
  kopdag?: string;
  /** OCR-nummer eller annan betalningsreferens */
  ocr?: string;
  /** Beloppet i den valuta köpet gjordes i, när banken växlat */
  utlandskt_belopp?: { belopp: number; valuta: string; kurs?: number };
  /** Motpartens kontonummer: IBAN, eller bankgiro/plusgiro m.m. */
  motpart_konto?: string;
  motpart_namn?: string;
  /** Transaktionstyp enligt banken, t.ex. "Kortköp/uttag" */
  typ?: string;
  /** Branschkod (MCC) för kortköp */
  branschkod?: string;
}

function text(v: unknown): string | undefined {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function konto(k: EbTransaktion['creditor_account']): string | undefined {
  return text(k?.iban) ?? text(k?.other?.identification);
}

/**
 * egetKonto: kontonumret transaktionen ligger på. En del banker skriver det i
 * motpartens kontofält, och då är det ingen uppgift om motparten.
 */
export function bankFalt(t: EbTransaktion, egetKonto?: string | null): BankFalt {
  const inkommande = t.credit_debit_indicator === 'CRDT';
  const motpart = inkommande ? t.debtor : t.creditor;
  const motpartKonto = inkommande ? t.debtor_account : t.creditor_account;

  const out: BankFalt = {};
  const kopdag = text(t.transaction_date);
  if (kopdag) out.kopdag = kopdag;

  const ocr = text(t.reference_number);
  if (ocr) out.ocr = ocr;

  const instruerat = t.exchange_rate?.instructed_amount;
  const belopp = instruerat ? parseFloat(instruerat.amount) : NaN;
  if (instruerat?.currency && Number.isFinite(belopp)) {
    const kurs = parseFloat(t.exchange_rate?.exchange_rate ?? '');
    out.utlandskt_belopp = { belopp: Math.abs(belopp), valuta: instruerat.currency, ...(Number.isFinite(kurs) ? { kurs } : {}) };
  }

  const kontonr = konto(motpartKonto);
  const normal = (s: string) => s.replace(/\s/g, '').toUpperCase();
  if (kontonr && (!egetKonto || normal(kontonr) !== normal(egetKonto))) out.motpart_konto = kontonr;

  const namn = text(motpart?.name);
  if (namn) out.motpart_namn = namn;

  const typ = text(t.bank_transaction_code?.description) ?? text(t.bank_transaction_code?.code);
  if (typ) out.typ = typ;

  const mcc = text(t.merchant_category_code);
  if (mcc) out.branschkod = mcc;

  return out;
}
