import { SupabaseClient } from '@supabase/supabase-js';
import { formatAmount } from '../openai-client';

export async function handleViewTransactions(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile } = params;
  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';

  const { data: transactions } = await supabase
    .from('bokforing_transaktioner')
    .select('id, beskrivning, belopp, moms, datum, betalningssatt, haendelse_typ')
    .eq('user_id', profile.id)
    .order('datum', { ascending: false })
    .limit(10);

  if (!transactions?.length) {
    return {
      action: 'ok',
      replyBody: `Hej${firstName}!\n\nDu har inga bokförda transaktioner än.\n\nSkicka ett kvitto eller en faktura till det här mejlet så bokför vi det direkt!\n\n// Enkla Bokslut`,
    };
  }

  const lines = transactions.map((t, i) => {
    const datum = t.datum ?? 'okänt datum';
    const belopp = formatAmount(Number(t.belopp));
    return `${i + 1}. ${datum} — ${t.beskrivning || 'Okänd'} — ${belopp} (${t.betalningssatt ?? 'okänt betalningssätt'})`;
  });

  const replyBody = `Hej${firstName}!\n\nHär är dina senaste ${transactions.length} bokförda transaktioner:\n\n${lines.join('\n')}\n\nVill du ändra eller ta bort något? Svara på det här mejlet.\n\n// Enkla Bokslut`;

  return { action: 'ok', replyBody };
}
