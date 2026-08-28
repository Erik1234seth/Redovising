import { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from './phone';

/** Vad vi vet om kontot bakom numret, när ett konto hittats. */
export interface SenderAccount {
  /** Hur kontot knöts till numret. Se `hasAccount` nedan för varför det spelar roll. */
  matchedBy: 'phone' | 'email';
  onboardingDone: boolean;
  subscriptionStatus: string | null;
  createdAt: string | null;
}

export interface Sender {
  kind: 'customer' | 'prospect' | 'unknown';
  userId: string | null;
  name: string | null;
  email: string | null;
  /** Kort rad om var vi känner igen numret ifrån, för loggen */
  source: string | null;
  /**
   * Finns det ett konto i app.enklabokslut.se bakom numret?
   *
   * Detta är inte samma sak som att numret står i en profil. `profiles.phone`
   * är tom för nästan alla kunder — telefonnummer samlas in i formulären, inte
   * vid registreringen. Ett nummer som bara finns i `contact_requests` eller
   * `meetings` kan alltså mycket väl tillhöra en betalande kund, och då är
   * `hasAccount` true fast profilen saknar numret.
   */
  hasAccount: boolean;
  account: SenderAccount | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  onboarding_done: boolean | null;
  subscription_status: string | null;
  created_at: string | null;
}

interface LeadRow {
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Plockar ut raden vars telefonnummer matchar `e164`.
 *
 * Numren i databasen är inknappade av människor ("070-123 45 67", "+46 70 123
 * 45 67", "0046701234567"), så de går inte att jämföra med en SQL-likhet. Vi
 * hämtar därför raderna och normaliserar i JS. Tabellerna rör sig om tiotals
 * rader — blir det tusentals är det värt att lägga en normaliserad kolumn med
 * index istället.
 */
function findMatch<T extends { phone: string | null }>(rows: T[] | null, e164: string): T | null {
  return rows?.find((r) => normalizePhone(r.phone) === e164) ?? null;
}

/** Mejladresser jämförs skiftlägesokänsligt — samma skäl som ovan, folk skriver som de vill. */
function findByEmail(rows: ProfileRow[] | null, email: string | null | undefined): ProfileRow | null {
  const needle = email?.trim().toLowerCase();
  if (!needle) return null;
  return rows?.find((p) => p.email?.trim().toLowerCase() === needle) ?? null;
}

function toAccount(p: ProfileRow, matchedBy: 'phone' | 'email'): SenderAccount {
  return {
    matchedBy,
    onboardingDone: p.onboarding_done === true,
    subscriptionStatus: p.subscription_status ?? null,
    createdAt: p.created_at ?? null,
  };
}

export async function identifySender(
  supabase: SupabaseClient,
  e164: string,
): Promise<Sender> {
  // Alla profiler hämtas, inte bara de med telefonnummer: nummer som saknas i
  // profilen ska ändå kunna knytas till kontot via lead-radens mejladress.
  const [profilesRes, contactsRes, meetingsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, onboarding_done, subscription_status, created_at')
      .limit(1000),
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

  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  const profile = findMatch(profiles, e164);
  if (profile) {
    return {
      kind: 'customer',
      userId: profile.id,
      name: profile.full_name ?? null,
      email: profile.email ?? null,
      source: 'profiles',
      hasAccount: true,
      account: toAccount(profile, 'phone'),
    };
  }

  // Ingen kundprofil på numret — kolla om numret lämnats som lead. Mötesbokningar
  // först, de är ett starkare intresse än ett kontaktformulär.
  const meeting = findMatch(meetingsRes.data as LeadRow[] | null, e164);
  const contact = findMatch(contactsRes.data as LeadRow[] | null, e164);
  const lead = meeting ?? contact;

  if (lead) {
    const source = meeting ? 'meetings' : 'contact_requests';
    // Lead-raden har en mejladress, och den kan höra till ett konto även om
    // profilen aldrig fått numret. Hittar vi ett konto är personen kund, inte
    // prospekt — annars börjar AI:n sälja in tjänsten till någon som redan betalar.
    const byEmail = findByEmail(profiles, lead.email);
    if (byEmail) {
      return {
        kind: 'customer',
        userId: byEmail.id,
        name: byEmail.full_name ?? lead.name ?? null,
        email: byEmail.email ?? lead.email ?? null,
        source: `${source} + profiles (via e-post)`,
        hasAccount: true,
        account: toAccount(byEmail, 'email'),
      };
    }

    return {
      kind: 'prospect',
      userId: null,
      name: lead.name ?? null,
      email: lead.email ?? null,
      source,
      hasAccount: false,
      account: null,
    };
  }

  return {
    kind: 'unknown',
    userId: null,
    name: null,
    email: null,
    source: null,
    hasAccount: false,
    account: null,
  };
}
