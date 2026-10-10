import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { build, emailKey, locate, phoneKey, summary, type Built } from '@/lib/personer';
import type {
  AiAnteckning, Arende, InkorgKategori, InkorgKonversation, InkorgMeddelande, InkorgTrad, InkorgUtkast, MomsPeriod, Redovisningsmetod,
} from '@/lib/admin-types';
import { callScript } from '@/lib/emails/send-via-gmail';
import { identifySender } from '@/lib/sms/identify';
import { generateSmsReply } from '@/lib/sms/answer';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { handleUnknownUser } from '@/lib/inmail/handlers/unknown-user';
import { smsKontextForMejl } from '@/lib/inkorg/kontext';
import { normalizePhone } from '@/lib/sms/phone';

/**
 * Inkorgen: mejl och SMS per person, med utkasten som väntar.
 *
 * GET              → konversationerna, nyast först
 * GET ?key=        → hela tråden för en person: mejl och SMS i tidsordning
 * POST { action }  → läst, skicka/spara/släng mejlutkast, nytt mejl,
 *                    AI-utkast på begäran, ombudsuppgifterna
 *
 * SMS-utkasten ligger kvar i sms_messages (status 'draft') och skickas med
 * /api/admin/sms-drafts som förut.
 */

export const maxDuration = 120;

type Supabase = ReturnType<typeof createServerClient>;


/** Utgående SMS som kunden faktiskt fått eller som misslyckats. Utkast och slängda visas inte i tråden. */
const SYNLIGA_SMS = ['sent', 'delivered', 'queued', 'sending', 'failed'];

const MAX_RADER = 3000;

/** SMS-mallarna som går ut av sig själva. De visas nedtonade och räknas inte som en konversation. */
const AUTOMATISKA = ['lead_welcome', 'lead_paminnelse', 'lead_booking', 'mejl_notis', 'meeting_reminder'];

function kategori(p: Built, ombud: Map<string, string | null>): InkorgKategori {
  if (!p.profileId) return 'lead';
  return ombud.get(p.profileId) ? 'kund' : 'saknar';
}

const visningsnamn = (p: Built) => p.name || p.company || p.email || p.phone || p.key;

async function lasData(supabase: Supabase) {
  const [mejl, sms, mejlUtkast, last, profiler] = await Promise.all([
    supabase.from('mail_messages')
      .select('gmail_message_id, gmail_thread_id, direction, customer_email, subject, body, attachment_names, sent_at')
      .order('sent_at', { ascending: false }).limit(MAX_RADER),
    supabase.from('sms_messages')
      .select('id, phone, direction, body, status, error, kind, created_at')
      .order('created_at', { ascending: false }).limit(MAX_RADER),
    supabase.from('mejl_utkast').select('id, till_email, amne, text, svar_pa_message_id, fel, created_at').eq('status', 'draft'),
    supabase.from('inkorg_last').select('alias, last_read_at'),
    supabase.from('profiles').select('id, ombud_klart_at, moms_period, start_ar, redovisningsmetod'),
  ]);
  const fel = mejl.error ?? sms.error ?? mejlUtkast.error ?? last.error ?? profiler.error;
  if (fel) throw new Error(fel.message);
  return {
    mejl: mejl.data ?? [],
    sms: sms.data ?? [],
    mejlUtkast: mejlUtkast.data ?? [],
    last: new Map((last.data ?? []).map((r) => [r.alias as string, r.last_read_at as string])),
    profiler: profiler.data ?? [],
  };
}

/** Alla meddelanden och utkast per person, via personens adresser och nummer. */
function grupperaPerPerson(people: Map<string, Built>, data: Awaited<ReturnType<typeof lasData>>) {
  const perAlias = new Map<string, Built>();
  for (const p of people.values()) for (const a of p.aliases) perAlias.set(a, p);

  const per = new Map<string, { person: Built; meddelanden: InkorgMeddelande[]; utkast: InkorgUtkast[] }>();
  const fa = (p: Built) => {
    if (!per.has(p.key)) per.set(p.key, { person: p, meddelanden: [], utkast: [] });
    return per.get(p.key)!;
  };

  for (const m of data.mejl) {
    const p = perAlias.get(emailKey(m.customer_email) ?? '');
    if (!p) continue;
    fa(p).meddelanden.push({
      id: m.gmail_message_id, kanal: 'mejl', riktning: m.direction, at: m.sent_at, text: m.body ?? '',
      amne: m.subject, gmailMessageId: m.gmail_message_id, gmailThreadId: m.gmail_thread_id, bilagor: m.attachment_names ?? [],
    });
  }
  for (const s of data.sms) {
    const p = perAlias.get(phoneKey(s.phone) ?? '');
    if (!p) continue;
    if (s.direction === 'out' && s.status === 'draft') {
      fa(p).utkast.push({ id: s.id, kanal: 'sms', text: s.body, till: s.phone, at: s.created_at });
      continue;
    }
    if (s.direction === 'out' && !SYNLIGA_SMS.includes(s.status ?? 'sent')) continue;
    fa(p).meddelanden.push({
      id: s.id, kanal: 'sms', riktning: s.direction, at: s.created_at, text: s.body, status: s.status,
      automatisk: AUTOMATISKA.includes(s.kind ?? ''),
    });
  }
  for (const u of data.mejlUtkast) {
    const p = perAlias.get(emailKey(u.till_email) ?? '');
    if (!p) continue;
    fa(p).utkast.push({ id: u.id, kanal: 'mejl', text: u.text, till: u.till_email, amne: u.amne, svarPa: u.svar_pa_message_id, fel: u.fel, at: u.created_at });
  }
  for (const v of per.values()) {
    v.meddelanden.sort((a, b) => a.at.localeCompare(b.at));
    v.utkast.sort((a, b) => a.at.localeCompare(b.at));
  }
  return per;
}

/** När konversationen senast öppnades, över alla personens adresser. Tom sträng = aldrig öppnad. */
function senastLast(p: Built, last: Map<string, string>): string {
  return p.aliases.reduce((max, a) => {
    const t = last.get(a);
    return t && t > max ? t : max;
  }, '');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const [people, data] = await Promise.all([build(), lasData(supabase)]);
    const ombud = new Map(data.profiler.map((p) => [p.id as string, p.ombud_klart_at as string | null]));
    const per = grupperaPerPerson(people, data);

    const key = request.nextUrl.searchParams.get('key');
    if (key) {
      const p = locate(people, key);
      if (!p) return NextResponse.json({ error: 'Hittade ingen sådan person' }, { status: 404 });
      const v = per.get(p.key);
      const profil = p.profileId ? data.profiler.find((x) => x.id === p.profileId) : null;
      const nycklar = [...new Set([...p.aliases.map((a) => a.slice(2)), p.email, p.phone].filter((x): x is string => !!x))];
      const mejladresser = p.aliases.filter((a) => a.startsWith('e:')).map((a) => a.slice(2));
      const telefoner = p.aliases.filter((a) => a.startsWith('p:')).map((a) => a.slice(2));
      const { data: anteckningar } = await supabase.from('ai_anteckningar').select('id, text, omfang, created_at')
        .or([
          'omfang.eq.generell',
          ...(mejladresser.length ? [`email.in.(${mejladresser.map((x) => `"${x}"`).join(',')})`] : []),
          ...(telefoner.length ? [`telefon.in.(${telefoner.map((x) => `"${x}"`).join(',')})`] : []),
        ].join(','))
        .order('created_at');
      const { data: arenden } = await supabase.from('arenden')
        .select('id, titel, beskrivning, datum, status, person_key, person_namn, kalla, created_at, klar_at')
        .eq('status', 'oppen').in('person_key', nycklar).order('datum');

      const trad: InkorgTrad = {
        person: summary(p),
        kategori: kategori(p, ombud),
        uppgifter: profil ? {
          momsPeriod: profil.moms_period as MomsPeriod | null,
          startAr: profil.start_ar as number | null,
          redovisningsmetod: profil.redovisningsmetod as Redovisningsmetod | null,
          ombudKlart: profil.ombud_klart_at as string | null,
        } : null,
        meddelanden: v?.meddelanden ?? [],
        utkast: v?.utkast ?? [],
        arenden: (arenden ?? []).map((r): Arende => ({
          id: r.id, titel: r.titel, beskrivning: r.beskrivning, datum: r.datum, status: r.status,
          personKey: r.person_key, personNamn: r.person_namn, kalla: r.kalla, skapad: r.created_at, klar: r.klar_at,
        })),
        anteckningar: (anteckningar ?? []).map((a): AiAnteckning => ({ id: a.id, text: a.text, omfang: a.omfang, at: a.created_at })),
      };
      return NextResponse.json(trad);
    }

    const konversationer: InkorgKonversation[] = [];
    for (const { person: p, meddelanden, utkast } of per.values()) {
      // Först när personen själv skrivit till oss blir det en konversation. Det
      // vi skickat ut (välkomstmejlet till leads, utskick) syns inte förrän de
      // svarar — då finns det med i tråden som sammanhang.
      const riktiga = meddelanden.filter((m) => !m.automatisk);
      if (!riktiga.some((m) => m.riktning === 'in') && !utkast.length) continue;
      const sista = riktiga[riktiga.length - 1];
      const sistaIn = [...meddelanden].reverse().find((m) => m.riktning === 'in');
      const visa = sista ?? { kanal: utkast[0].kanal, riktning: 'out' as const, text: utkast[0].text, amne: utkast[0].amne ?? null, at: utkast[0].at };
      konversationer.push({
        key: p.key,
        namn: visningsnamn(p),
        email: p.email,
        phone: p.phone,
        kategori: kategori(p, ombud),
        senaste: { kanal: visa.kanal, riktning: visa.riktning, text: visa.text.replace(/\s+/g, ' ').slice(0, 160), amne: visa.amne ?? null, at: visa.at },
        olast: !!sistaIn && sistaIn.at > senastLast(p, data.last),
        utkast: utkast.length,
      });
    }
    konversationer.sort((a, b) => b.senaste.at.localeCompare(a.senaste.at));
    return NextResponse.json({ konversationer });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/inkorg]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const fel = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Skickar ett mejlutkast: svar i tråden om det finns ett mejl att svara på, annars ett nytt mejl. */
async function skickaMejl(supabase: Supabase, id: string, text: string, amne?: string) {
  const { data: claimed, error } = await supabase.from('mejl_utkast')
    .update({ status: 'sending', text, ...(amne !== undefined ? { amne } : {}), updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'draft')
    .select('id, till_email, amne, svar_pa_message_id').maybeSingle();
  if (error) return fel(error.message, 500);
  if (!claimed) return fel('Utkastet är redan skickat eller hanteras av någon annan', 409);

  const res = await callScript(claimed.svar_pa_message_id
    ? { action: 'reply', messageId: claimed.svar_pa_message_id, text }
    : { action: 'compose', to: claimed.till_email, subject: claimed.amne || 'Enkla Bokslut', text });

  if (!res.ok) {
    // Tillbaka som utkast, så att det går att försöka igen
    await supabase.from('mejl_utkast').update({ status: 'draft', fel: res.error ?? 'Okänt fel' }).eq('id', id);
    return fel(res.error ?? 'Mejlet kunde inte skickas', 502);
  }
  await supabase.from('mejl_utkast').update({ status: 'sent', sent_at: new Date().toISOString(), fel: null }).eq('id', id);
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    switch (body.action) {
      case 'last': {
        const p = locate(await build(), String(body.key ?? ''));
        if (!p) return fel('Hittade ingen sådan person', 404);
        const nu = new Date().toISOString();
        const { error } = await supabase.from('inkorg_last').upsert(p.aliases.map((alias) => ({ alias, last_read_at: nu })));
        if (error) return fel(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case 'skicka-mejl':
        if (!body.id || !text) return fel('id och text krävs');
        return skickaMejl(supabase, body.id, text, typeof body.amne === 'string' ? body.amne : undefined);

      case 'spara-mejl': {
        if (!body.id || !text) return fel('id och text krävs');
        const { error } = await supabase.from('mejl_utkast').update({ text, updated_at: new Date().toISOString() }).eq('id', body.id).eq('status', 'draft');
        return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
      }

      case 'slang-mejl': {
        if (!body.id) return fel('id krävs');
        const { error } = await supabase.from('mejl_utkast').update({ status: 'discarded', updated_at: new Date().toISOString() }).eq('id', body.id).eq('status', 'draft');
        return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
      }

      case 'nytt-mejl': {
        // Ett mejl vi skriver själva. Svarar i tråden om `svarPa` är satt.
        const till = String(body.till ?? '').trim().toLowerCase();
        if (!till.includes('@') || !text) return fel('Mottagare och text krävs');
        const { data, error } = await supabase.from('mejl_utkast').insert({
          till_email: till, amne: String(body.amne ?? '').trim() || null, text,
          svar_pa_message_id: body.svarPa || null, kalla: 'manuell',
        }).select('id').single();
        if (error) return fel(error.message, 500);
        return skickaMejl(supabase, data.id, text);
      }

      case 'ai-utkast':
        return aiUtkast(supabase, String(body.key ?? ''), body.kanal === 'sms' ? 'sms' : 'mejl');

      case 'skriv-om': {
        // Nytt utkast först. Går det inte ligger det gamla kvar.
        if (!body.id) return fel('id krävs');
        const kanal = body.kanal === 'sms' ? 'sms' : 'mejl';
        const svar = await aiUtkast(supabase, String(body.key ?? ''), kanal);
        if (!svar.ok) return svar;
        await (kanal === 'sms'
          ? supabase.from('sms_messages').update({ status: 'discarded' }).eq('id', body.id).eq('status', 'draft')
          : supabase.from('mejl_utkast').update({ status: 'discarded', updated_at: new Date().toISOString() }).eq('id', body.id).eq('status', 'draft'));
        return NextResponse.json({ ok: true });
      }

      case 'anteckning-ny': {
        if (!text) return fel('Anteckningen är tom');
        const omfang = body.omfang === 'generell' ? 'generell' : 'kund';
        let rad: Record<string, unknown> = { text, omfang };
        if (omfang === 'kund') {
          const p = locate(await build(), String(body.key ?? ''));
          if (!p) return fel('Hittade ingen sådan person', 404);
          rad = { ...rad, email: p.email?.toLowerCase() ?? null, telefon: normalizePhone(p.phone), person_namn: p.name || p.company || null };
        }
        const { error } = await supabase.from('ai_anteckningar').insert(rad);
        return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
      }

      case 'anteckning-bort': {
        if (!body.id) return fel('id krävs');
        const { error } = await supabase.from('ai_anteckningar').delete().eq('id', body.id);
        return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
      }

      case 'ombud': {
        if (!body.profileId) return fel('profileId krävs');
        const andring: Record<string, unknown> = {};
        if ('klart' in body) andring.ombud_klart_at = body.klart ? new Date().toISOString() : null;
        if ('momsPeriod' in body) andring.moms_period = body.momsPeriod || null;
        if ('startAr' in body) andring.start_ar = body.startAr ? Number(body.startAr) : null;
        if ('redovisningsmetod' in body) andring.redovisningsmetod = body.redovisningsmetod || null;
        const { error } = await supabase.from('profiles').update(andring).eq('id', body.profileId);
        return error ? fel(error.message, 500) : NextResponse.json({ ok: true, ombudKlart: andring.ombud_klart_at ?? null });
      }

      default:
        return fel('Okänd action');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/inkorg]', message);
    return fel(message, 500);
  }
}

/**
 * Ett nytt AI-utkast på begäran, med samma AI och prompt som när ett meddelande
 * kommer in. Svarar på det senaste personen skickat i den kanalen.
 */
async function aiUtkast(supabase: Supabase, key: string, kanal: 'mejl' | 'sms') {
  const people = await build();
  const p = locate(people, key);
  if (!p) return fel('Hittade ingen sådan person', 404);
  const data = await lasData(supabase);
  const v = grupperaPerPerson(people, data).get(p.key);
  const meddelanden = v?.meddelanden ?? [];

  if (kanal === 'sms') {
    if (!p.phone) return fel('Personen har inget telefonnummer');
    const sender = await identifySender(supabase, p.phone);
    const senaste = [...meddelanden].reverse().find((m) => m.kanal === 'sms' && m.riktning === 'in');
    const svar = await generateSmsReply({
      supabase, phone: p.phone, sender,
      message: senaste?.text ?? '(Personen har inte skrivit något nytt. Skriv ett kort, relevant SMS utifrån konversationen.)',
    });
    if (!svar) return fel('AI:n skrev inget', 502);
    const { error } = await supabase.from('sms_messages').insert({ phone: p.phone, direction: 'out', body: svar, user_id: sender.userId, status: 'draft' });
    return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
  }

  const mejl = meddelanden.filter((m) => m.kanal === 'mejl');
  const senaste = [...mejl].reverse().find((m) => m.riktning === 'in');
  const email = p.email;
  if (!email) return fel('Personen har ingen mejladress');

  const historik = mejl.slice(-15).map((m) => `From: ${m.riktning === 'in' ? email : 'erik@enklabokslut.se'}\nDate: ${m.at}\n\n${m.text}`).join('\n\n---\n\n');
  const smsKontext = await smsKontextForMejl(supabase, email);
  const amne = senaste?.amne ?? mejl[mejl.length - 1]?.amne ?? '';

  let svar: { replyBody: string };
  if (p.profileId) {
    const { data: profil } = await supabase.from('profiles').select('id, full_name, email').eq('id', p.profileId).single();
    svar = await handleGeneralQuestion({
      supabase, profile: profil!, subject: amne, body: senaste?.text ?? '', emailHistory: historik || undefined, smsKontext,
    });
  } else if (senaste?.gmailThreadId && senaste.gmailMessageId) {
    svar = await handleUnknownUser({
      supabase, senderEmail: email, subject: amne, body: senaste.text,
      gmailThreadId: senaste.gmailThreadId, messageId: senaste.gmailMessageId, emailHistory: historik || undefined, smsKontext,
    });
  } else {
    return fel('Leadet har inte mejlat oss — skriv mejlet själv');
  }
  if (!svar.replyBody?.trim()) return fel('AI:n skrev inget', 502);

  const { error } = await supabase.from('mejl_utkast').insert({
    till_email: email, amne: amne || null, text: svar.replyBody.trim(),
    gmail_thread_id: senaste?.gmailThreadId ?? null, svar_pa_message_id: senaste?.gmailMessageId ?? null, kalla: 'manuell',
  });
  return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
}
