import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/sms/phone';
import type { Person, TimelineEvent } from '@/lib/admin-types';

/**
 * Allt adminpanelen visar, samlat per person.
 *
 * Det finns ingen persontabell — en och samma människa dyker upp som en rad i
 * contact_requests, ett möte, en profil, ett gäng SMS och några mejl, utan att
 * något binder ihop dem. Den här routen gör kopplingen: rader som delar
 * e-postadress eller telefonnummer slås samman till en person, och allt som
 * hänt hamnar i en gemensam tidslinje.
 *
 * Sammanslagningen sker i JS istället för i SQL. Med ett hundratal personer
 * och ett par hundra rader kostar det ingenting, och det slipper både vyer i
 * databasen och normalisering av telefonnummer i Postgres.
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface Built extends Person {
  events: TimelineEvent[];
  /** Alla adresser och nummer personen känns igen på — används för uppslag. */
  aliases: string[];
  /**
   * Varje adress och nummer vi stött på, med tidpunkt. Den färskaste vinner som
   * primär uppgift — har någon bytt mejl är det den nya vi vill höra av oss på.
   */
  seen: { at: string; email?: string; phone?: string }[];
}

/**
 * Postgres-kolumner av typen `timestamp without time zone` kommer utan
 * tidszon, och då tolkar JS dem som lokal tid trots att de skrevs i UTC.
 * Ett efterhängt Z gör tiderna jämförbara med resten.
 */
function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return /[Z+]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
}

const emailKey = (raw: string | null | undefined): string | null => {
  const clean = raw?.trim().toLowerCase();
  return clean && clean.includes('@') ? `e:${clean}` : null;
};

const phoneKey = (raw: string | null | undefined): string | null => {
  const normalized = normalizePhone(raw);
  return normalized ? `p:${normalized}` : null;
};

/** Slår ihop nycklar som hör till samma person (union-find). */
class Groups {
  private parent = new Map<string, string>();

  find(key: string): string {
    const seen = this.parent.get(key);
    if (seen === undefined) {
      this.parent.set(key, key);
      return key;
    }
    if (seen === key) return key;
    const root = this.find(seen);
    this.parent.set(key, root);
    return root;
  }

  /** Knyter ihop alla nycklar på en rad och returnerar gruppens rot. */
  join(keys: (string | null)[]): string | null {
    const real = keys.filter((k): k is string => !!k);
    if (!real.length) return null;
    const root = this.find(real[0]);
    for (const key of real.slice(1)) {
      const other = this.find(key);
      if (other !== root) this.parent.set(other, root);
    }
    return this.find(real[0]);
  }
}

function label(value: string | null | undefined, fallback = '—'): string {
  return value?.trim() || fallback;
}

async function build(): Promise<Map<string, Built>> {
  const supabase = getSupabase();

  const [
    contacts, meetings, profiles, registrations,
    threads, sms, optouts, orders, emails, files,
  ] = await Promise.all([
    supabase.from('contact_requests').select('id, name, email, phone, ref, stage, notes, package_type, contact_method, qualification_answers, created_at'),
    supabase.from('meetings').select('id, name, email, phone, date, time, message, created_at'),
    supabase.from('profiles').select('id, email, full_name, phone, company_name, created_at, onboarding_done, subscription_status'),
    supabase.from('pending_registrations').select('id, email, source, created_at, expires_at, used_at'),
    supabase.from('email_threads').select('id, user_id, state, created_at, updated_at'),
    supabase.from('sms_messages').select('id, phone, direction, body, status, error, kind, created_at').order('created_at'),
    supabase.from('sms_optouts').select('phone, created_at'),
    supabase.from('orders').select('id, user_id, guest_email, guest_name, guest_phone, guest_company, package_type, bank, status, created_at'),
    supabase.from('email_log').select('id, to_email, subject, kind, status, error, created_at'),
    supabase.from('contact_files').select('id, contact_id, stage, file_name, created_at'),
  ]);

  // En tabell som fallerar får inte tyst göra tidslinjen ofullständig — då ser
  // panelen rätt ut men saknar händelser, och ingen upptäcker det.
  for (const [name, result] of Object.entries({
    contact_requests: contacts, meetings, profiles, pending_registrations: registrations,
    email_threads: threads, sms_messages: sms, sms_optouts: optouts, orders,
    email_log: emails, contact_files: files,
  })) {
    if (result.error) throw new Error(`Kunde inte läsa ${name}: ${result.error.message}`);
  }

  const rows = {
    contacts: contacts.data ?? [],
    meetings: meetings.data ?? [],
    profiles: profiles.data ?? [],
    registrations: registrations.data ?? [],
    threads: threads.data ?? [],
    sms: sms.data ?? [],
    optouts: optouts.data ?? [],
    orders: orders.data ?? [],
    emails: emails.data ?? [],
    files: files.data ?? [],
  };

  const groups = new Groups();

  // Steg 1: knyt ihop identiteter. Bara rader som själva bär en adress eller
  // ett nummer — trådar och filer hänger på via user_id respektive contact_id
  // och kan inte slå ihop något på egen hand.
  for (const r of rows.contacts) groups.join([emailKey(r.email), phoneKey(r.phone)]);
  for (const r of rows.meetings) groups.join([emailKey(r.email), phoneKey(r.phone)]);
  for (const r of rows.profiles) groups.join([emailKey(r.email), phoneKey(r.phone)]);
  for (const r of rows.orders) groups.join([emailKey(r.guest_email), phoneKey(r.guest_phone)]);
  for (const r of rows.registrations) groups.join([emailKey(r.email)]);
  for (const r of rows.emails) groups.join([emailKey(r.to_email)]);
  for (const r of rows.sms) groups.join([phoneKey(r.phone)]);
  for (const r of rows.optouts) groups.join([phoneKey(r.phone)]);

  // Steg 2: vägar in för rader utan egen kontaktuppgift
  const byUser = new Map<string, string>();
  for (const r of rows.profiles) {
    const root = groups.join([emailKey(r.email), phoneKey(r.phone)]);
    if (root && r.id) byUser.set(r.id, root);
  }
  const byContact = new Map<string, string>();
  for (const r of rows.contacts) {
    const root = groups.join([emailKey(r.email), phoneKey(r.phone)]);
    if (root && r.id) byContact.set(r.id, root);
  }

  const people = new Map<string, Built>();
  /** Tidpunkten för den contact_requests-rad som just nu äger personens steg. */
  const stageOwnedSince = new Map<string, string>();

  function person(root: string): Built {
    let found = people.get(root);
    if (!found) {
      found = {
        key: root, name: null, email: null, phone: null, company: null,
        source: null, stage: null, contactId: null, isCustomer: false,
        optedOut: false, emailCount: 0, smsCount: 0,
        firstSeen: '', lastActivity: '', events: [], aliases: [], seen: [],
      };
      people.set(root, found);
    }
    return found;
  }

  /** Lägger till en händelse och håller kontaktuppgifterna uppdaterade. */
  function add(
    root: string | null,
    at: string | null,
    event: Omit<TimelineEvent, 'at'>,
    identity?: { name?: string | null; email?: string | null; phone?: string | null; alias?: (string | null)[] },
  ) {
    if (!root || !at) return;
    const p = person(root);
    p.events.push({ at, ...event });

    // Första namnet som dyker upp får stå — profilen skriver över längre ned
    if (identity?.name?.trim() && !p.name) p.name = identity.name.trim();

    const email = identity?.email?.trim().toLowerCase();
    const phone = normalizePhone(identity?.phone);
    if (email || phone) p.seen.push({ at, email: email || undefined, phone: phone || undefined });

    for (const alias of identity?.alias ?? []) {
      if (alias && !p.aliases.includes(alias)) p.aliases.push(alias);
    }
  }

  for (const r of rows.contacts) {
    const root = groups.join([emailKey(r.email), phoneKey(r.phone)]);
    const answers = r.qualification_answers as Record<string, unknown> | null;
    const unsure = answers ? Object.values(answers).filter((v) => v === 'unknown').length : 0;
    add(root, r.created_at, {
      type: 'lead',
      title: r.ref ? `Lead inkom · ${r.ref}` : 'Kontaktförfrågan',
      detail: r.notes || undefined,
      meta: unsure > 0 ? `${unsure} osäkert svar` : undefined,
    }, { name: r.name, email: r.email, phone: r.phone, alias: [emailKey(r.email), phoneKey(r.phone)] });

    if (root) {
      const p = person(root);
      // Hör personen till flera förfrågningar äger den senaste steget — det är
      // den som speglar var hen faktiskt står nu.
      const owned = stageOwnedSince.get(root);
      if (!owned || r.created_at > owned) {
        stageOwnedSince.set(root, r.created_at);
        p.contactId = r.id;
        p.stage = r.stage ?? 1;
      }
      if (!p.source && r.ref) p.source = r.ref;
    }
  }

  for (const r of rows.meetings) {
    const root = groups.join([emailKey(r.email), phoneKey(r.phone)]);
    add(root, r.created_at, {
      type: 'mote',
      title: `Möte bokat · ${label(r.date)} ${label(r.time, '')}`.trim(),
      detail: r.message || undefined,
    }, { name: r.name, email: r.email, phone: r.phone, alias: [emailKey(r.email), phoneKey(r.phone)] });
  }

  for (const r of rows.profiles) {
    const root = groups.join([emailKey(r.email), phoneKey(r.phone)]);
    add(root, toIso(r.created_at), {
      type: 'konto',
      title: 'Konto skapat',
      meta: r.onboarding_done ? 'onboarding klar' : 'onboarding ej klar',
    }, { email: r.email, phone: r.phone, alias: [emailKey(r.email), phoneKey(r.phone)] });

    if (root) {
      const p = person(root);
      p.isCustomer = true;
      // Profilen är den mest tillförlitliga källan till namn och företag
      if (r.full_name?.trim()) p.name = r.full_name.trim();
      if (r.company_name?.trim()) p.company = r.company_name.trim();
    }
  }

  for (const r of rows.registrations) {
    const root = groups.join([emailKey(r.email)]);
    const expired = !r.used_at && new Date(r.expires_at) < new Date();
    add(root, r.created_at, {
      type: 'lank',
      title: 'Registreringslänk mejlad',
      detail: r.source ? `Källa: ${r.source}` : undefined,
      meta: r.used_at ? 'använd' : expired ? 'utgången' : 'aktiv',
    }, { email: r.email, alias: [emailKey(r.email)] });
  }

  for (const r of rows.emails) {
    const root = groups.join([emailKey(r.to_email)]);
    const failed = r.status === 'failed';
    add(root, r.created_at, {
      type: 'mejl',
      title: label(r.subject, 'Mejl skickat'),
      detail: r.error || undefined,
      meta: failed ? 'kom inte fram' : r.kind || undefined,
      bad: failed,
    }, { email: r.to_email, alias: [emailKey(r.to_email)] });
    if (root && !failed) person(root).emailCount += 1;
  }

  for (const r of rows.threads) {
    const root = r.user_id ? byUser.get(r.user_id) ?? null : null;
    const prospect = r.state?.startsWith('prospect:');
    add(root, r.updated_at, {
      type: 'trad',
      title: 'E-postkonversation med AI:n',
      meta: prospect ? 'prospekt' : r.state?.startsWith('pending_delete:') ? 'väntar bekräftelse' : undefined,
    });
  }

  for (const r of rows.sms) {
    const root = groups.join([phoneKey(r.phone)]);
    const outgoing = r.direction === 'out';
    const failed = r.status === 'failed' || r.status === 'rate_limited';
    add(root, r.created_at, {
      type: outgoing ? 'sms_ut' : 'sms_in',
      title: outgoing ? (r.kind === 'lead_welcome' ? 'Välkomst-SMS' : 'SMS från oss') : 'SMS från personen',
      detail: r.body,
      meta: failed ? label(r.error, 'misslyckades') : r.status === 'queued' ? 'köat' : undefined,
      bad: failed,
    }, { phone: r.phone, alias: [phoneKey(r.phone)] });
    if (root && !failed) person(root).smsCount += 1;
  }

  for (const r of rows.optouts) {
    const root = groups.join([phoneKey(r.phone)]);
    add(root, r.created_at, { type: 'optout', title: 'Avregistrerade sig från SMS', bad: true },
      { phone: r.phone, alias: [phoneKey(r.phone)] });
    if (root) person(root).optedOut = true;
  }

  for (const r of rows.orders) {
    const root = groups.join([emailKey(r.guest_email), phoneKey(r.guest_phone)])
      ?? (r.user_id ? byUser.get(r.user_id) ?? null : null);
    add(root, toIso(r.created_at), {
      type: 'order',
      title: `Beställning · ${label(r.package_type)}`,
      detail: r.bank ? `Bank: ${r.bank}` : undefined,
      meta: r.status || undefined,
    }, { name: r.guest_name, email: r.guest_email, phone: r.guest_phone });
    if (root && r.guest_company?.trim()) person(root).company ||= r.guest_company.trim();
  }

  for (const r of rows.files) {
    const root = r.contact_id ? byContact.get(r.contact_id) ?? null : null;
    add(root, r.created_at, {
      type: 'fil',
      title: 'Fil uppladdad',
      detail: r.file_name || undefined,
      meta: r.stage ? `steg ${r.stage}` : undefined,
    });
  }

  // Sortera och summera
  for (const p of people.values()) {
    p.events.sort((a, b) => a.at.localeCompare(b.at));
    p.firstSeen = p.events[0]?.at ?? '';
    p.lastActivity = p.events[p.events.length - 1]?.at ?? '';

    // Färskast vinner: har någon hört av sig från en ny adress är det den
    // Erik ska svara på, inte den de använde för ett halvår sedan.
    const newestFirst = [...p.seen].sort((a, b) => b.at.localeCompare(a.at));
    p.email = newestFirst.find((s) => s.email)?.email ?? (p.key.startsWith('e:') ? p.key.slice(2) : null);
    p.phone = newestFirst.find((s) => s.phone)?.phone ?? (p.key.startsWith('p:') ? p.key.slice(2) : null);

    for (const s of p.seen) {
      for (const alias of [emailKey(s.email), phoneKey(s.phone)]) {
        if (alias && !p.aliases.includes(alias)) p.aliases.push(alias);
      }
    }
    for (const alias of [emailKey(p.email), phoneKey(p.phone)]) {
      if (alias && !p.aliases.includes(alias)) p.aliases.push(alias);
    }
  }

  return people;
}

function summary(p: Built): Person {
  const { events, aliases, seen, ...rest } = p;
  void events;
  void aliases;
  void seen;
  return rest;
}

/**
 * Övriga adresser och nummer personen dykt upp under. Att visa dem är
 * poängen: slår vi ihop två rader ska det synas varför, inte gömmas.
 */
function otherContacts(p: Built): { emails: string[]; phones: string[] } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const alias of p.aliases) {
    const value = alias.slice(2);
    if (alias.startsWith('e:') && value !== p.email) emails.add(value);
    if (alias.startsWith('p:') && value !== p.phone) phones.add(value);
  }
  return { emails: [...emails], phones: [...phones] };
}

export async function GET(request: NextRequest) {
  try {
    const wanted = request.nextUrl.searchParams.get('key');
    const people = await build();

    if (!wanted) {
      const list = [...people.values()]
        .map(summary)
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
      return NextResponse.json({ people: list });
    }

    // Slå upp på vilken som helst av personens adresser eller nummer, så att
    // länken håller även om vi senare byter vilken uppgift som är primär.
    const needle = wanted; // searchParams har redan avkodat värdet
    const match = [...people.values()].find(
      (p) => p.key === needle || p.aliases.includes(needle)
        || p.email?.toLowerCase() === needle.toLowerCase() || p.phone === needle,
    );

    if (!match) return NextResponse.json({ error: 'Hittade ingen sådan person' }, { status: 404 });
    return NextResponse.json({
      person: summary(match),
      events: match.events,
      other: otherContacts(match),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/people]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Flyttar personen till ett annat steg i pipelinen. */
export async function PATCH(request: NextRequest) {
  try {
    const { contactId, stage } = await request.json();
    if (!contactId) return NextResponse.json({ error: 'contactId krävs' }, { status: 400 });
    if (!Number.isInteger(stage) || stage < 1 || stage > 5) {
      return NextResponse.json({ error: 'stage måste vara 1–5' }, { status: 400 });
    }
    // Bara steget får skrivas här — resten av raden är insamlad data
    const { error } = await getSupabase().from('contact_requests').update({ stage }).eq('id', contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Lägger upp någon för hand, t.ex. efter ett samtal. */
export async function POST(request: NextRequest) {
  try {
    const { name, email, phone } = await request.json();
    if (!email?.includes('@')) return NextResponse.json({ error: 'Giltig e-post krävs' }, { status: 400 });
    const { data, error } = await getSupabase().from('contact_requests').insert({
      name: name?.trim() || null,
      email: email.trim(),
      phone: phone?.trim() || null,
      package_type: 'komplett',
      ref: 'manuell',
      stage: 1,
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Tar bort kontaktförfrågan. Mejl, SMS och möten ligger kvar — de hör till
 * historiken och skulle ändå inte gå att koppla tillbaka om de raderades.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { contactId } = await request.json();
    if (!contactId) return NextResponse.json({ error: 'contactId krävs' }, { status: 400 });
    const { error } = await getSupabase().from('contact_requests').delete().eq('id', contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
