/**
 * Felen kunden får se från bankkopplingen. De tekniska felen (saknade nycklar,
 * svar från Enable Banking, databasfel) loggas och sparas i senaste_fel för
 * byrån, men kunden får bara veta vad som hände och vad hen kan göra.
 * Ett utgånget medgivande är det enda kunden själv kan åtgärda, så det sägs rakt ut.
 */

export const BANKERNA_FEL = 'Det gick inte att hämta listan med banker just nu. Försök igen om en stund.';
export const KOPPLA_FEL = 'Det gick inte att starta bankkopplingen just nu. Försök igen om en stund.';
export const HAMTA_FEL = 'Det gick inte att hämta från banken just nu. Försök igen om en stund, eller hör av dig om det fortsätter.';

export function kundfel(text: string | null | undefined): string | null {
  if (!text) return null;
  if (/medgivande/i.test(text)) return 'Bankens medgivande har gått ut. Koppla om banken.';
  return HAMTA_FEL;
}
