import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSms } from '@/lib/sms/twilio';
import { normalizePhone } from '@/lib/sms/phone';
import { sendViaGmail } from '@/lib/emails/send-via-gmail';
import { leadReminderEmail, REMINDER_EMAIL_KIND } from '@/lib/emails/lead-reminder';
import {
  LEAD_REMINDER_SMS,
  REMINDER_AFTER_DAYS,
  REMINDER_SMS_KIND,
} from '@/lib/sms/lead-reminder';

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
 *  - en email_threads-rad med state 'prospect:<adress>': mail-AI:n har svarat
 *    på ett inkommande mejl från adressen
 *  - ett inkommande SMS från numret
 *  - en person_aliases-rad som pekar på adressen: någon har kopplat ihop
 *    personen med en annan adress för hand, vilket bara görs när de hört av sig
 *
 * Signalen är medvetet generös. Att missa en påminnelse till någon som redan
 * svarat kostar oss ingenting; att skicka en till någon som just pratat med
 * Erik ser slarvigt ut.
 *
 * Körs dagligen av Vercel Cron, så leads glider in i urvalet i takt med att
 * deras två veckor går. Lägg till `?dry=1` för att se vilka som står på tur
 * utan att något skickas.
 */
export const maxDuration = 300;

/**
 * Tak per körning. Efter första körningen är kön normalt några få per dag —
 * taket finns för att den allra första körningen, som har hela historiken att
 * ta igen, inte ska bli ett massutskick på en gång. Resten kommer i morgon.
 */
const MAX_PER_RUN = 25;

interface Candidate {
  email: string;
  /** När välkomstmejlet gick ut. Bara för loggen och torrkörningen. */
  welcomedAt: string;
  phone: string | null;
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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let welcomed: { to_email: string; created_at: string }[];
  let reminded: { to_email: string }[];
  try {
    [welcomed, reminded] = await Promise.all([
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[lead-reminders] kunde inte läsa mejlloggen:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!welcomed.length) {
    return NextResponse.json({ candidates: 0, emailed: 0, texted: 0, skipped: 0 });
  }

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
    supabase.from('email_threads').select('state').like('state', 'prospect:%'),
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
    ...(threads ?? []).map((t) => (t.state as string).slice('prospect:'.length).toLowerCase()),
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

  const candidates: Candidate[] = emails
    .filter((email) => !responded.has(email))
    .map((email) => ({
      email,
      welcomedAt: firstWelcome.get(email)!,
      phone: phones.get(email) ?? null,
    }));

  // Spärrarna på SMS-sidan slås upp på numren vi faktiskt tänkt oss.
  const numbers = candidates.map((c) => c.phone).filter((p): p is string => !!p);
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

  const blockedNumbers = new Set<string>([
    ...(optouts ?? []).map((o) => o.phone as string),
    ...(smsSeen ?? []).map((s) => s.phone as string),
  ]);

  const due = candidates.slice(0, MAX_PER_RUN);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      candidates: candidates.length,
      cap: MAX_PER_RUN,
      recipients: due.map((c) => ({
        email: c.email,
        welcomedAt: c.welcomedAt,
        sms: c.phone && !blockedNumbers.has(c.phone) ? c.phone : null,
      })),
    });
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
  return NextResponse.json({
    candidates: candidates.length,
    emailed,
    texted,
    failed,
    remaining: Math.max(0, candidates.length - due.length),
  });
}
