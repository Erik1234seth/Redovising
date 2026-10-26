import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { build, emailKey, locate, phoneKey, summary, type Built } from '@/lib/personer';
import type {
  AiAnteckning, Arende, InkorgKategori, InkorgKonversation, InkorgMeddelande, InkorgTrad, InkorgUtkast, MejlBilaga,
} from '@/lib/admin-types';
import { callScript } from '@/lib/emails/send-via-gmail';
import { UNDERLAG_BUCKET } from '@/lib/inmail/save-attachments';
import { identifySender } from '@/lib/sms/identify';
import { generateSmsReply } from '@/lib/sms/answer';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { handleUnknownUser } from '@/lib/inmail/handlers/unknown-user';
import { smsKontextForMejl } from '@/lib/inkorg/kontext';
import { normalizePhone } from '@/lib/sms/phone';
import { arUnderlagsmejl, startaUnderlagsflode } from '@/lib/underlag-kontroll';

/**
 * Inkorgen: mejl och SMS per person, med utkasten som väntar.
 *
 * GET              → konversationerna, nyast först
 * GET ?key=        → hela tråden för en person: mejl och SMS i tidsordning
 * POST { action }  → läst, oläst, ta bort ur inkorgen, skicka/spara/släng
 *                    mejlutkast, nytt mejl, AI-utkast på begäran
 *
 * SMS-utkasten ligger kvar i sms_messages (status 'draft') och skickas med
 * /api/admin/sms-drafts som förut.
 */

/** "Skriv om" på ett underlagsmejl läser och kontrollerar filerna, och det tar minuter. */
export const maxDuration = 300;

type Supabase = ReturnType<typeof createServerClient>;


/** Utgående SMS som kunden faktiskt fått eller som misslyckats. Utkast och slängda visas inte i tråden. */
const SYNLIGA_SMS = ['sent', 'delivered', 'queued', 'sending', 'failed'];

const MAX_RADER = 3000;

/**
 * Mejl vi skickat från inkorgen syns direkt, utan att vänta på att synk-scriptet
 * (var 5:e minut) hämtat in dem från Gmail. När Gmails kopia finns — ett utgående
 * mejl till personen skickat runt samma tid eller senare — visas den i stället.
 */
const SKICKADE_DAGAR = 2;
const SKICKAD_MARGINAL_MS = 5 * 60_000;

/** SMS-mallarna som går ut av sig själva. De visas nedtonade och räknas inte som en konversation. */
const AUTOMATISKA = ['lead_welcome', 'lead_paminnelse', 'lead_booking', 'mejl_notis', 'meeting_reminder'];

/** Ett konto blir kund när startåret och bokföringsmetoden finns, oavsett om de fylls i här eller i personvyn. */
function kategori(p: Built, klara: Set<string>): InkorgKategori {
  if (!p.profileId) return 'lead';
  return klara.has(p.profileId) ? 'kund' : 'saknar';
}

const visningsnamn = (p: Built) => p.name || p.company || p.email || p.phone || p.key;

async function lasData(supabase: Supabase) {
  const [mejl, sms, mejlUtkast, skickade, last, dolda, profiler] = await Promise.all([
    supabase.from('mail_messages')
      .select('gmail_message_id, gmail_thread_id, direction, customer_email, subject, body, attachment_names, sent_at')
      .order('sent_at', { ascending: false }).limit(MAX_RADER),
    supabase.from('sms_messages')
      .select('id, phone, direction, body, status, error, kind, created_at')
      .order('created_at', { ascending: false }).limit(MAX_RADER),
    supabase.from('mejl_utkast').select('id, till_email, amne, text, svar_pa_message_id, fel, created_at').eq('status', 'draft'),
    supabase.from('mejl_utkast').select('id, till_email, amne, text, bilagor, sent_at').eq('status', 'sent')
      .gte('sent_at', new Date(Date.now() - SKICKADE_DAGAR * 86_400_000).toISOString()),
    supabase.from('inkorg_last').select('alias, last_read_at'),
    supabase.from('inkorg_dold').select('alias, dold_at'),
    supabase.from('profiles').select('id, start_ar, redovisningsmetod'),
  ]);
  const fel = mejl.error ?? sms.error ?? mejlUtkast.error ?? skickade.error ?? last.error ?? dolda.error ?? profiler.error;
  if (fel) throw new Error(fel.message);
  return {
    mejl: mejl.data ?? [],
    sms: sms.data ?? [],
    mejlUtkast: mejlUtkast.data ?? [],
    skickade: skickade.data ?? [],
    last: new Map((last.data ?? []).map((r) => [r.alias as string, r.last_read_at as string])),
    dolda: new Map((dolda.data ?? []).map((r) => [r.alias as string, r.dold_at as string])),
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
      amne: m.subject, gmailMessageId: m.gmail_message_id, gmailThreadId: m.gmail_thread_id, adress: m.customer_email ?? undefined,
      bilagor: m.attachment_names ?? [],
    });
  }
  for (const u of data.skickade) {
    const p = perAlias.get(emailKey(u.till_email) ?? '');
    if (!p || !u.sent_at) continue;
    const fran = new Date(new Date(u.sent_at).getTime() - SKICKAD_MARGINAL_MS).toISOString();
    if (fa(p).meddelanden.some((m) => m.kanal === 'mejl' && m.riktning === 'out' && !!m.gmailMessageId && m.at >= fran)) continue;
    fa(p).meddelanden.push({
      id: `skickat-${u.id}`, kanal: 'mejl', riktning: 'out', at: u.sent_at, text: u.text ?? '', amne: u.amne, adress: u.till_email,
      bilagor: lasBilagor(u.bilagor).map((b) => b.namn),
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

/** Senaste tidpunkten över alla personens adresser, t.ex. när konversationen öppnades. Tom sträng = aldrig. */
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
    const klara = new Set(data.profiler.filter((p) => p.start_ar && p.redovisningsmetod).map((p) => p.id as string));
    const per = grupperaPerPerson(people, data);

    const key = request.nextUrl.searchParams.get('key');
    if (key) {
      const p = locate(people, key);
      if (!p) return NextResponse.json({ error: 'Hittade ingen sådan person' }, { status: 404 });
      const v = per.get(p.key);
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
        kategori: kategori(p, klara),
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
      // Borttagen ur inkorgen: syns igen först när något nytt kommer in eller ett nytt utkast skrivs
      const dold = senastLast(p, data.dolda);
      const nyast = [sista?.at ?? '', ...utkast.map((u) => u.at)].reduce((a, b) => (b > a ? b : a), '');
      if (dold && nyast <= dold) continue;
      const sistaIn = [...meddelanden].reverse().find((m) => m.riktning === 'in');
      const visa = sista ?? { kanal: utkast[0].kanal, riktning: 'out' as const, text: utkast[0].text, amne: utkast[0].amne ?? null, at: utkast[0].at };
      konversationer.push({
        key: p.key,
        namn: visningsnamn(p),
        email: p.email,
        phone: p.phone,
        kategori: kategori(p, klara),
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

/**
 * Bilagor laddas upp av webbläsaren direkt till lagringen (Vercel tar inte emot
 * mer än 4,5 MB i en förfrågan), och scriptet hämtar dem själv via länkar som
 * gäller en kort stund. Gmail tar max 25 MB per mejl.
 */
const BILAGA_MAPP = 'mejlbilagor/';
const BILAGA_LANK_SEKUNDER = 15 * 60;

/** Bilagorna i en förfrågan, bara sådana som ligger i bilagemappen. */
function lasBilagor(v: unknown): MejlBilaga[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((b): b is MejlBilaga => !!b && typeof b.path === 'string' && b.path.startsWith(BILAGA_MAPP) && !b.path.includes('..'))
    .map((b) => ({ path: b.path, namn: String(b.namn || b.path.split('/').pop()).slice(0, 200) }));
}

/** Skickar ett mejlutkast: svar i tråden om det finns ett mejl att svara på, annars ett nytt mejl. */
async function skickaMejl(supabase: Supabase, id: string, text: string, amne?: string, bilagor?: MejlBilaga[]) {
  const { data: claimed, error } = await supabase.from('mejl_utkast')
    .update({
      status: 'sending', text, ...(amne !== undefined ? { amne } : {}), ...(bilagor ? { bilagor } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id).eq('status', 'draft')
    .select('id, till_email, amne, svar_pa_message_id, bilagor').maybeSingle();
  if (error) return fel(error.message, 500);
  if (!claimed) return fel('Utkastet är redan skickat eller hanteras av någon annan', 409);

  const filer = lasBilagor(claimed.bilagor);
  const attachments: { url: string; name: string }[] = [];
  for (const b of filer) {
    const { data, error: lankFel } = await supabase.storage.from(UNDERLAG_BUCKET).createSignedUrl(b.path, BILAGA_LANK_SEKUNDER);
    if (lankFel || !data) {
      await supabase.from('mejl_utkast').update({ status: 'draft', fel: `Bilagan ${b.namn} gick inte att hämta` }).eq('id', id);
      return fel(`Bilagan ${b.namn} gick inte att hämta: ${lankFel?.message ?? 'okänt fel'}`, 500);
    }
    attachments.push({ url: data.signedUrl, name: b.namn });
  }

  const res = await callScript(claimed.svar_pa_message_id
    ? { action: 'reply', messageId: claimed.svar_pa_message_id, text, attachments }
    : { action: 'compose', to: claimed.till_email, subject: claimed.amne || 'Enkla Bokslut', text, attachments });

  if (!res.ok) {
    // Tillbaka som utkast, så att det går att försöka igen
    await supabase.from('mejl_utkast').update({ status: 'draft', fel: res.error ?? 'Okänt fel' }).eq('id', id);
    return fel(res.error ?? 'Mejlet kunde inte skickas', 502);
  }
  await supabase.from('mejl_utkast').update({ status: 'sent', sent_at: new Date().toISOString(), fel: null }).eq('id', id);
  // En äldre version av send-mail.gs bortser från bilagorna men skickar ändå
  if (attachments.length && res.bilagor === undefined) {
    return fel('Mejlet skickades, men UTAN bilagor: send-mail.gs i Apps Script behöver publiceras om med den nya versionen.', 502);
  }
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

      case 'olast':
      case 'dolj': {
        // Flera på en gång: de markerade i listan
        const keys: string[] = Array.isArray(body.keys) ? body.keys.map(String) : [];
        if (!keys.length) return fel('keys krävs');
        const people = await build();
        const aliases = [...new Set(keys.flatMap((k) => locate(people, k)?.aliases ?? []))];
        if (!aliases.length) return fel('Hittade ingen sådan person', 404);
        const { error } = body.action === 'olast'
          ? await supabase.from('inkorg_last').delete().in('alias', aliases)
          : await supabase.from('inkorg_dold').upsert(aliases.map((alias) => ({ alias, dold_at: new Date().toISOString() })));
        return error ? fel(error.message, 500) : NextResponse.json({ ok: true });
      }

      case 'skicka-mejl':
        if (!body.id || !text) return fel('id och text krävs');
        return skickaMejl(supabase, body.id, text, typeof body.amne === 'string' ? body.amne : undefined,
          'bilagor' in body ? lasBilagor(body.bilagor) : undefined);

      case 'bilaga-forbered': {
        // Uppladdningslänk för en fil som ska bifogas. Webbläsaren laddar upp själv.
        const safe = String(body.namn || 'fil').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        const path = `${BILAGA_MAPP}${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}_${safe}`;
        const { data, error } = await supabase.storage.from(UNDERLAG_BUCKET).createSignedUploadUrl(path);
        if (error || !data) return fel(`Kunde inte skapa uppladdningslänk: ${error?.message}`, 500);
        return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
      }

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
        // Från "Nytt mejl": en person vi kanske inte känner sedan förut. Utan en
        // rad någonstans syns konversationen aldrig i inkorgen, och utan numret
        // där mejl-notisen letar (mail-notice.ts) går inget SMS efter mejlet.
        if ('namn' in body || 'telefon' in body) {
          const telefon = String(body.telefon ?? '').trim();
          if (telefon && !normalizePhone(telefon)) return fel('Telefonnumret ser inte rätt ut');
          const p = locate(await build(), till);
          const nyttNummer = !!telefon && !p?.aliases.includes(phoneKey(telefon) ?? '');
          if (!p || nyttNummer) {
            const { error: leadFel } = await supabase.from('contact_requests').insert({
              email: till, name: String(body.namn ?? '').trim() || null, phone: telefon || null,
              package_type: 'komplett', ref: 'manuell',
            });
            if (leadFel) return fel(leadFel.message, 500);
          }
        }
        const { data, error } = await supabase.from('mejl_utkast').insert({
          till_email: till, amne: String(body.amne ?? '').trim() || null, text,
          svar_pa_message_id: body.svarPa || null, kalla: 'manuell', bilagor: lasBilagor(body.bilagor),
        }).select('id').single();
        if (error) return fel(error.message, 500);
        return skickaMejl(supabase, data.id, text);
      }

      case 'ai-utkast':
        return aiUtkast(supabase, request.nextUrl.origin, String(body.key ?? ''), body.kanal === 'sms' ? 'sms' : 'mejl');

      case 'skriv-om': {
        // Nytt utkast först. Går det inte ligger det gamla kvar.
        if (!body.id) return fel('id krävs');
        const kanal = body.kanal === 'sms' ? 'sms' : 'mejl';
        const svar = await aiUtkast(supabase, request.nextUrl.origin, String(body.key ?? ''), kanal, String(body.id));
        if (!svar.ok) return svar;
        // Underlagsflödet skriver det nya utkastet om några minuter och kastar
        // det gamla då själv
        if ((await svar.clone().json()).pagar) return svar;
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
async function aiUtkast(supabase: Supabase, bas: string, key: string, kanal: 'mejl' | 'sms', ersatterUtkast?: string) {
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
  // Svaret går till adressen kunden senast skrev från, även om den är en
  // kopplad adress och inte den som står på kontot
  const email = senaste?.adress || p.email;
  if (!email) return fel('Personen har ingen mejladress');

  const historik = mejl.slice(-15).map((m) => `From: ${m.riktning === 'in' ? email : 'erik@enklabokslut.se'}\nDate: ${m.at}\n\n${m.text}`).join('\n\n---\n\n');
  const smsKontext = await smsKontextForMejl(supabase, email);
  const amne = senaste?.amne ?? mejl[mejl.length - 1]?.amne ?? '';

  let svar: { replyBody: string };
  if (p.profileId) {
    const { data: profil } = await supabase.from('profiles').select('id, full_name, email').eq('id', p.profileId).single();

    // Samma väg som när mejlet kom in: handlar det om underlag läses filerna
    // och kontrolleras först, och flödet skriver utkastet självt
    if (senaste?.gmailMessageId && senaste.gmailThreadId) {
      const sortering = await arUnderlagsmejl({
        supabase, profil: profil!, amne, text: senaste.text, messageId: senaste.gmailMessageId,
        harBilagor: !!senaste.bilagor?.length,
      });
      if (sortering.underlag) {
        // Flödet går i omgångar i bakgrunden (avläsningen kan ta minuter),
        // så utkastet dyker upp i inkorgen när det är klart
        await startaUnderlagsflode(bas, {
          profilId: profil!.id, avsandare: email, messageId: senaste.gmailMessageId, threadId: senaste.gmailThreadId,
          amne, text: senaste.text, filer: sortering.filer, kalla: 'manuell', ersatterUtkast,
        });
        return NextResponse.json({ ok: true, pagar: true });
      }
    }

    svar = await handleGeneralQuestion({
      supabase, profile: profil!, subject: amne, body: senaste?.text ?? '', emailHistory: historik || undefined, smsKontext,
      messageId: senaste?.gmailMessageId,
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
