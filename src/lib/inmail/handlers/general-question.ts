import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, formatAmount } from '../openai-client';
import { retrieveKnowledge, retrieveExamples, embedQuery } from '../retrieve';
import { buildGeneralQuestionPrompt } from '../general-question-prompt';
import { anteckningarForPrompt } from '../../inkorg/anteckningar';
import { byggMejlkontext } from '../../mejlkontext';
import { hamtaKundpris, kundprisRad } from '../../kundpris';
import { tidigarePrisRegel } from '../../tidigare-pris';

/** Hur mycket av mejlet som besvaras som skickas till AI:n. */
const MEJL_MAX_TECKEN = 20000;

const MOMS_PERIOD_TEXT: Record<string, string> = {
  monthly: 'månadsvis',
  quarterly: 'kvartalsvis',
  yearly: 'årsvis',
};

// Tar bort emojis/symboltecken som annars blir trasiga (������) i mejlet på
// vägen genom Apps Script → Gmail. Behåller vanlig text inkl. åäö.
function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Hämtar avsändarens kontouppgifter och senaste transaktioner, så AI:n kan ge
// personliga och relevanta svar. Allt hämtas server-side.
async function buildSenderContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ customerInfo: string; customerBookkeeping: string }> {
  try {
    const [{ data: p }, { data: txs }, { count }, kundpris] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, company_name, org_nr, momsnr, verksamhet, ort, moms_period, start_ar, bokforing_metod, forsta_deklarationsar')
        .eq('id', userId)
        .single(),
      supabase
        .from('bokforing_transaktioner')
        .select('datum, beskrivning, belopp, moms, betalningssatt, haendelse_typ')
        .eq('user_id', userId)
        .order('datum', { ascending: false })
        .limit(15),
      supabase
        .from('bokforing_transaktioner')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      hamtaKundpris(supabase, userId).catch(() => null),
    ]);

    const lines: string[] = [];
    if (p?.full_name) lines.push(`- Namn: ${p.full_name}`);
    if (p?.email) lines.push(`- E-post: ${p.email}`);
    if (p?.company_name) lines.push(`- Företag: ${p.company_name}`);
    if (p?.org_nr) lines.push(`- Org.nr: ${p.org_nr}`);
    if (p?.momsnr) lines.push(`- Momsreg.nr: ${p.momsnr}`);
    if (p?.verksamhet) lines.push(`- Verksamhet: ${p.verksamhet}`);
    if (p?.ort) lines.push(`- Ort: ${p.ort}`);
    if (p?.moms_period) lines.push(`- Momsperiod: ${MOMS_PERIOD_TEXT[p.moms_period] ?? p.moms_period}`);
    if (p?.bokforing_metod) lines.push(`- Bokföringsmetod: ${p.bokforing_metod}`);
    if (p?.start_ar) lines.push(`- Startår: ${p.start_ar}`);
    if (p?.forsta_deklarationsar === true) lines.push('- Första deklarationsåret för firman — ingen tidigare bokföring');
    if (p?.forsta_deklarationsar === false) lines.push('- Kunden har deklarerat för firman tidigare år');
    // Kunden har ett låst pris. Saknas det kan personen ha rätt till det
    // tidigare priset, om vi hade kontakt innan priset höjdes.
    const prisRad = kundprisRad(kundpris) ?? (await tidigarePrisRegel(supabase, [p?.email].filter(Boolean) as string[]));
    if (prisRad) lines.push(prisRad);

    let txBlock = 'Kunden har inga bokförda transaktioner ännu.';
    if (txs?.length) {
      const txLines = txs.map((t) => {
        const datum = t.datum ?? 'okänt datum';
        const belopp = formatAmount(Number(t.belopp));
        const moms = t.moms != null ? `, moms ${formatAmount(Number(t.moms))}` : '';
        return `  - ${datum} - ${t.beskrivning || 'Okänd'} - ${belopp}${moms} (${t.betalningssatt ?? 'okänt betalningssätt'})`;
      });
      txBlock = `Totalt ${count ?? txs.length} bokförda transaktioner. Senaste ${txs.length}:\n${txLines.join('\n')}`;
    }

    return {
      customerInfo: lines.length ? lines.join('\n') : '- (inga kontouppgifter ifyllda ännu)',
      customerBookkeeping: txBlock,
    };
  } catch {
    return {
      customerInfo: '- (kunde inte hämta kontouppgifter)',
      customerBookkeeping: '(kunde inte hämta bokföringen)',
    };
  }
}

export async function handleGeneralQuestion(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  subject: string;
  body: string;
  emailHistory?: string;
  /** Namnen på bifogade filer. De är redan sparade som underlag. */
  attachmentNames?: string[];
  /** SMS-konversationen med samma person, så att svaret kan bygga på den. */
  smsKontext?: string;
  /** Resultatet av underlagskontrollen och hur svaret ska använda det (underlagsflödet). */
  underlagKontext?: string;
  /** Gmail-id för mejlet som besvaras, så att det inte står två gånger i historiken. */
  messageId?: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, subject, body, smsKontext, underlagKontext, messageId } = params;

  // Hela mejlhistoriken med kunden, från alla trådar och adresser. Tråden som
  // Apps Script skickar räcker inte: ett svar i "redovisning" handlar ofta om
  // en fil som kom i en annan tråd veckor tidigare. Tråden används bara om
  // arkivet inte gick att läsa.
  const historik = await byggMejlkontext(supabase, { userId: profile.id, emails: [profile.email], utanMessageId: messageId })
    .catch(() => '');
  const emailHistory = historik || params.emailHistory;
  const attachmentNames = params.attachmentNames ?? [];

  // Hämta relevanta utdrag ur indexerade dokument (t.ex. K1-vägledningen),
  // tidigare mailsvar med liknande fråga (mailbanken, som stilförebild) samt
  // kontext om avsändaren (kontouppgifter + transaktioner).
  // Frågan embeddas en gång och återanvänds för båda sökningarna.
  const query = `${subject}\n${body}`.trim();
  const queryEmbedding = query ? await embedQuery(query) : null;
  const [knowledge, examples, senderContext, anteckningar] = await Promise.all([
    retrieveKnowledge({ supabase, query, queryEmbedding }),
    retrieveExamples({ supabase, query, queryEmbedding }),
    buildSenderContext(supabase, profile.id),
    anteckningarForPrompt(supabase, { email: profile.email }),
  ]);

  const systemPrompt = buildGeneralQuestionPrompt({
    ...senderContext,
    knowledgeExcerpts: knowledge,
    examples,
    attachmentNames,
  }) + anteckningar;

  // Mejlet som besvaras är kundens egen text och ska komma med i sin helhet.
  // Med 3000 tecken föll de sista frågorna i ett långt frågemejl bort, trots
  // att inkorgen visade hela mejlet. Taket finns bara som skydd mot extremfall.
  const fraga = body.slice(0, MEJL_MAX_TECKEN);
  const aktuellt = `Ämne: ${subject || '(inget ämne)'}\n\n${fraga}`;
  const mejl = historik
    ? `${historik}\n\nMEJLET DU SVARAR PÅ:\n${aktuellt}`
    : emailHistory
      ? `Mailkonversation:\n\n${emailHistory}`
      : `Ämne: ${subject || '(inget ämne)'}\n\nFråga:\n${fraga}`;
  const userContent = [smsKontext, mejl, underlagKontext].filter(Boolean).join('\n\n');

  const answer = await callOpenAI({
    model: 'gpt-6.1-sol',
    effort: 'medium',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    maxTokens: 8000,
  });

  return {
    action: 'ok',
    replyBody: stripEmojis(answer),
  };
}
