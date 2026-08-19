import type { IncomingLead } from './lead';
import { normalizePhone } from './phone';

/**
 * Zapier skickar leadet med de fältnamn som råkar stå i Facebook-formuläret,
 * och de skiljer sig mellan formulär och språk. Istället för att låsa Zapen vid
 * en exakt mappning plockar vi isär hela payloaden och letar efter nycklar som
 * betyder rätt sak. Skicka in allt — det som inte känns igen ignoreras.
 */

/** Kandidatnycklar per fält, i fallande prioritet. Jämförs normaliserat. */
const FIELDS = {
  phone: ['phonenumber', 'phone', 'telefonnummer', 'telefon', 'mobilnummer', 'mobil', 'mobile', 'tel'],
  email: ['email', 'emailaddress', 'epost', 'epostadress', 'mail'],
  name: ['fullname', 'name', 'namn', 'fullstandigtnamn'],
  firstName: ['firstname', 'fornamn'],
  lastName: ['lastname', 'efternamn'],
  externalId: ['leadgenid', 'leadid', 'id'],
  createdTime: ['createdtime', 'createdat', 'created', 'timestamp', 'skapad'],
  formName: ['formname', 'form', 'formularnamn', 'campaignname', 'adname'],
} as const;

/** "Phone Number", "phone_number" och "phoneNumber" ska alla bli "phonenumber". */
function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // "förnamn" → "fornamn"
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Plattar ut nästlade objekt så att `{ lead: { email: ... } }` fungerar lika bra
 * som `{ email: ... }`. Hanterar även Metas eget format, där fälten ligger som
 * `field_data: [{ name, values }]`.
 */
export function flattenPayload(
  input: unknown,
  out: Map<string, string> = new Map(),
  depth = 0,
): Map<string, string> {
  if (depth > 4 || !input || typeof input !== 'object') return out;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'string' || typeof value === 'number') {
      const k = normalizeKey(key);
      // Första förekomsten vinner — ytligare nycklar är mer sannolikt rätt
      if (k && !out.has(k)) out.set(k, String(value).trim());
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && 'name' in item && 'values' in item) {
          const entry = item as { name?: unknown; values?: unknown };
          const k = normalizeKey(String(entry.name ?? ''));
          const v = Array.isArray(entry.values) ? entry.values[0] : entry.values;
          if (k && v != null && !out.has(k)) out.set(k, String(v).trim());
        } else {
          flattenPayload(item, out, depth + 1);
        }
      }
    } else {
      flattenPayload(value, out, depth + 1);
    }
  }
  return out;
}

function pick(fields: Map<string, string>, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const value = fields.get(candidate);
    if (value) return value;
  }
  return null;
}

/**
 * Zapiers fältmeny saknar ibland leadets id. Då byggs ett eget av tidpunkten
 * leadet skapades plus telefonnumret: kombinationen är unik per lead, och —
 * det viktiga — oförändrad om Zapen körs om, vilket är precis vad dedupen
 * behöver. Saknas även tidpunkten får dygnsregeln i handleNewLead ta över.
 */
function syntheticId(fields: Map<string, string>, phone: string | null): string | null {
  const created = pick(fields, FIELDS.createdTime);
  const normalized = normalizePhone(phone);
  if (!created || !normalized) return null;
  return `fb:${created}:${normalized}`;
}

/** Tolkar en inkommande payload som ett lead. Returnerar även nycklarna, så att
 *  ett formulär med oväntade fältnamn går att felsöka ur svaret. */
export function mapLeadPayload(payload: unknown): { lead: IncomingLead; keys: string[] } {
  const fields = flattenPayload(payload);
  const splitName = [pick(fields, FIELDS.firstName), pick(fields, FIELDS.lastName)]
    .filter(Boolean)
    .join(' ');
  const phone = pick(fields, FIELDS.phone);

  return {
    lead: {
      externalId: pick(fields, FIELDS.externalId) ?? syntheticId(fields, phone),
      name: pick(fields, FIELDS.name) ?? (splitName || null),
      email: pick(fields, FIELDS.email),
      phone,
      formName: pick(fields, FIELDS.formName),
      ref: 'facebook',
    },
    keys: [...fields.keys()],
  };
}
