import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, formatAmount } from '../openai-client';
import { retrieveKnowledge, retrieveExamples, embedQuery } from '../retrieve';
import { buildGeneralQuestionPrompt } from '../general-question-prompt';

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
    const [{ data: p }, { data: txs }, { count }] = await Promise.all([
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
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, subject, body, emailHistory } = params;
  const attachmentNames = params.attachmentNames ?? [];

  // Hämta relevanta utdrag ur indexerade dokument (t.ex. K1-vägledningen),
  // tidigare mailsvar med liknande fråga (mailbanken, som stilförebild) samt
  // kontext om avsändaren (kontouppgifter + transaktioner).
  // Frågan embeddas en gång och återanvänds för båda sökningarna.
  const query = `${subject}\n${body}`.trim();
  const queryEmbedding = query ? await embedQuery(query) : null;
  const [knowledge, examples, senderContext] = await Promise.all([
    retrieveKnowledge({ supabase, query, queryEmbedding }),
    retrieveExamples({ supabase, query, queryEmbedding }),
    buildSenderContext(supabase, profile.id),
  ]);

  const systemPrompt = buildGeneralQuestionPrompt({
    ...senderContext,
    knowledgeExcerpts: knowledge,
    examples,
    attachmentNames,
  });

  const userContent = emailHistory
    ? `Mailkonversation:\n\n${emailHistory}`
    : `Ämne: ${subject || '(inget ämne)'}\n\nFråga:\n${body.slice(0, 1500)}`;

  const answer = await callOpenAI({
    model: 'o3',
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
