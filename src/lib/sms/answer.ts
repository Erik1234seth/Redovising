import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI } from '../inmail/openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../inmail/service-context';
import { retrieveKnowledge, retrieveExamples, embedQuery } from '../inmail/retrieve';
import type { Sender } from './identify';

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
- Vill hen komma igång: hänvisa till enklabokslut.se.
- Vill hen veta mer först: ta det över mejl, inte på ett möte.`;
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
      .select('full_name, company_name, verksamhet, ort, moms_period, bokforing_metod, start_ar, subscription_status')
      .eq('id', userId)
      .single();

    if (!p) return '';

    const lines: string[] = [];
    if (p.full_name) lines.push(`- Namn: ${p.full_name}`);
    if (p.company_name) lines.push(`- Företag: ${p.company_name}`);
    if (p.verksamhet) lines.push(`- Verksamhet: ${p.verksamhet}`);
    if (p.ort) lines.push(`- Ort: ${p.ort}`);
    if (p.moms_period) lines.push(`- Momsperiod: ${MOMS_PERIOD_TEXT[p.moms_period] ?? p.moms_period}`);
    if (p.bokforing_metod) lines.push(`- Bokföringsmetod: ${p.bokforing_metod}`);
    if (p.start_ar) lines.push(`- Startår: ${p.start_ar}`);

    return `

OM AVSÄNDAREN (befintlig kund):
${lines.length ? lines.join('\n') : '- (inga uppgifter ifyllda)'}

Du har INTE tillgång till kundens transaktioner, belopp eller saldon i det här
flödet. Frågar kunden om sina egna siffror: hänvisa till app.enklabokslut.se
eller be hen mejla erik@enklabokslut.se. Hitta aldrig på siffror.`;
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
    retrieveExamples({ supabase, query: message, queryEmbedding, matchCount: 2 }),
    sender.userId ? buildCustomerContext(supabase, sender.userId) : Promise.resolve(''),
    buildHistory(supabase, phone),
  ]);

  const senderNote =
    sender.kind === 'customer'
      ? `Avsändaren är en BEFINTLIG KUND med konto hos oss${sender.name ? ` (${sender.name})` : ''}.`
      : sender.kind === 'prospect'
        ? `Avsändaren är en POTENTIELL KUND som tidigare lämnat sina uppgifter till oss${sender.name ? ` (${sender.name})` : ''}. Hen är alltså inte kund än och har inget konto.`
        : 'Avsändaren är OKÄND för oss och har inget konto hos oss. Behandla som en potentiell kund och var hjälpsam, men anta ingenting om hens situation.';

  // Har vi personens mejladress kan vi erbjuda oss att mejla; annars är det
  // adressen vi vill ha ut ur SMS-konversationen, för det är på mejl den ska
  // fortsätta. Ett möte är inte längre målet.
  const mailHandoff = sender.email
    ? `Vi har hens mejladress sedan tidigare (${sender.email}). Erbjud dig att mejla dit, t.ex. "jag mejlar dig detaljerna", och be hen säga till om en annan adress passar bättre.`
    : 'Vi saknar hens mejladress. Fråga efter den när det behövs, eller be hen mejla erik@enklabokslut.se så tar ni det där.';

  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}${accountStatus}${customerContext}${knowledge}${examples}

Du ÄR Erik på Enkla Bokslut och svarar på ett SMS. ${senderNote}

Det här är SMS, inte mejl. Det styr allt:
- Håll det KORT. Sikta på under 300 tecken, alltså ett par meningar. Ett långt SMS blir en vägg av text i mobilen och kostar dessutom mer att skicka.
- Kräver frågan ett långt svar: ge det korta svaret och erbjud att ta resten över mejl. Skriv aldrig en uppsats i ett SMS.
- Skriv som man skriver ett SMS till en person man har en yrkesrelation till. Vänligt och direkt, men inte slarvigt och inte formellt brevspråk.
- Ingen hälsningsfras och ingen avslutningsfras i varje SMS. Är det första meddelandet i konversationen kan du inleda med "Hej${sender.name ? ' ' + sender.name.split(' ')[0] : ''},". Pågår konversationen redan: svara bara rakt på.
- Skriv ALDRIG under med namn eller signatur. Kunden ser vem som skriver.
- Svara alltid på svenska.

Vart samtalet ska ta vägen:
- Målet är att flytta över diskussionen till MEJL. Inte att boka ett möte, inte att ringa. SMS:et ger det korta svaret, mejlet tar resten.
- ${mailHandoff}
- Erbjud det en gång när frågan börjar kräva mer än ett par meningar. Tjata inte, och upprepa det inte i varje SMS.

Regler för tecken (SMS klarar bara enkla tecken):
- Inga emojis, inga symboler
- Inga tankstreck, inga typografiska citattecken
- Ingen markdown. Ingen fetstil, inga rubriker, inga punktlistor.

Vad du inte får göra:
- Hitta aldrig på priser, regler eller uppgifter. Står det inte i kontexten ovan: säg att du återkommer, eller be dem mejla erik@enklabokslut.se.
- Lova aldrig något om kundens specifika skattesituation utan förbehåll.
- Gissa aldrig om personen är kund eller inte. KONTOSTATUS ovan är facit.
- Vill de bli kund eller komma igång: hänvisa till enklabokslut.se — men bara när kontot saknas. Har personen konto är det app.enklabokslut.se som gäller.
- Föreslå ALDRIG ett möte, ett samtal eller en tid, och länka aldrig till enklabokslut.se/boka-mote. Länken finns i kontexten ovan men gäller inte i SMS. Ber personen själv uttryckligen om ett möte: säg inte nej, utan att Erik tar det över mejl och fråga efter adressen.
- Vill de skicka in kvitton: det går inte via SMS. Kvitton mejlas till erik@enklabokslut.se eller läggs in i app.enklabokslut.se.`;

  const userContent = history
    ? `Tidigare SMS i konversationen:\n${history}\n\nNytt SMS att svara på:\n${message}`
    : `SMS att svara på:\n${message}`;

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
