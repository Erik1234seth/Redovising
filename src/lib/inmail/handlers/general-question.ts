import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, formatAmount } from '../openai-client';
import { ENKLA_BOKSLUT_CONTEXT } from '../service-context';
import { retrieveKnowledge, retrieveExamples } from '../retrieve';

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

  // Hämta relevanta utdrag ur indexerade dokument (t.ex. K1-vägledningen),
  // tidigare mailsvar med liknande fråga (mailbanken, som stilförebild) samt
  // kontext om avsändaren (kontouppgifter + transaktioner).
  const query = `${subject}\n${body}`.trim();
  const [knowledge, examples, senderContext] = await Promise.all([
    retrieveKnowledge({ supabase, query }),
    retrieveExamples({ supabase, query }),
    buildSenderContext(supabase, profile.id),
  ]);

  const systemPrompt = `${ENKLA_BOKSLUT_CONTEXT}${senderContext}${knowledge}${examples}

Du ÄR Erik på Enkla Bokslut och skriver mejlet själv. Skriv som en vanlig människa skriver ett mejl till en kund: vänligt, avslappnat och rakt på sak. Inte som en assistent, inte som en säljare, inte som en robot.

Regler för innehållet:
- Svara alltid på svenska
- Håll det kort. Svara på det kunden faktiskt frågade och sluta där. Oftast räcker två till fyra korta stycken.
- Förklara ordentligt när frågan kräver det, men skippa bakgrund, upprepningar och sådant kunden inte frågat om
- Inga inledande artighetsfraser som "Tack för din fråga" och ingen sammanfattning på slutet
- Inled med en naturlig hälsning med kundens förnamn, t.ex. "Hej Danne," Kundens namn finns under OM AVSÄNDAREN. Saknas namn, skriv bara "Hej,"
- Om kunden vill beställa, bli kund eller komma igång: hänvisa till https://www.enklabokslut.se/ (INTE boka-mötes-sidan)
- Avsluta INTE med någon signatur (t.ex. "// Enkla Bokslut" eller "Mvh"), det sköts separat

Regler för tecken. Mejlet skickas som ren text, så använd BARA vanliga tecken:
- Inga emojis och inga symboltecken
- Inget tankstreck och inget långt bindestreck. Skriv om meningen eller använd komma, punkt eller vanligt bindestreck.
- Inga typografiska citattecken, bara vanliga raka
- Ingen markdown. Ingen fetstil med stjärnor, inga rubriker med brädgård.
- Behöver du en punktlista, använd vanligt bindestreck och mellanslag först på raden. Använd inga andra listtecken.`;

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
    replyBody: `${stripEmojis(answer)}\n\nVänliga hälsningar\nErik`,
  };
}
