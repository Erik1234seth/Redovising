/**
 * Normalisering av telefonnummer till E.164 (+46701234567).
 *
 * Twilio skickar alltid E.164 i `From`, så inkommande nummer är redan rätt.
 * Det här behövs för andra hållet: nummer som människor knappat in i
 * contact_requests, meetings och profiles är skrivna hur som helst
 * ("070-123 45 67", "0046 70 1234567", "+46 70 123 45 67") och måste
 * kokas ned till samma form innan vi kan matcha på dem.
 */

const DEFAULT_COUNTRY = '46'; // Sverige

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Behåll ett inledande plus, släng allt annat som inte är siffra
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) return null;

  if (!hasPlus) {
    if (digits.startsWith('00')) {
      // 0046701234567 → 46701234567
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      // 0701234567 → 46701234567
      digits = DEFAULT_COUNTRY + digits.slice(1);
    } else if (digits.length <= 9) {
      // 701234567 → 46701234567 (nummer utan riktnummer eller nolla)
      digits = DEFAULT_COUNTRY + digits;
    }
    // Annars: antas redan innehålla landskod
  }

  // Rimlighetskoll — E.164 tillåter 8–15 siffror
  if (digits.length < 8 || digits.length > 15) return null;

  return `+${digits}`;
}

/** Visningsformat för admin: +46701234567 → 070-123 45 67 */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+46(\d{2,3})(\d{3})(\d{2})(\d{2})$/);
  if (m) return `0${m[1]}-${m[2]} ${m[3]} ${m[4]}`;
  return e164;
}
