import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSms } from '../sms/twilio';
import { normalizePhone } from '../sms/phone';
import { sendViaGmail } from '../emails/send-via-gmail';
import { leadReminderEmail, REMINDER_EMAIL_KIND } from '../emails/lead-reminder';
import { LEAD_REMINDER_SMS, REMINDER_AFTER_DAYS, REMINDER_SMS_KIND } from '../sms/lead-reminder';

/**
 * En påminnelse till leads som fick välkomstmejlet men aldrig hörde av sig.
 *
 * En, aldrig fler. Det är hela poängen och det som styr uppbyggnaden nedan:
 * varje utskick märks med sin `kind` i email_log respektive sms_messages, och
 * samma märkning är spärren nästa gång jobbet körs. Kanalerna spärras var för
 * sig, så att ett mejl som fastnar hos Apps Script inte hindrar SMS:et — och
 * tvärtom.
 *
 * Vem räknas som "har svarat"? Vi har ingen tabell över personer, så signalen
 * pusslas ihop av det vi faktiskt kan se:
 *  - en profiles-rad: personen har blivit kund
 *  - en meetings-rad: personen har bokat tid
 *  - en email_threads-rad med state 'prospect:<adress>' eller 'kontakt:<adress>':
 *    mail-AI:n har svarat på ett inkommande mejl från adressen. Skillnaden är om
 *    vi skickade registreringslänken eller inte; båda betyder att personen hört
 *    av sig
 *  - ett inkommande SMS från numret
 *  - en person_aliases-rad som pekar på adressen: någon har kopplat ihop
 *    personen med en annan adress för hand, vilket bara görs när de hört av sig
 *
 * Signalen är medvetet generös. Att missa en påminnelse till någon som redan
 * svarat kostar oss ingenting; att skicka en till någon som just pratat med
 * Erik ser slarvigt ut.
 *
 * Ligger här och inte i en route eftersom två vägar leder hit: cron-jobbet
 * /api/cron/sms-queue kallar den varje morgon, och /api/cron/lead-reminders
 * finns kvar för att kunna torrköra eller trigga den för hand. Vercels
 * Hobby-plan tillåter bara två schemalagda jobb, och de är redan tagna — därför
 * åker påminnelserna med kön i stället för att få ett eget schema.
 */

/**
 * Tak per körning. Efter ikappkörningen är kön normalt några få per dag —
 * taket finns för att en oväntad ansamling aldrig ska bli ett massutskick.
 * Resten kommer nästa morgon.
 */
export const MAX_PER_RUN = 25;

export interface ReminderRun {
  /** Hur många som står i kö totalt, oavsett taket ovan. */
  candidates: number;
  emailed: number;
  texted: number;
  failed: number;
  /** Kvar till nästa körning när taket slog i. */
  remaining: number;
  /** Bara vid torrkörning: vilka som hade fått påminnelsen. */
  recipients?: { email: string; welcomedAt: string; sms: string | null }[];
  dryRun?: boolean;
}

interface Candidate {
  email: string;
  /** När välkomstmejlet gick ut. Bara för loggen och torrkörningen. */
  welcomedAt: string;
  phone: string | null;
}

/**
 * Adresser som aldrig ska få ett utskick.
 *
 * Facebooks formulärverktyg skickar testleads med adresser som test@meta.com
 * när man förhandsgranskar ett formulär, och de hamnar i Gmail som vilket lead
 * som helst. Vår egen domän står med av samma skäl: interna utskick och Eriks
 * egna testrader ska inte komma tillbaka som påminnelser.
 *
 * Det här behövdes inte så länge urvalet kom ur email_log — vår egen kod hade
 * redan sorterat bort skräpet innan det loggades. Med Gmail som källa kommer
 * allt med, inklusive det vi aldrig menade att skicka på riktigt.
 */
const SKIP_DOMAINS = ['enklabokslut.se', 'meta.com', 'example.com'];
const SKIP_LOCAL_PARTS = ['test', 'testtest', 'noreply', 'no-reply'];

function isInternalOrTest(email: string): boolean {
  const [local, domain] = email.split('@');
  if (!domain) return true;
  return SKIP_DOMAINS.includes(domain) || SKIP_LOCAL_PARTS.includes(local);
}

/** Vad vi behöver av en Supabase-fråga för att kunna bläddra i den. */
interface Pageable<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

/**
 * Hämtar hela resultatet, sida för sida.
 *
 * Supabase svarar med högst 1 000 rader per fråga. Mejlloggen passerar den
 * gränsen förr eller senare, och då hade en tyst avhuggning betytt att gamla
 * leads aldrig fick sin påminnelse — eller värre, att spärrlistan blev
 * ofullständig och någon fick en andra.
 */
async function allRows<T>(build: () => Pageable<T>): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

export async function runLeadReminders(
  supabase: SupabaseClient,
  options: { dryRun?: boolean } = {},
): Promise<ReminderRun> {
  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [welcomed, reminded] = await Promise.all([
    allRows<{ to_email: string; created_at: string }>(() =>
      supabase
        .from('email_log')
        .select('to_email, created_at')
        .eq('kind', 'lead_valkomst')
        .eq('status', 'sent')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })),
    // Utan statusfilter: har vi en gång försökt påminna adressen är det gjort.
    // Ett misslyckat utskick som ligger kvar i loggen syns i panelen, och det
    // är bättre än ett jobb som försöker om i all evighet.
    allRows<{ to_email: string }>(() =>
      supabase.from('email_log').select('to_email').eq('kind', REMINDER_EMAIL_KIND)),
  ]);

  const empty: ReminderRun = { candidates: 0, emailed: 0, texted: 0, failed: 0, remaining: 0 };
  if (!welcomed.length) return options.dryRun ? { ...empty, dryRun: true, recipients: [] } : empty;

  // Äldsta utskicket per adress vinner: har någon fått välkomstmejlet två
  // gånger är det första gången klockan började ticka.
  const firstWelcome = new Map<string, string>();
  for (const row of welcomed) {
    const email = row.to_email.trim().toLowerCase();
    if (!firstWelcome.has(email)) firstWelcome.set(email, row.created_at);
  }

  const emails = [...firstWelcome.keys()];
  const wanted = new Set(emails);

  const [
    { data: profiles },
    { data: meetings },
    { data: threads },
    { data: aliases },
    contacts,
  ] = await Promise.all([
    supabase.from('profiles').select('email').not('email', 'is', null),
    supabase.from('meetings').select('email').not('email', 'is', null),
    // Både prospect: och kontakt: räknas som svar — se unknown-user.ts.
    supabase.from('email_threads').select('state').or('state.like.prospect:%,state.like.kontakt:%'),
    supabase.from('person_aliases').select('person_key, alias_email'),
    // Numret bor i kontaktförfrågan — email_log har bara adressen. Vi hämtar
    // alla och matchar i JS: adresserna är skrivna med det skiftläge personen
    // råkade använda, och ett `in`-filter hade missat den som skrev Förnamn@.
    allRows<{ email: string; phone: string | null; created_at: string }>(() =>
      supabase
        .from('contact_requests')
        .select('email, phone, created_at')
        .not('phone', 'is', null)
        .order('created_at', { ascending: true })),
  ]);

  const responded = new Set<string>([
    ...reminded.map((r) => r.to_email.trim().toLowerCase()),
    ...(profiles ?? []).map((p) => (p.email as string).trim().toLowerCase()),
    ...(meetings ?? []).map((m) => (m.email as string).trim().toLowerCase()),
    ...(threads ?? []).map((t) => (t.state as string).split(':').slice(1).join(':').toLowerCase()),
  ]);

  // En handkopplad adress betyder att personen svarat från något annat håll.
  // Både nyckeln ("e:adress") och själva aliaset räknas: den ena är personen vi
  // mejlade, den andra adressen svaret kom ifrån.
  for (const a of aliases ?? []) {
    const key = a.person_key as string;
    if (key?.startsWith('e:')) responded.add(key.slice(2).toLowerCase());
    if (a.alias_email) responded.add((a.alias_email as string).toLowerCase());
  }

  // Senaste kontaktförfrågan med ett användbart nummer får bestämma vart
  // SMS:et går — raderna kommer i tidsordning, så den sista skriver över.
  const phones = new Map<string, string>();
  for (const c of contacts) {
    const email = c.email?.trim().toLowerCase();
    if (!email || !wanted.has(email)) continue;
    const normalized = normalizePhone(c.phone);
    if (normalized) phones.set(email, normalized);
  }

  // Numren slås upp innan kandidatlistan sätts, för att ett inkommande SMS ska
  // hinna diskvalificera hela personen och inte bara SMS-kanalen. Den som
  // svarat "nej tack" i en tråd med SMS-AI:n har svarat, och ska inte få
  // påminnelsemejlet heller.
  const numbers = [...new Set(phones.values())];
  const [{ data: optouts }, { data: smsSeen }] = await Promise.all([
    numbers.length
      ? supabase.from('sms_optouts').select('phone').in('phone', numbers)
      : Promise.resolve({ data: [] as { phone: string }[] }),
    // Två saker i en fråga: inkommande SMS (personen har svarat) och
    // påminnelser vi redan skickat till numret.
    numbers.length
      ? supabase
          .from('sms_messages')
          .select('phone, direction, kind')
          .in('phone', numbers)
          .or(`direction.eq.in,kind.eq.${REMINDER_SMS_KIND}`)
      : Promise.resolve({ data: [] as { phone: string; direction: string; kind: string }[] }),
  ]);

  const answeredBySms = new Set(
    (smsSeen ?? []).filter((s) => s.direction === 'in').map((s) => s.phone as string),
  );
  for (const [email, phone] of phones) {
    if (answeredBySms.has(phone)) responded.add(email);
  }

  // Avregistrerade nummer och nummer som redan fått påminnelsen stoppar bara
  // SMS:et. Mejlet är en egen kanal med en egen spärr.
  const blockedNumbers = new Set<string>([
    ...(optouts ?? []).map((o) => o.phone as string),
    ...(smsSeen ?? []).map((s) => s.phone as string),
  ]);

  const candidates: Candidate[] = emails
    .filter((email) => !responded.has(email) && !isInternalOrTest(email))
    .map((email) => ({
      email,
      welcomedAt: firstWelcome.get(email)!,
      phone: phones.get(email) ?? null,
    }));

  const due = candidates.slice(0, MAX_PER_RUN);
  const remaining = Math.max(0, candidates.length - due.length);

  if (options.dryRun) {
    return {
      dryRun: true,
      candidates: candidates.length,
      emailed: 0,
      texted: 0,
      failed: 0,
      remaining,
      recipients: due.map((c) => ({
        email: c.email,
        welcomedAt: c.welcomedAt,
        sms: c.phone && !blockedNumbers.has(c.phone) ? c.phone : null,
      })),
    };
  }

  const { subject, html } = leadReminderEmail();
  let emailed = 0;
  let texted = 0;
  let failed = 0;

  for (const candidate of due) {
    // Mejlet först, som i välkomstflödet: sendViaGmail loggar raden i email_log
    // oavsett utfall, och det är den raden som spärrar nästa körning.
    if (await sendViaGmail({ to: candidate.email, subject, html, kind: REMINDER_EMAIL_KIND })) {
      emailed++;
    } else {
      failed++;
    }

    const phone = candidate.phone;
    if (!phone || blockedNumbers.has(phone)) continue;
    // Två adresser på samma nummer ska ändå bara ge ett SMS.
    blockedNumbers.add(phone);

    try {
      const sid = await sendSms({ to: phone, body: LEAD_REMINDER_SMS });
      await supabase.from('sms_messages').insert({
        phone,
        direction: 'out',
        body: LEAD_REMINDER_SMS,
        kind: REMINDER_SMS_KIND,
        twilio_sid: sid,
        status: 'sent',
      });
      texted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[lead-reminders] kunde inte skicka till ${phone}:`, message);
      await supabase.from('sms_messages').insert({
        phone,
        direction: 'out',
        body: LEAD_REMINDER_SMS,
        kind: REMINDER_SMS_KIND,
        status: 'failed',
        error: message,
      });
      failed++;
    }
  }

  console.log(
    `[lead-reminders] ${candidates.length} i kö, ${emailed} mejl, ${texted} SMS, ${failed} misslyckade`,
  );

  return { candidates: candidates.length, emailed, texted, failed, remaining };
}
