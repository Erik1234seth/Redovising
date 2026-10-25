import type { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON } from '@/lib/inmail/openai-client';
import { REPLY_RULES } from '@/lib/inmail/reply-rules';
import { build, locate, type Built } from '@/lib/personer';

/**
 * Kollar om öppna ärenden redan är gjorda, utifrån allt som hänt med personen
 * sedan ärendet skapades: mejl och sms åt båda hållen och inskickade underlag.
 *
 * - Säkert gjort → ärendet stängs, med AI:ns motivering kvar så det syns varför.
 * - Kanske gjort → `ai_status = 'osaker'`, och någon får bekräfta.
 * - Inte gjort och datumet har passerat → ett mejlutkast till kunden, om
 *   `skrivMejl` är på. Utkastet går aldrig iväg av sig självt, det hamnar i
 *   inkorgen som alla andra utkast.
 *
 * Mejl skrivs bara från den dagliga körningen, inte när ett meddelande precis kommit in: då har kunden redan fått ett
 * AI-svar som utkast, och två utkast samtidigt blir bara rörigt.
 *
 * Fel loggas och sväljs per person, så en trasig person stoppar inte resten.
 */

const MODELL = 'gpt-6.1-sol';

/** Per meddelande och totalt i det AI:n får läsa om en person. */
const MEDDELANDE_MAX_TECKEN = 1500;
const HANDELSER_MAX_TECKEN = 30000;

/** Hur många personer som kollas samtidigt. */
const SAMTIDIGA = 5;

type Rad = {
  id: string; titel: string; beskrivning: string | null; datum: string | null; person_key: string | null;
  created_at: string; ai_kollad_at: string | null; ai_utkast_id: string | null;
};

interface Bedomning { id: string; bedomning: 'klar' | 'osaker' | 'oppen'; motivering?: string }
interface Svar { arenden?: Bedomning[]; mejl?: { amne?: string; text?: string; arenden?: string[] } | null }

const PROMPT = (idag: string) => `Du hjälper en redovisningsbyrå (Enkla Bokslut, bokföring och bokslut åt enskilda firmor) att hålla koll på sina ärenden.

Du får en kunds öppna ärenden och allt som hänt med kunden sedan det äldsta ärendet skapades: mejl och sms åt båda hållen, och underlag kunden skickat in.
Avgör för varje ärende om det redan är gjort.

- "klar": det framgår tydligt att det är gjort. Exempel: ärendet är "Påminn kunden om kontoutdragen" och vi har skickat en påminnelse, eller kunden har skickat kontoutdragen. Ärendet är "Följ upp leadet" och vi har hört av oss eller leadet har svarat.
- "osaker": något har hänt som kan betyda att det är gjort, men det går inte att säga säkert. Exempel: kunden skickade några filer men det framgår inte om det var de som efterfrågades.
- "oppen": inget tyder på att det är gjort.

Hellre "osaker" än "klar" när du tvekar. Ett ärende som stängs i onödan glöms bort.
Motivera med en kort mening som nämner vad som hände och när, t.ex. "Kunden mejlade kontoutdragen 14 okt."

Mejl: ärenden markerade "Får skriva mejl: ja" har passerat sitt datum utan att vara gjorda. Om något av dem går ut på att vi ska kontakta kunden (påminna, följa upp, fråga, skicka något), skriv ETT mejlutkast till kunden som tar hand om dem. Lista vilka ärenden det täcker.
Skriv inget mejl om det redan ligger ett outskickat utkast till kunden, om ärendet inte handlar om att kontakta kunden, eller om ett "osaker"-ärende kanske redan är löst.
Mejlet ska vara vänligt, kort och konkret: påminn om vad vi väntar på och varför det behövs. Skriv på svenska och tilltala kunden med förnamn om det finns.
${REPLY_RULES}

Dagens datum: ${idag}.

Svara med JSON:
{"arenden": [{"id": "ärendets id", "bedomning": "klar" | "osaker" | "oppen", "motivering": "en mening"}],
 "mejl": null | {"amne": "kort ämnesrad", "text": "mejlets text", "arenden": ["id på ärendena mejlet tar hand om"]}}`;

const tid = (iso: string) => iso.slice(0, 16).replace('T', ' ');
const kort = (t: string | null | undefined) => {
  const s = String(t ?? '').trim();
  return s.length > MEDDELANDE_MAX_TECKEN ? `${s.slice(0, MEDDELANDE_MAX_TECKEN)} […]` : s;
};

/** Ärendets person_key är en bar adress eller ett nummer, personernas alias har prefix. */
function hittaPerson(people: Map<string, Built>, key: string): Built | undefined {
  return locate(people, key) ?? locate(people, `e:${key.toLowerCase()}`) ?? locate(people, `p:${key}`);
}

export async function kollaArenden(opts: {
  supabase: SupabaseClient;
  /** Bara den här personens ärenden. Utan den kollas alla öppna. */
  personKey?: string;
  skrivMejl?: boolean;
}): Promise<{ kollade: number; klara: number; osakra: number; mejl: number }> {
  const { supabase, skrivMejl = false } = opts;
  const resultat = { kollade: 0, klara: 0, osakra: 0, mejl: 0 };

  const { data: oppna, error } = await supabase.from('arenden')
    .select('id, titel, beskrivning, datum, person_key, created_at, ai_kollad_at, ai_utkast_id')
    .eq('status', 'oppen').not('person_key', 'is', null);
  if (error) throw new Error(error.message);
  if (!oppna?.length) return resultat;

  const people = await build();
  const vald = opts.personKey ? hittaPerson(people, opts.personKey) : undefined;
  if (opts.personKey && !vald) return resultat;

  // Samma person kan stå på flera adresser och nummer i olika ärenden
  const perPerson = new Map<string, { person: Built; arenden: Rad[] }>();
  for (const a of oppna as Rad[]) {
    const p = hittaPerson(people, a.person_key!);
    if (!p || (vald && p.key !== vald.key)) continue;
    if (!perPerson.has(p.key)) perPerson.set(p.key, { person: p, arenden: [] });
    perPerson.get(p.key)!.arenden.push(a);
  }

  // Några personer åt gången: en i taget tar för lång tid för en funktion,
  // alla på en gång slår i OpenAI:s gränser
  const ko = [...perPerson.values()];
  const arbetare = Array.from({ length: SAMTIDIGA }, async () => {
    for (let nasta = ko.shift(); nasta; nasta = ko.shift()) {
      try {
        const r = await kollaPerson(supabase, nasta.person, nasta.arenden, skrivMejl);
        resultat.kollade += r.kollade;
        resultat.klara += r.klara;
        resultat.osakra += r.osakra;
        resultat.mejl += r.mejl;
      } catch (err) {
        console.error(`[arenden] ai-koll för ${nasta.person.key}:`, err instanceof Error ? err.message : err);
      }
    }
  });
  await Promise.all(arbetare);
  if (resultat.kollade) console.log('[arenden] ai-koll:', resultat);
  return resultat;
}

async function kollaPerson(supabase: SupabaseClient, p: Built, arenden: Rad[], skrivMejl: boolean) {
  const resultat = { kollade: 0, klara: 0, osakra: 0, mejl: 0 };
  const idag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const sedan = arenden.map((a) => a.created_at).reduce((a, b) => (b < a ? b : a));
  const mejladresser = [...new Set([...p.aliases.filter((a) => a.startsWith('e:')).map((a) => a.slice(2)), p.email]
    .filter((x): x is string => !!x).map((x) => x.toLowerCase()))];
  const nummer = [...new Set([...p.aliases.filter((a) => a.startsWith('p:')).map((a) => a.slice(2)), p.phone]
    .filter((x): x is string => !!x))];
  const lista = (v: string[]) => v.map((x) => `"${x}"`).join(',');

  const [mejl, sms, underlag, utkast] = await Promise.all([
    mejladresser.length
      ? supabase.from('mail_messages')
        .select('direction, subject, body, attachment_names, sent_at')
        .in('customer_email', mejladresser).gte('sent_at', sedan).order('sent_at')
      : Promise.resolve({ data: [], error: null }),
    nummer.length
      ? supabase.from('sms_messages').select('direction, body, status, created_at')
        .in('phone', nummer).gte('created_at', sedan).order('created_at')
      : Promise.resolve({ data: [], error: null }),
    p.profileIds.length || mejladresser.length
      ? supabase.from('bokforing_underlag').select('file_name, source, created_at')
        .or([
          ...(p.profileIds.length ? [`user_id.in.(${lista(p.profileIds)})`] : []),
          ...(mejladresser.length ? [`sender_email.in.(${lista(mejladresser)})`] : []),
        ].join(','))
        .gte('created_at', sedan).order('created_at')
      : Promise.resolve({ data: [], error: null }),
    mejladresser.length
      ? supabase.from('mejl_utkast').select('id, amne, text').in('till_email', mejladresser).eq('status', 'draft')
      : Promise.resolve({ data: [], error: null }),
  ]);
  const fel = mejl.error ?? sms.error ?? underlag.error ?? utkast.error;
  if (fel) throw new Error(fel.message);

  const mejlRader = (mejl.data ?? []) as {
    direction: string;
    subject: string | null; body: string | null; attachment_names: string[] | null; sent_at: string;
  }[];
  const smsRader = ((sms.data ?? []) as { direction: string; body: string; status: string | null; created_at: string }[])
    .filter((s) => s.direction === 'in' || !['draft', 'discarded', 'failed'].includes(s.status ?? ''));
  const underlagRader = (underlag.data ?? []) as { file_name: string | null; source: string | null; created_at: string }[];
  const vantandeUtkast = (utkast.data ?? []) as { id: string; amne: string | null; text: string }[];

  const handelser = [
    ...mejlRader.map((m) => ({
      at: m.sent_at,
      text: [
        `${tid(m.sent_at)} · mejl ${m.direction === 'in' ? 'från kunden' : 'från oss'} · ${m.subject || '(inget ämne)'}`,
        kort(m.body),
        m.attachment_names?.length ? `Bilagor: ${m.attachment_names.join(', ')}` : '',
      ].filter(Boolean).join('\n'),
    })),
    ...smsRader.map((s) => ({ at: s.created_at, text: `${tid(s.created_at)} · sms ${s.direction === 'in' ? 'från kunden' : 'från oss'}\n${kort(s.body)}` })),
    ...underlagRader.map((u) => ({ at: u.created_at, text: `${tid(u.created_at)} · underlag inskickat (${u.source ?? 'okänd väg'}): ${u.file_name ?? 'fil utan namn'}` })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const senasteHandelse = handelser.at(-1)?.at ?? '';
  const farSkrivaMejl = (a: Rad) =>
    skrivMejl && !a.ai_utkast_id && !vantandeUtkast.length && !!a.datum && a.datum <= idag && mejladresser.length > 0;

  // Inget nytt sedan förra kollen och inget mejl att skriva — då blir svaret detsamma
  const nagotNytt = arenden.some((a) => !a.ai_kollad_at || senasteHandelse > a.ai_kollad_at || farSkrivaMejl(a));
  if (!nagotNytt) return resultat;

  // Nyaste händelserna behålls om historiken är längre än taket
  const valda: string[] = [];
  let tecken = 0;
  for (const h of [...handelser].reverse()) {
    if (tecken + h.text.length > HANDELSER_MAX_TECKEN) break;
    valda.unshift(h.text);
    tecken += h.text.length;
  }

  const fraga = [
    `Kund: ${p.name ?? p.email ?? p.phone ?? p.key}`,
    `Öppna ärenden:\n${arenden.map((a) => [
      `- id: ${a.id}`,
      `  Titel: ${a.titel}`,
      a.beskrivning ? `  Beskrivning: ${a.beskrivning}` : '',
      `  Skapat: ${tid(a.created_at)}`,
      a.datum ? `  Datum: ${a.datum}` : '',
      `  Får skriva mejl: ${farSkrivaMejl(a) ? 'ja' : 'nej'}`,
    ].filter(Boolean).join('\n')).join('\n')}`,
    vantandeUtkast.length ? `Outskickade utkast till kunden finns redan (${vantandeUtkast.length} st).` : '',
    valda.length ? `Det här har hänt sedan ${tid(sedan)}:\n\n${valda.join('\n\n')}` : `Inget har hänt sedan ${tid(sedan)}.`,
  ].filter(Boolean).join('\n\n');

  const svar = parseJSON<Svar>(await callOpenAI({
    model: MODELL,
    effort: 'low',
    messages: [{ role: 'system', content: PROMPT(idag) }, { role: 'user', content: fraga }],
    responseFormat: { type: 'json_object' },
    maxTokens: 8000,
  }));

  const nu = new Date().toISOString();
  const kanda = new Map(arenden.map((a) => [a.id, a]));
  for (const b of svar.arenden ?? []) {
    if (!kanda.has(b.id) || !['klar', 'osaker', 'oppen'].includes(b.bedomning)) continue;
    const motivering = b.motivering?.trim().slice(0, 500) || null;
    const andring = b.bedomning === 'klar'
      ? { status: 'klar', klar_at: nu, ai_status: null, ai_motivering: motivering }
      : { ai_status: b.bedomning === 'osaker' ? 'osaker' : null, ai_motivering: motivering };
    // Bara om det fortfarande är öppet: någon kan ha ändrat det medan AI:n tänkte
    const { error } = await supabase.from('arenden')
      .update({ ...andring, ai_kollad_at: nu, updated_at: nu }).eq('id', b.id).eq('status', 'oppen');
    if (error) throw new Error(error.message);
    resultat.kollade += 1;
    if (b.bedomning === 'klar') resultat.klara += 1;
    if (b.bedomning === 'osaker') resultat.osakra += 1;
  }

  const tacker = (svar.mejl?.arenden ?? []).filter((id) => kanda.has(id) && farSkrivaMejl(kanda.get(id)!));
  const text = svar.mejl?.text?.trim();
  if (text && tacker.length) {
    // Svar i den senaste tråden kunden skrev i, även om den är äldre än
    // ärendet, annars ett nytt mejl
    const { data: senasteIn } = await supabase.from('mail_messages')
      .select('gmail_message_id, gmail_thread_id, customer_email, subject')
      .in('customer_email', mejladresser).eq('direction', 'in')
      .order('sent_at', { ascending: false }).limit(1).maybeSingle();
    const { data: nytt, error } = await supabase.from('mejl_utkast').insert({
      till_email: senasteIn?.customer_email ?? p.email ?? mejladresser[0],
      amne: svar.mejl?.amne?.trim() || senasteIn?.subject || 'Enkla Bokslut',
      text,
      gmail_thread_id: senasteIn?.gmail_thread_id ?? null,
      svar_pa_message_id: senasteIn?.gmail_message_id ?? null,
      // Egen källa: unik-regeln för AI-svar tillåter bara ett utkast per kundmejl,
      // och det har kundmejlet oftast redan fått
      kalla: 'arende',
    }).select('id').single();
    if (error) throw new Error(error.message);
    await supabase.from('arenden').update({ ai_utkast_id: nytt.id }).in('id', tacker);
    resultat.mejl += 1;
  }

  return resultat;
}
