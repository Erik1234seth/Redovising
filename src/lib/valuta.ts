// Valutor som fakturor och offerter kan skrivas i. SEK är standard.

export const VALUTOR = [
  { kod: 'SEK', namn: 'Svenska kronor' },
  { kod: 'EUR', namn: 'Euro' },
  { kod: 'USD', namn: 'Amerikanska dollar' },
  { kod: 'GBP', namn: 'Brittiska pund' },
  { kod: 'NOK', namn: 'Norska kronor' },
  { kod: 'DKK', namn: 'Danska kronor' },
  { kod: 'CHF', namn: 'Schweiziska franc' },
  { kod: 'JPY', namn: 'Japanska yen' },
] as const;

export type Valuta = typeof VALUTOR[number]['kod'];

export const STANDARD_VALUTA: Valuta = 'SEK';

export function valutaEtikett(valuta: string | null | undefined) {
  return !valuta || valuta === 'SEK' ? 'kr' : valuta;
}

// Yen skrivs utan decimaler
const UTAN_DECIMALER = ['JPY'];

export function formatBelopp(n: number, valuta?: string | null, decimaler = 2) {
  if (valuta && UTAN_DECIMALER.includes(valuta)) decimaler = 0;
  return n.toLocaleString('sv-SE', { minimumFractionDigits: decimaler, maximumFractionDigits: decimaler }) + ' ' + valutaEtikett(valuta);
}
