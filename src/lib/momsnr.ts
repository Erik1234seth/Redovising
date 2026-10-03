/**
 * Momsregistreringsnumret räknat ur organisationsnumret: SE, orgnumrets tio
 * siffror och 01. Gäller både enskild firma (där orgnumret är personnumret)
 * och aktiebolag. Ett personnummer med sekelsiffror kortas till tio siffror.
 */
export function momsnrFranOrgnr(orgNr: string | null | undefined): string | null {
  const siffror = (orgNr ?? '').replace(/\D/g, '');
  if (siffror.length !== 10 && siffror.length !== 12) return null;
  return `SE${siffror.slice(-10)}01`;
}
