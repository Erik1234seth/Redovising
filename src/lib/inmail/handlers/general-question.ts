import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, formatAmount } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import { retrieveKnowledge } from '../retrieve';

const MOMS_PERIOD_TEXT: Record<string, string> = {
  monthly: 'månadsvis',
  quarterly: 'kvartalsvis',
  yearly: 'årsvis',
};

// Bygger ett kontext-block om avsändaren: kontouppgifter + senaste transaktioner,
// så AI:n kan ge personliga och relevanta svar. Allt hämtas server-side.
async function buildSenderContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const [{ data: p }, { data: txs }, { count }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, company_name, org_nr, momsnr, verksamhet, ort, moms_period, start_ar, bokforing_metod')
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

    let txBlock = 'Kunden har inga bokförda transaktioner ännu.';
    if (txs?.length) {
      const txLines = txs.map((t) => {
        const datum = t.datum ?? 'okänt datum';
        const belopp = formatAmount(Number(t.belopp));
        const moms = t.moms != null ? `, moms ${formatAmount(Number(t.moms))}` : '';
        return `  • ${datum} — ${t.beskrivning || 'Okänd'} — ${belopp}${moms} (${t.betalningssatt ?? 'okänt betalningssätt'})`;
      });
      txBlock = `Totalt ${count ?? txs.length} bokförda transaktioner. Senaste ${txs.length}:\n${txLines.join('\n')}`;
    }

    return `

OM AVSÄNDAREN (kunden du svarar):
${lines.length ? lines.join('\n') : '- (inga kontouppgifter ifyllda ännu)'}

AVSÄNDARENS BOKFÖRING:
${txBlock}

Använd uppgifterna ovan för att ge ett personligt och relevant svar när det passar. Hitta ALDRIG på siffror eller transaktioner som inte står här. Dela bara kundens egna uppgifter med kunden själv.`;
  } catch {
    return '';
  }
}

export async function handleGeneralQuestion(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  subject: string;
  body: string;
  emailHistory?: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, subject, body, emailHistory } = params;
  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';

  // Hämta relevanta utdrag ur indexerade dokument (t.ex. K1-vägledningen)
  // samt kontext om avsändaren (kontouppgifter + transaktioner).
  const [knowledge, senderContext] = await Promise.all([
    retrieveKnowledge({ supabase, query: `${subject}\n${body}`.trim() }),
    buildSenderContext(supabase, profile.id),
  ]);

  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}${senderContext}${knowledge}

Du är en varm, personlig och hjälpsam bokföringsassistent för Enkla Bokslut. Skriv som en trevlig, engagerad rådgivare — inte som en robot. Var genuint tillmötesgående, visa att du bryr dig om kundens situation och gör kunden trygg.

Regler:
- Svara alltid på svenska
- Skriv i en varm, vänlig och personlig ton
- Ta den tid och plats du behöver för att förklara ordentligt — svara fullständigt och pedagogiskt, ingen längdgräns
- Avsluta INTE med någon signatur (t.ex. "// Enkla Bokslut" eller "Mvh") — det sköts separat`;

  const userContent = emailHistory
    ? `Mailkonversation:\n\n${emailHistory}`
    : `Ämne: ${subject || '(inget ämne)'}\n\nFråga:\n${body.slice(0, 1500)}`;

  const answer = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    maxTokens: 4000,
  });

  return {
    action: 'ok',
    replyBody: `Hej${firstName}!\n\n${answer.trim()}\n\nVänliga hälsningar\nErik`,
  };
}
