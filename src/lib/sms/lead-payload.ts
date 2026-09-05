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
  // Steget "hur vill du bli kontaktad?" i snabbformuläret. Frågans egen text
  // blir fältnamnet hos Facebook och är alltså både lång och språkberoende —
  // därför finns en värdebaserad reserv i `pickContactChoice` nedan.
  contactChoice: ['contactmethod', 'kontaktmetod', 'kontaktsatt', 'kontaktvag', 'contactpreference', 'hurvilldublikontaktad'],
  meetingDate: ['appointmentdate', 'bookingdate', 'preferreddate', 'onskatdatum', 'motesdatum', 'datum', 'date'],
  meetingTime: ['appointmenttime', 'bookingtime', 'preferredtime', 'onskadtid', 'motestid', 'klockslag', 'tid', 'time'],
  // Snabbformulärets tidsval kommer som en enda tidpunkt: "bokad_tid":
  // "2026-09-07T14:30:00+0000". Både dag och klockslag ligger alltså i
  // samma fält, och tidpunkten är i UTC.
  meetingSlot: ['bokadtid', 'bokadtidpunkt', 'appointmentdatetime', 'bokning', 'motestidpunkt'],
} as const;

const MONTHS = [
  ['januari', 'january', 'jan'],
  ['februari', 'february', 'feb'],
  ['mars', 'march', 'mar'],
  ['april', 'april', 'apr'],
  ['maj', 'may'],
  ['juni', 'june', 'jun'],
  ['juli', 'july', 'jul'],
  ['augusti', 'august', 'aug'],
  ['september', 'september', 'sep'],
  ['oktober', 'october', 'oct', 'okt'],
  ['november', 'november', 'nov'],
  ['december', 'december', 'dec'],
];

/** Gemener utan diakriter — samma behandling som nycklarna får. */
function normalizeValue(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Tolkar svaret på kontaktfrågan. Vi jämför mot orden i alternativen, inte mot
 * exakta strängar: Erik kan formulera om alternativen i formuläret utan att
 * den här filen behöver ändras.
 */
export function interpretContactChoice(value: string | null): 'meeting' | 'email' | null {
  if (!value) return null;
  const v = normalizeValue(value);
  if (/(mote|boka|ring|samtal|meeting|appointment|call)/.test(v)) return 'meeting';
  if (/(mejl|mail|email|epost|e-post)/.test(v)) return 'email';
  return null;
}

/**
 * Tidpunkten från formulärets tidsval, till dag och klockslag i svensk tid.
 *
 * Facebook levererar valet i UTC ("...T14:30:00+0000"), medan personen som
 * fyllde i formuläret såg och valde 16:30 svensk tid. Utan omräkningen skulle
 * bekräftelsen lova en tid två timmar fel — därför är det instansen som
 * formateras om till Europe/Stockholm, inte siffrorna som läses av rakt.
 *
 * Saknar strängen tidszon tolkas den som svensk väggklocka och används som den är.
 */
export function parseBookedSlot(value: string | null): { date: string; time: string } | null {
  if (!value) return null;

  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
  if (!hasZone) {
    const date = parseMeetingDate(value);
    const time = parseMeetingTime(value);
    return date && time ? { date, time } : null;
  }

  // "+0000" utan kolon är inte giltig ISO 8601 och tolkas olika av olika
  // motorer — normalisera innan Date får se strängen.
  const iso = value.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute) return null;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    // Midnatt formateras som "24" i sv-SE, vilket inte är ett klockslag.
    time: `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`,
  };
}

/** "2026-09-08", "8 september 2026" och "September 8, 2026" → "2026-09-08". */
export function parseMeetingDate(value: string | null, today = new Date()): string | null {
  if (!value) return null;
  const v = normalizeValue(value);

  const iso = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const monthIndex = MONTHS.findIndex(names => names.some(n => v.includes(n)));
  if (monthIndex < 0) return null;

  const day = v.match(/\b(\d{1,2})\b/);
  if (!day) return null;

  const yearMatch = v.match(/\b(20\d{2})\b/);
  let year = yearMatch ? Number(yearMatch[1]) : today.getFullYear();
  // Utan årtal i texten: ett datum som redan passerat med god marginal syftar
  // rimligen på nästa år, inte på en tid som varit.
  if (!yearMatch && new Date(year, monthIndex, Number(day[1])) < new Date(today.getTime() - 30 * 864e5)) {
    year += 1;
  }
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day[1].padStart(2, '0')}`;
}

/** "10:00", "10.00", "10:00 AM" och "2 pm" → "10:00" respektive "14:00". */
export function parseMeetingTime(value: string | null): string | null {
  if (!value) return null;
  const v = normalizeValue(value);

  const withMinutes = v.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
  const wholeHour = withMinutes ? null : v.match(/\b(\d{1,2})\s*(am|pm)\b/);
  const m = withMinutes ?? wholeHour;
  if (!m) return null;

  let hour = Number(m[1]);
  const minutes = withMinutes ? m[2] : '00';
  const suffix = withMinutes ? m[3] : m[2];
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (hour > 23) return null;

  return `${String(hour).padStart(2, '0')}:${minutes}`;
}

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

  // Tidsvalet ligger normalt i ett fält ("bokad_tid"), men ett formulär kan
  // lika gärna dela upp det i datum och tid. Båda vägarna landar i samma två
  // värden.
  const slot =
    parseBookedSlot(pick(fields, FIELDS.meetingSlot)) ??
    (() => {
      const date = parseMeetingDate(pick(fields, FIELDS.meetingDate));
      const time = parseMeetingTime(pick(fields, FIELDS.meetingTime));
      return date && time ? { date, time } : null;
    })();

  const meeting = {
    contactChoice: interpretContactChoice(pick(fields, FIELDS.contactChoice)),
    meetingDate: slot?.date ?? null,
    meetingTime: slot?.time ?? null,
  };

  return {
    lead: {
      externalId: pick(fields, FIELDS.externalId) ?? syntheticId(fields, phone),
      name: pick(fields, FIELDS.name) ?? (splitName || null),
      email: pick(fields, FIELDS.email),
      phone,
      formName: pick(fields, FIELDS.formName),
      ref: 'facebook',
      ...meeting,
    },
    keys: [...fields.keys()],
  };
}
