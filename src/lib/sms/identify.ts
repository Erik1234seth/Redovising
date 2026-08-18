import { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from './phone';

export interface Sender {
  kind: 'customer' | 'prospect' | 'unknown';
  userId: string | null;
  name: string | null;
  email: string | null;
  /** Kort rad om var vi känner igen numret ifrån, för loggen */
  source: string | null;
}

interface PhoneRow { phone: string | null }

/**
 * Plockar ut raden vars telefonnummer matchar `e164`.
 *
 * Numren i databasen är inknappade av människor ("070-123 45 67", "+46 70 123
 * 45 67", "0046701234567"), så de går inte att jämföra med en SQL-likhet. Vi
 * hämtar därför raderna och normaliserar i JS. Tabellerna rör sig om tiotals
 * rader — blir det tusentals är det värt att lägga en normaliserad kolumn med
 * index istället.
 */
function findMatch<T extends PhoneRow>(rows: T[] | null, e164: string): T | null {
  return rows?.find((r) => normalizePhone(r.phone) === e164) ?? null;
}

export async function identifySender(
  supabase: SupabaseClient,
  e164: string,
): Promise<Sender> {
  const [profilesRes, contactsRes, meetingsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone').not('phone', 'is', null),
    supabase
      .from('contact_requests')
      .select('name, email, phone, created_at')
      .not('phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('meetings')
      .select('name, email, phone, created_at')
      .not('phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const profile = findMatch(profilesRes.data, e164);
  if (profile) {
    return {
      kind: 'customer',
      userId: profile.id,
      name: profile.full_name ?? null,
      email: profile.email ?? null,
      source: 'profiles',
    };
  }

  // Ingen kundprofil — kolla om numret lämnats som lead. Mötesbokningar först,
  // de är ett starkare intresse än ett kontaktformulär.
  const meeting = findMatch(meetingsRes.data, e164);
  if (meeting) {
    return {
      kind: 'prospect',
      userId: null,
      name: meeting.name ?? null,
      email: meeting.email ?? null,
      source: 'meetings',
    };
  }

  const contact = findMatch(contactsRes.data, e164);
  if (contact) {
    return {
      kind: 'prospect',
      userId: null,
      name: contact.name ?? null,
      email: contact.email ?? null,
      source: 'contact_requests',
    };
  }

  return { kind: 'unknown', userId: null, name: null, email: null, source: null };
}
