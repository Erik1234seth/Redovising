import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/sms/phone';
import type { AdminMailMessage, AdminTransaktion, AdminVerifikation, BokslutData, MomsPeriod, Redovisningsmetod } from '@/lib/admin-types';
import { importPendingSie } from '@/lib/sie/import';
import { build, getSupabase, locate, otherContacts, summary, toIso, type Built } from '@/lib/personer';

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
    let match = locate(people, wanted); // searchParams har redan avkodat värdet

    if (!match) return NextResponse.json({ error: 'Hittade ingen sådan person' }, { status: 404 });

    // SIE-filer som inte lagts in än — t.ex. uppladdade av kunden i appen, där
    // ingen server är inblandad. Läggs in nu, och då ska personen läsas om så
    // att underlagen och historiken visar resultatet.
    const owner = ownerOf(match);
    if (await importPendingSie(getSupabase(), owner)) {
      match = locate(await build(), wanted) ?? match;
    }

    if (request.nextUrl.searchParams.get('view') === 'verifikationer') {
      return NextResponse.json({ person: summary(match), verifikationer: await verifikationerFor(owner) });
    }

    if (request.nextUrl.searchParams.get('view') === 'transaktioner') {
      return NextResponse.json({ person: summary(match), transaktioner: await transaktionerFor(owner) });
    }

    return NextResponse.json({
      verifikationerCount: await countVerifikationer(owner),
      transaktionerCount: await countRader('transaktioner', owner),
      person: summary(match),
      events: match.events,
      other: otherContacts(match),
      underlag: match.files,
      mail: await mailFor(match),
      bokslut: await bokslutFor(match),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/people]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type Owner = { userIds: string[]; emails: string[] };

/** Kontona och adresserna personens verifikationer kan ligga på. */
function ownerOf(p: Built): Owner {
  return {
    userIds: p.profileIds,
    emails: [...new Set(p.aliases.filter((a) => a.startsWith('e:')).map((a) => a.slice(2)))],
  };
}

function ownerFilter(owner: Owner): string | null {
  const parts = [
    ...(owner.userIds.length ? [`user_id.in.(${owner.userIds.join(',')})`] : []),
    ...(owner.emails.length ? [`customer_email.in.(${owner.emails.map((e) => `"${e}"`).join(',')})`] : []),
  ];
  return parts.length ? parts.join(',') : null;
}

async function countVerifikationer(owner: Owner): Promise<number> {
  return countRader('verifikationer', owner);
}

async function countRader(table: 'verifikationer' | 'transaktioner', owner: Owner): Promise<number> {
  const filter = ownerFilter(owner);
  if (!filter) return 0;
  const { count, error } = await getSupabase()
    .from(table)
    .select('id', { count: 'exact', head: true })
    .or(filter);
  if (error) throw new Error(`Kunde inte räkna ${table}: ${error.message}`);
  return count ?? 0;
}

/**
 * Transaktionerna som AI:n läst ur kundens underlag, i datumordning med de
 * odaterade sist. De är inte konterade — det är steget efter.
 */
async function transaktionerFor(owner: Owner): Promise<AdminTransaktion[]> {
  const filter = ownerFilter(owner);
  if (!filter) return [];

  const out: AdminTransaktion[] = [];
  const bankNamn = new Map<string, string>();
  for (let from = 0; ; from += 500) {
    const { data, error } = await getSupabase()
      .from('transaktioner')
      .select('id, underlag_id, bank_konto_hash, radnr, datum, beskrivning, motpart, belopp, moms, valuta, riktning, anteckning, detaljer, kalla, dublett_av, dublett_orsak, created_at, bokforing_underlag(file_name)')
      .or(filter)
      .order('datum', { ascending: true, nullsFirst: false })
      .order('underlag_id')
      .order('radnr')
      .range(from, from + 499);
    if (error) throw new Error(`Kunde inte läsa transaktioner: ${error.message}`);

    for (const t of data ?? []) {
      const file = t.bokforing_underlag as unknown as { file_name: string } | null;
      if (t.bank_konto_hash) bankNamn.set(t.bank_konto_hash, 'Bank');
      out.push({
        id: t.id,
        underlagId: t.underlag_id ?? `bank:${t.bank_konto_hash}`,
        fileName: t.bank_konto_hash ? null : file?.file_name ?? null,
        radnr: t.radnr ?? 0,
        datum: t.datum ?? '',
        beskrivning: t.beskrivning ?? '',
        motpart: t.motpart ?? '',
        belopp: Number(t.belopp),
        moms: t.moms === null ? null : Number(t.moms),
        valuta: t.valuta ?? 'SEK',
        riktning: t.riktning === 'in' ? 'in' : 'ut',
        anteckning: t.anteckning ?? '',
        detaljer: t.detaljer ?? '',
        kalla: t.kalla ?? 'ai',
        dublettAv: t.dublett_av ?? null,
        dublettOrsak: t.dublett_orsak ?? null,
        at: toIso(t.created_at) ?? '',
      });
    }
    if ((data ?? []).length < 500) break;
  }

  // Bankraderna har ingen fil — de visas med bankens och kontots namn i stället
  if (bankNamn.size) {
    const { data: konton } = await getSupabase()
      .from('bank_konton')
      .select('konto_hash, namn, iban, session_id')
      .in('konto_hash', [...bankNamn.keys()]);
    const sessioner = [...new Set((konton ?? []).map((k) => k.session_id).filter(Boolean))];
    const { data: kopplingar } = sessioner.length
      ? await getSupabase().from('bank_kopplingar').select('session_id, aspsp_name').in('session_id', sessioner)
      : { data: [] };
    const bankPer = new Map((kopplingar ?? []).map((k) => [k.session_id, k.aspsp_name as string]));
    for (const k of konton ?? []) {
      bankNamn.set(k.konto_hash, [bankPer.get(k.session_id) ?? 'Bank', k.namn || k.iban].filter(Boolean).join(' · '));
    }
    for (const t of out) {
      if (t.underlagId.startsWith('bank:')) t.fileName = bankNamn.get(t.underlagId.slice(5)) ?? 'Bank';
    }
  }
  return out;
}

/**
 * Alla personens verifikationer med konteringsrader, i datumordning. Bläddras
 * igenom i portioner — PostgREST kapar vid 1000 rader, och en SIE-fil för ett
 * helt år kan ha flera tusen verifikationer.
 */
async function verifikationerFor(owner: Owner): Promise<AdminVerifikation[]> {
  const filter = ownerFilter(owner);
  if (!filter) return [];

  const out: AdminVerifikation[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await getSupabase()
      .from('verifikationer')
      .select('id, kalla, underlag_id, serie, nummer, datum, text, registrerad, signatur, summa, balanserad, bokforing_underlag(file_name), verifikation_rader(radnr, konto, kontonamn, belopp, text, objekt, borttagen, tillagd)')
      .or(filter)
      .order('datum', { ascending: true, nullsFirst: true })
      .order('id')
      .range(from, from + 499);
    if (error) throw new Error(`Kunde inte läsa verifikationer: ${error.message}`);

    for (const v of data ?? []) {
      const file = v.bokforing_underlag as unknown as { file_name: string } | null;
      const rows = (v.verifikation_rader ?? []) as {
        radnr: number; konto: string; kontonamn: string | null; belopp: number | string; text: string | null;
        objekt: { dimension: string; objekt: string }[] | null; borttagen: boolean; tillagd: boolean;
      }[];
      out.push({
        id: v.id,
        kalla: v.kalla,
        underlagId: v.underlag_id,
        fileName: file?.file_name ?? null,
        serie: v.serie ?? '',
        nummer: v.nummer ?? '',
        datum: v.datum ?? '',
        text: v.text ?? '',
        registrerad: v.registrerad ?? '',
        signatur: v.signatur ?? '',
        summa: Number(v.summa),
        balanserad: v.balanserad,
        transaktioner: rows.sort((a, b) => a.radnr - b.radnr).map((t) => ({
          konto: t.konto,
          kontonamn: t.kontonamn ?? '',
          belopp: Number(t.belopp),
          text: t.text ?? '',
          objekt: t.objekt ?? [],
          borttagen: t.borttagen,
          tillagd: t.tillagd,
        })),
      });
    }
    if ((data ?? []).length < 500) break;
  }

  // Nummer är text i databasen — A10 skulle hamna före A2. Sorteras numeriskt här.
  const num = (n: string) => (/^\d+$/.test(n) ? Number(n) : 0);
  return out.sort((a, b) =>
    a.datum.localeCompare(b.datum) || a.serie.localeCompare(b.serie)
    || num(a.nummer) - num(b.nummer) || a.nummer.localeCompare(b.nummer));
}

/**
 * Det bokslutschecklistan räknas fram ur som inte redan står på Person:
 * organisations- och momsnumret, om det är första året, kundens lager och
 * inventarier i appen, och det som satts för hand på punkterna.
 *
 * Läses från huvudprofilen. Lagret räknas över alla sammanslagna konton —
 * en kund som registrerat sig två gånger kan ha lagt in sakerna på vilket som.
 */
async function bokslutFor(p: Built): Promise<BokslutData | null> {
  if (!p.profileId) return null;
  const supabase = getSupabase();
  const [{ data: profil, error }, { data: tillgangar }] = await Promise.all([
    supabase
      .from('profiles')
      .select('org_nr, momsnr, forsta_deklarationsar, start_ar, bokslut_checklista, ne_uppgifter')
      .eq('id', p.profileId)
      .maybeSingle(),
    supabase.from('lagertillgangar').select('typ').in('user_id', p.profileIds),
  ]);
  if (error) throw new Error(`Kunde inte läsa profilen: ${error.message}`);

  return {
    orgNr: profil?.org_nr?.trim() || null,
    momsNr: profil?.momsnr?.trim() || null,
    forstaAret: profil?.forsta_deklarationsar ?? null,
    startAr: profil?.start_ar ?? null,
    inventarier: (tillgangar ?? []).filter((t) => t.typ === 'inventarie').length,
    lagerposter: (tillgangar ?? []).filter((t) => t.typ === 'lager').length,
    manuellt: profil?.bokslut_checklista ?? {},
    neUppgifter: profil?.ne_uppgifter ?? {},
  };
}

/**
 * Personens mejlarkiv, synkat från Gmail av apps-script/sync-mail.gs.
 *
 * Läses bara för den person som visas, inte i build(): kropparna kan vara
 * långa, och listan över alla personer behöver dem inte. Mejlen hittas på
 * alla adresser personen känns igen på, även de handpåkopplade.
 */
async function mailFor(p: Built): Promise<AdminMailMessage[]> {
  const emails = [...new Set(p.aliases.filter((a) => a.startsWith('e:')).map((a) => a.slice(2)))];
  if (!emails.length) return [];

  const { data, error } = await getSupabase()
    .from('mail_messages')
    .select('id, gmail_thread_id, direction, from_email, subject, body, body_raw, attachment_names, sent_at')
    .in('customer_email', emails)
    .order('sent_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Kunde inte läsa mail_messages: ${error.message}`);

  return (data ?? []).reverse().map((r) => ({
    id: r.id,
    threadId: r.gmail_thread_id,
    direction: r.direction as 'in' | 'out',
    from: r.from_email,
    subject: r.subject,
    body: r.body ?? '',
    raw: r.body_raw ?? '',
    attachments: r.attachment_names ?? [],
    at: r.sent_at,
  }));
}

const METODER: Redovisningsmetod[] = ['faktureringsmetoden', 'kontantmetoden'];
const MOMSPERIODER: MomsPeriod[] = ['månadsvis', 'kvartalsvis', 'helår', 'ingen-moms'];

/**
 * Ändrar det Erik själv får bestämma om en person: steget i pipelinen,
 * bokföringsmetoden och momsperioden. Allt annat på raderna är insamlad data och rörs inte.
 *
 * Metoden bor på två ställen eftersom personen gör det: en prospekt har bara
 * en kontaktförfrågan, en kund har en profil, och samma människa hinner vara
 * båda. Skrivningen går därför till alla rader personen äger, inte bara till
 * den GET råkar läsa starkast — annars skulle ett borttaget val vakna till liv
 * igen från den rad som inte skrevs över.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { contactId, profileId, stage, redovisningsmetod, momsPeriod, betalsatt, neUppgifter } = await request.json();
    const supabase = getSupabase();

    // NE-uppgifterna för ett inkomstår ersätter det som fanns för just det året
    if (neUppgifter !== undefined) {
      const ar = String(neUppgifter?.ar ?? '');
      if (!/^d{4}$/.test(ar) || typeof neUppgifter.data !== 'object' || neUppgifter.data === null) {
        return NextResponse.json({ error: 'neUppgifter måste ha ar (ÅÅÅÅ) och data' }, { status: 400 });
      }
      if (!profileId) {
        return NextResponse.json({ error: 'Personen har inget konto att spara NE-uppgifterna på' }, { status: 400 });
      }
      const { data: profil, error: lasFel } = await supabase.from('profiles').select('ne_uppgifter').eq('id', profileId).maybeSingle();
      if (lasFel) return NextResponse.json({ error: lasFel.message }, { status: 500 });
      const alla = { ...(profil?.ne_uppgifter ?? {}), [ar]: neUppgifter.data };
      const { error } = await supabase.from('profiles').update({ ne_uppgifter: alla }).eq('id', profileId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Betalsättet bor på profilen och avgör betalkontot när vi konterar
    if (betalsatt !== undefined) {
      if (betalsatt !== 'foretagskonto' && betalsatt !== 'privatkonto') {
        return NextResponse.json({ error: 'betalsatt måste vara foretagskonto eller privatkonto' }, { status: 400 });
      }
      if (!profileId) {
        return NextResponse.json({ error: 'Personen har inget konto att spara betalsättet på' }, { status: 400 });
      }
      const { error } = await supabase.from('profiles').update({ har_foretagskonto: betalsatt }).eq('id', profileId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Momsperioden bor bara på profilen — kunden väljer den i onboardingen
    if (momsPeriod !== undefined) {
      if (!MOMSPERIODER.includes(momsPeriod)) {
        return NextResponse.json(
          { error: `momsPeriod måste vara ${MOMSPERIODER.join(', ')}` },
          { status: 400 },
        );
      }
      if (!profileId) {
        return NextResponse.json({ error: 'Personen har inget konto att spara momsperioden på' }, { status: 400 });
      }
      const { error } = await supabase.from('profiles').update({ moms_period: momsPeriod }).eq('id', profileId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (redovisningsmetod !== undefined) {
      // null betyder "ta bort valet" — annars måste det vara en av de två.
      if (redovisningsmetod !== null && !METODER.includes(redovisningsmetod)) {
        return NextResponse.json(
          { error: `redovisningsmetod måste vara ${METODER.join(' eller ')}` },
          { status: 400 },
        );
      }
      const targets: { table: 'profiles' | 'contact_requests'; id: string }[] = [];
      if (profileId) targets.push({ table: 'profiles', id: profileId });
      if (contactId) targets.push({ table: 'contact_requests', id: contactId });
      if (!targets.length) {
        return NextResponse.json(
          { error: 'Personen har varken konto eller kontaktförfrågan att spara metoden på' },
          { status: 400 },
        );
      }
      for (const target of targets) {
        const { error } = await supabase
          .from(target.table)
          .update({ redovisningsmetod })
          .eq('id', target.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (!contactId) return NextResponse.json({ error: 'contactId krävs' }, { status: 400 });
    if (!Number.isInteger(stage) || stage < 1 || stage > 5) {
      return NextResponse.json({ error: 'stage måste vara 1–5' }, { status: 400 });
    }
    const { error } = await supabase.from('contact_requests').update({ stage }).eq('id', contactId);
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
 * Vad en radering faktiskt rör, i den ordning främmande nycklar tillåter:
 * barnraderna först, profilen sist, och auth-användaren allra sist.
 *
 * `sms_optouts` står medvetet inte med. Har någon skrivit STOPP ska det gälla
 * även efter att vi rensat bort resten — annars börjar utskicken om från noll
 * nästa gång numret dyker upp. `subscriptions` lämnas också kvar: den raden är
 * vår spegling av Stripe, och att radera den säger inte upp någonting.
 */
interface DeleteStep {
  table: string;
  column: string;
  values: string[];
}

interface DeletePlan {
  steps: DeleteStep[];
  /** Inloggningskonton som ska bort ur auth.users när tabellerna är tömda. */
  authUserIds: string[];
  /** Personen betalar fortfarande i Stripe. Raderingen stoppar inte det. */
  activeSubscription: boolean;
}

async function planDeletion(persons: Built[]): Promise<DeletePlan> {
  const supabase = getSupabase();

  // Flera personer på en gång blir en enda plan. Alternativet — en plan per
  // person — hade läst om samma tabeller en gång per markerad rad.
  const keys = [...new Set(persons.flatMap((p) => [p.key, ...p.aliases]))];
  const emails = keys.filter((k) => k.startsWith('e:')).map((k) => k.slice(2));
  const phones = keys.filter((k) => k.startsWith('p:')).map((k) => k.slice(2));

  const mine = (email: string | null, phone: string | null) => {
    const e = email?.trim().toLowerCase();
    const p = normalizePhone(phone);
    return (!!e && emails.includes(e)) || (!!p && phones.includes(p));
  };

  /**
   * Telefonnummer ligger orörda i databasen — "070-123 45 67" och
   * "+46701234567" är samma nummer men olika strängar, så urvalet måste göras
   * i JS efter normalisering. Tabellerna det gäller rymmer några tiotal rader
   * var, så att hämta hem dem kostar ingenting.
   */
  async function pick(
    table: string,
    columns: string,
    keep: (row: Record<string, string | null>) => boolean,
  ): Promise<string[]> {
    const found: string[] = [];
    // PostgREST kapar svaret vid 1000 rader, så tabellen måste bläddras
    // igenom. Rader vi missar här blir kvar i databasen efter raderingen —
    // tyst, och utan att någon märker det.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
      if (error) throw new Error(`Kunde inte läsa ${table}: ${error.message}`);
      const page = (data ?? []) as unknown as Record<string, string | null>[];
      for (const row of page.filter(keep)) found.push(row.id as string);
      if (page.length < 1000) return found;
    }
  }

  /** Tabeller som bara pekar på ett id klarar sig med en vanlig in-fråga. */
  async function idsWhere(table: string, column: string, values: string[]): Promise<string[]> {
    if (!values.length) return [];
    const found: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table).select('id').in(column, values).range(from, from + 999);
      if (error) throw new Error(`Kunde inte läsa ${table}: ${error.message}`);
      const page = data ?? [];
      for (const row of page) found.push((row as { id: string }).id);
      if (page.length < 1000) return found;
    }
  }

  const profiles = await pick('profiles', 'id, email, phone', (r) => mine(r.email, r.phone));
  const contacts = await pick('contact_requests', 'id, email, phone', (r) => mine(r.email, r.phone));
  const meetings = await pick('meetings', 'id, email, phone', (r) => mine(r.email, r.phone));
  const mails = await pick('email_log', 'id, to_email', (r) => mine(r.to_email, null));
  const links = await pick('pending_registrations', 'id, email', (r) => mine(r.email, null));
  const sms = await pick('sms_messages', 'id, phone, user_id',
    (r) => mine(null, r.phone) || (!!r.user_id && profiles.includes(r.user_id)));
  const orders = await pick('orders', 'id, guest_email, guest_phone, user_id',
    (r) => mine(r.guest_email, r.guest_phone) || (!!r.user_id && profiles.includes(r.user_id)));
  const customers = await idsWhere('kunder', 'user_id', profiles);

  // Ordningen är inte kosmetisk: fakturor pekar på kunder, filer på ordrar och
  // nästan allt på profiles. Flyttar man en rad hit upp fallerar raderingen.
  const steps: DeleteStep[] = [
    { table: 'contact_files', column: 'contact_id', values: contacts },
    { table: 'contact_requests', column: 'id', values: contacts },
    { table: 'meetings', column: 'id', values: meetings },
    { table: 'pending_registrations', column: 'id', values: links },
    { table: 'email_log', column: 'id', values: mails },
    { table: 'mail_messages', column: 'customer_email', values: emails },
    { table: 'sms_messages', column: 'id', values: sms },
    { table: 'files', column: 'order_id', values: orders },
    { table: 'files', column: 'user_id', values: profiles },
    { table: 'user_accounting_documents', column: 'order_id', values: orders },
    { table: 'user_accounting_documents', column: 'user_id', values: profiles },
    { table: 'orders', column: 'id', values: orders },
    { table: 'fakturor', column: 'user_id', values: profiles },
    { table: 'fakturor', column: 'kund_id', values: customers },
    { table: 'kunder', column: 'user_id', values: profiles },
    { table: 'produkter', column: 'user_id', values: profiles },
    { table: 'lagertillgangar', column: 'user_id', values: profiles },
    { table: 'bokforing_transaktioner', column: 'user_id', values: profiles },
    // Verifikationer utan underlag (AI, manuella) följer inte med i kaskaden
    { table: 'verifikationer', column: 'user_id', values: profiles },
    { table: 'verifikationer', column: 'customer_email', values: emails },
    { table: 'transaktioner', column: 'user_id', values: profiles },
    { table: 'transaktioner', column: 'customer_email', values: emails },
    { table: 'bokforing_underlag', column: 'user_id', values: profiles },
    { table: 'bokforing_underlag', column: 'sender_email', values: emails },
    { table: 'manual_transactions', column: 'user_id', values: profiles },
    { table: 'manual_transactions', column: 'guest_email', values: emails },
    { table: 'parsed_transactions', column: 'user_id', values: profiles },
    { table: 'parsed_transactions', column: 'guest_email', values: emails },
    { table: 'funnel_events', column: 'user_id', values: profiles },
    { table: 'sie_files', column: 'kund_id', values: profiles },
    { table: 'email_threads', column: 'user_id', values: profiles },
    { table: 'profiles', column: 'id', values: profiles },
  ].filter((step) => step.values.length > 0);

  let activeSubscription = false;
  if (emails.length) {
    const { data } = await supabase.from('subscriptions').select('status').in('email', emails);
    activeSubscription = (data ?? []).some((row) =>
      ['active', 'trialing', 'past_due'].includes((row as { status: string }).status));
  }

  return { steps, authUserIds: profiles, activeSubscription };
}

/**
 * PostgREST tar emot urvalet som en frågesträng, så en `in`-lista med tusentals
 * id:n blir en URL som servern vägrar. Markerar man hela listan i panelen är vi
 * snabbt där, alltså går varje steg i portioner.
 */
function chunks(values: string[], size = 200): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/** Räknar rader per tabell utan att röra något — underlaget till bekräftelsen. */
async function previewDeletion(plan: DeletePlan) {
  const supabase = getSupabase();

  const counted = await Promise.all(plan.steps.map(async (step) => {
    let rows = 0;
    for (const part of chunks(step.values)) {
      const { count, error } = await supabase
        .from(step.table)
        .select('id', { count: 'exact', head: true })
        .in(step.column, part);
      if (error) throw new Error(`Kunde inte räkna ${step.table}: ${error.message}`);
      rows += count ?? 0;
    }
    return { table: step.table, rows };
  }));

  // Samma tabell kan träffas via flera kolumner — slå ihop dem till en rad
  const perTable = new Map<string, number>();
  for (const { table, rows } of counted) {
    if (rows > 0) perTable.set(table, (perTable.get(table) ?? 0) + rows);
  }

  return {
    tables: [...perTable].map(([table, rows]) => ({ table, rows })),
    total: [...perTable.values()].reduce((sum, n) => sum + n, 0),
    authUsers: plan.authUserIds.length,
    activeSubscription: plan.activeSubscription,
  };
}


/**
 * Raderar en eller flera personer ur alla tabeller de förekommer i, inklusive
 * inloggningskontot. Tar `key` för en person eller `keys` för flera.
 *
 * Med `dryRun: true` raderas ingenting — då kommer bara sammanställningen av
 * vad som skulle försvinna tillbaka, den som bekräftelserutan visar upp. Rutan
 * är också hela skyddet: det finns ingen bekräftelsesträng och inget sätt att
 * ångra sig efteråt.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const wanted: string[] = Array.isArray(body.keys) ? body.keys : body.key ? [body.key] : [];
    if (!wanted.length) return NextResponse.json({ error: 'key eller keys krävs' }, { status: 400 });

    const people = await build();
    // Två markerade rader kan visa sig vara samma person — nyckeln avgör
    const targets = new Map<string, Built>();
    const missing: string[] = [];
    for (const key of wanted) {
      const found = locate(people, key);
      if (found) targets.set(found.key, found);
      else missing.push(key);
    }
    if (missing.length) {
      return NextResponse.json(
        { error: `Hittade ingen person för ${missing.join(', ')}` },
        { status: 404 },
      );
    }

    const plan = await planDeletion([...targets.values()]);
    if (body.dryRun) return NextResponse.json({ preview: await previewDeletion(plan) });

    const supabase = getSupabase();
    for (const step of plan.steps) {
      for (const part of chunks(step.values)) {
        const { error } = await supabase.from(step.table).delete().in(step.column, part);
        if (error) {
          return NextResponse.json(
            { error: `Stannade vid ${step.table}: ${error.message}. Det som hann raderas är borta.` },
            { status: 500 },
          );
        }
      }
    }

    // Auth-användaren sist: profilraden pekar på den, så den måste vara borta
    // först. Går det ändå fel står personen kvar med ett tomt konto.
    for (const id of plan.authUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) {
        return NextResponse.json(
          { error: `All data är raderad men inloggningen finns kvar: ${error.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/people DELETE]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
