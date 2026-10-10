import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI } from '../inmail/openai-client';
import { retrieveKnowledge, retrieveExamples, embedQuery } from '../inmail/retrieve';
import { loadKnowledge } from '../inmail/knowledge';
import { PROMPT_INTRO, SERVICE_INFO, KNOWLEDGE_RULES, EXAMPLE_RULES } from '../inmail/general-question-prompt';
import type { Sender } from './identify';
import { byggMejlkontext } from '../mejlkontext';

/** Hur många tidigare SMS i konversationen som skickas med som kontext. */
const HISTORY_LIMIT = 10;

const MOMS_PERIOD_TEXT: Record<string, string> = {
  monthly: 'månadsvis',
  quarterly: 'kvartalsvis',
  yearly: 'årsvis',
};

/**
 * SMS går ut som GSM-7 eller UCS-2. Emojis och typografiska tecken tvingar hela
 * meddelandet till UCS-2, vilket halverar antalet tecken per segment och därmed
 * dubblar kostnaden. Samma sanering som i mailflödet, av delvis andra skäl.
 */
function sanitize(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}]/gu, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/^[*#\-\s]*\*\*(.+?)\*\*/gm, '$1') // ströfetstil om modellen glömmer sig
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SUBSCRIPTION_TEXT: Record<string, string> = {
  active: 'aktivt abonnemang',
  trialing: 'provperiod',
  invoice: 'faktureras årsvis',
  past_due: 'obetald faktura',
  canceled: 'uppsagt abonnemang',
  unpaid: 'obetalt abonnemang',
};

/**
 * Kontostatus: har numret ett konto i app.enklabokslut.se eller inte?
 *
 * Det är den enda frågan AI:n omöjligt kan gissa sig till, och den som gör mest
 * skada när svaret blir fel — en betalande kund som uppmanas registrera sig,
 * eller ett lead som hänvisas till en inloggning hen inte har. Blocket ligger
 * därför alltid med, även när svaret är "inget konto".
 */
function buildAccountStatus(sender: Sender): string {
  if (!sender.hasAccount) {
    const why =
      sender.kind === 'prospect'
        ? 'Numret finns hos oss som lead, men ingen profil är kopplad till adressen hen lämnat.'
        : 'Numret finns varken bland kunderna eller bland våra leads.';

    return `

KONTOSTATUS: INGET KONTO
${why}
- Personen har alltså ingen inloggning i app.enklabokslut.se.
- Skriv aldrig som om hen redan är kund, har ett konto eller kan logga in.
- Vill hen komma igång: Skapa konto-länken i länkregistret.
- Vill hen veta mer först: följ masterprompten för möten och länkar.`;
  }

  const a = sender.account;
  const lines: string[] = [];

  // Numret står inte alltid i profilen. Kom kontot in via mejladressen på en
  // lead-rad är det nästan alltid samma person, men bandet är svagare än ett
  // nummer i profilen och ska inte låtsas vara starkare än det är.
  if (a?.matchedBy === 'email') {
    lines.push('- Kontot hittades via mejladressen personen lämnat i ett formulär, inte via numret i profilen.');
  }
  if (a?.subscriptionStatus) {
    lines.push(`- Abonnemang: ${SUBSCRIPTION_TEXT[a.subscriptionStatus] ?? a.subscriptionStatus}`);
  }
  if (a) {
    lines.push(`- Onboarding: ${a.onboardingDone ? 'klar' : 'påbörjad men inte klar'}`);
    if (!a.onboardingDone) {
      lines.push('- Onboardingen är inte klar. Är frågan kopplad till det: peka mjukt på att hen loggar in och gör klart uppgifterna.');
    }
  }

  return `

KONTOSTATUS: HAR KONTO
${lines.join('\n')}
- Personen loggar in på app.enklabokslut.se. Be aldrig en befintlig kund att registrera sig eller köpa något hen redan har.`;
}

/**
 * Kontext om kunden. Medvetet begränsad till kontouppgifter — inga belopp,
 * inga transaktioner. Ett telefonnummer är en svag identitetskontroll (numret
 * kan ha bytt ägare, telefonen kan vara borttappad), och SMS-flödet är byggt
 * för att svara på frågor, inte för att lämna ut bokföringen.
 */
async function buildCustomerContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const { data: p } = await supabase
      .from('profiles')
      .select('full_name, email, company_name, org_nr, momsnr, verksamhet, ort, moms_period, redovisningsmetod, start_ar, forsta_deklarationsar, subscription_status, ombud_klart_at')
      .eq('id', userId)
      .single();

    if (!p) return '';

    const lines: string[] = [];
    if (p.full_name) lines.push(`- Namn: ${p.full_name}`);
    if (p.company_name) lines.push(`- Företag: ${p.company_name}`);
    if (p.verksamhet) lines.push(`- Verksamhet: ${p.verksamhet}`);
    if (p.ort) lines.push(`- Ort: ${p.ort}`);
    if (p.moms_period) lines.push(`- Momsperiod: ${MOMS_PERIOD_TEXT[p.moms_period] ?? p.moms_period}`);
    if (p.email) lines.push(`- E-post: ${p.email}`);
    if (p.org_nr) lines.push(`- Org.nr: ${p.org_nr}`);
    if (p.momsnr) lines.push(`- Momsreg.nr: ${p.momsnr}`);
    if (p.redovisningsmetod) lines.push(`- Bokföringsmetod: ${p.redovisningsmetod}`);
    lines.push(p.ombud_klart_at ? '- Har lagt in oss som deklarationsombud hos Skatteverket' : '- Har INTE lagt in oss som deklarationsombud hos Skatteverket än');
    if (p.start_ar) lines.push(`- Startår: ${p.start_ar}`);
    if (p.forsta_deklarationsar === true) lines.push('- Första deklarationsåret för firman — ingen tidigare bokföring');
    if (p.forsta_deklarationsar === false) lines.push('- Kunden har deklarerat för firman tidigare år');

    return `

OM AVSÄNDAREN (befintlig kund):
${lines.length ? lines.join('\n') : '- (inga uppgifter ifyllda)'}

Kundens belopp och transaktioner skrivs inte i SMS. Frågar kunden om sina
egna siffror: hänvisa till app.enklabokslut.se eller ta det över mejl. Hitta
aldrig på siffror.`;
  } catch {
    return '';
  }
}

/** Tidigare SMS i konversationen, äldst först. */
async function buildHistory(supabase: SupabaseClient, phone: string): Promise<string> {
  const { data } = await supabase
    .from('sms_messages')
    .select('direction, body, created_at')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (!data?.length) return '';

  return data
    .reverse()
    .map((m) => `${m.direction === 'in' ? 'Kunden' : 'Du'}: ${m.body}`)
    .join('\n');
}

export async function generateSmsReply(params: {
  supabase: SupabaseClient;
  phone: string;
  message: string;
  sender: Sender;
}): Promise<string> {
  const { supabase, phone, message, sender } = params;

  const accountStatus = buildAccountStatus(sender);
  const queryEmbedding = await embedQuery(message);

  const [knowledge, examples, customerContext, history] = await Promise.all([
    retrieveKnowledge({ supabase, query: message, queryEmbedding, matchCount: 3 }),
    retrieveExamples({ supabase, query: message, queryEmbedding, matchCount: 2 }),    sender.userId ? buildCustomerContext(supabase, sender.userId) : Promise.resolve(''),
    buildHistory(supabase, phone),
  ]);
  const mejlkontext = await byggMejlkontext(supabase, { userId: sender.userId, emails: [sender.email] }).catch(() => '');

  const senderNote =
    sender.kind === 'customer'
      ? `Avsändaren är en BEFINTLIG KUND med konto hos oss${sender.name ? ` (${sender.name})` : ''}.`
      : sender.kind === 'prospect'
        ? `Avsändaren är en POTENTIELL KUND som tidigare lämnat sina uppgifter till oss${sender.name ? ` (${sender.name})` : ''}. Hen är alltså inte kund än och har inget konto.`
        : 'Avsändaren är OKÄND för oss och har inget konto hos oss. Behandla som en potentiell kund och var hjälpsam, men anta ingenting om hens situation.';

  const mailHandoff = sender.email
    ? `Vi har hens mejladress (${sender.email}), så resten kan tas över mejl.`
    : 'Vi saknar hens mejladress. Fråga efter den om resten behöver tas över mejl.';

  // Samma masterprompt som mejl-AI:n (v7). Bara längden och tecknen är
  // anpassade för SMS — möten och länkar följer masterprompten som den är.
  const systemPrompt = `ENKLA BOKSLUT – SYSTEMPROMPT FÖR KUNDFRÅGOR VIA SMS

Du svarar på ett SMS, inte ett mejl. Allt nedan gäller, men med de anpassningar för SMS som står i Del 5 och Del 6.

${PROMPT_INTRO}

${SERVICE_INFO}

DEL 2 – OM AVSÄNDAREN

${senderNote}
${accountStatus}${customerContext}

${KNOWLEDGE_RULES}
${loadKnowledge()}

HÄMTADE UTDRAG:

${knowledge || '(Inga utdrag hämtades för den här frågan.)'}

${EXAMPLE_RULES}

Exemplen är mejl och därför längre än ett SMS ska vara. Ta tonen från dem, inte längden.

TIDIGARE SVAR:

${examples || '(Inga tidigare svar på liknande frågor hittades.)'}

DEL 5 – HUR SMS:ET SKA SKRIVAS

Du är Erik på Enkla Bokslut och svarar själv på SMS:et. Skriv som man skriver ett SMS till någon man har en yrkesrelation till: vänligt och direkt, men inte slarvigt och inte formellt brevspråk. Inte som en AI-assistent, säljare eller robot.

Längd:
- Håll det KORT. Sikta på under 300 tecken, alltså ett par meningar. Ett långt SMS blir en vägg av text i mobilen och kostar dessutom mer att skicka.
- Kräver frågan ett längre svar: ge det korta svaret och erbjud att ta resten över mejl. Skriv aldrig en uppsats i ett SMS.

Ton och form:
- Svara alltid på samma språk som SMS:et är skrivet på.
- Ingen hälsningsfras och ingen avslutningsfras i varje SMS. Är det första meddelandet i konversationen kan du inleda med "Hej${sender.name ? ' ' + sender.name.split(' ')[0] : ''},". Pågår konversationen redan: svara bara rakt på.
- Inga artighetsfraser som "Tack för din fråga" och ingen sammanfattning på slutet.
- Ställ bara en följdfråga om svaret behövs för att kunna svara korrekt.

Vart samtalet ska ta vägen:
- Kräver frågan mer än ett par meningar: ge det korta svaret och erbjud att ta resten över mejl. ${mailHandoff}
- Erbjud det en gång, tjata inte.

Länkar i SMS:
- Högst en länk per SMS, den mest specifika i länkregistret. Skriv ut länken som den står, utan text runt den.
- Gissa aldrig om personen är kund eller inte. KONTOSTATUS ovan är facit.
- Saknar personen konto och vill komma igång: Skapa konto-länken. Vill hen bara veta mer: Startsidan eller Kvalificering.
- Har personen konto: använd app-länkarna. Be aldrig en befintlig kund att registrera sig.

Övrigt:
- Lova aldrig något om kundens specifika skattesituation utan förbehåll.
- Vill personen skicka in kvitton: det går inte via SMS. Kvitton mejlas till erik@enklabokslut.se eller läggs in i appen.

DEL 6 – TECKEN OCH AVSLUTNING

SMS klarar bara enkla tecken.
- Inga emojis eller symboltecken.
- Inga tankstreck eller långa bindestreck, och inga typografiska citattecken.
- Ingen Markdown, ingen fetstil, inga rubriker och inga punktlistor.
- Skriv ALDRIG under med namn eller signatur. Kunden ser vem som skriver.
- Avsluta med den sista meningen i själva svaret.`;

  const sms = history
    ? `Tidigare SMS i konversationen:\n${history}\n\nNytt SMS att svara på:\n${message}`
    : `SMS att svara på:\n${message}`;
  const userContent = mejlkontext ? `${mejlkontext}\n\n${sms}` : sms;

  const answer = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    maxTokens: 6000,
  });

  return sanitize(answer);
}
