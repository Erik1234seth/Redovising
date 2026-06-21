import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON, formatAmount } from '../openai-client';

interface EditInstruction {
  transaction_index: number;
  changes: {
    beskrivning?: string;
    betalningssatt?: string;
    belopp?: number;
    moms?: number;
    datum?: string;
  };
}

interface AIEditResponse {
  edits: EditInstruction[];
  replyMessage: string;
}

export async function handleEditTransaction(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  gmailThreadId: string;
  messageId: string;
  body: string;
  emailHistory?: string;
  threadTransactionIds?: string[];
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, gmailThreadId, messageId, body, emailHistory, threadTransactionIds } = params;
  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';

  // Fetch relevant transactions: from thread if known, otherwise recent ones
  let transactionIds = threadTransactionIds ?? [];
  let transactions: Array<{ id: string; beskrivning: string; belopp: number; moms: number; datum: string; betalningssatt: string }> = [];

  if (transactionIds.length) {
    const { data } = await supabase
      .from('bokforing_transaktioner')
      .select('id, beskrivning, belopp, moms, datum, betalningssatt')
      .in('id', transactionIds);
    transactions = data ?? [];
  }

  if (!transactions.length) {
    const { data } = await supabase
      .from('bokforing_transaktioner')
      .select('id, beskrivning, belopp, moms, datum, betalningssatt')
      .eq('user_id', profile.id)
      .order('datum', { ascending: false })
      .limit(10);
    transactions = data ?? [];
  }

  if (!transactions.length) {
    return {
      action: 'no_transactions',
      replyBody: `Hej${firstName}!\n\nVi hittade inga transaktioner att ändra.\n\n// Enkla Bokslut`,
    };
  }

  const txList = transactions
    .map((t, i) => `${i + 1}. ${t.datum} — ${t.beskrivning} — ${formatAmount(Number(t.belopp))} — ${t.betalningssatt}`)
    .join('\n');

  const systemPrompt = `Du är bokföringsassistent. Användaren vill ändra befintliga transaktioner.

Transaktioner:
${txList}

Returnera JSON:
{
  "edits": [
    {
      "transaction_index": number (1-baserat),
      "changes": {
        "beskrivning": "ny beskrivning" (om ändrad),
        "betalningssatt": "Från företagskonto" | "Från privatkonto" | "Kontant" (om ändrad),
        "belopp": number (om ändrat),
        "moms": number (om ändrat),
        "datum": "YYYY-MM-DD" (om ändrat)
      }
    }
  ],
  "replyMessage": "kort bekräftelse på svenska om vad som ändrades"
}

Om du är osäker på vad som ska ändras: sätt edits: [] och förklara i replyMessage.`;

  const userContent = emailHistory
    ? `Mailkonversation:\n\n${emailHistory}`
    : `Ändringsbegäran:\n${body}`;

  const raw = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    responseFormat: { type: 'json_object' },
    maxTokens: 1000,
  });

  const parsed = parseJSON<AIEditResponse>(raw);

  for (const edit of parsed.edits ?? []) {
    const tx = transactions[edit.transaction_index - 1];
    if (!tx) continue;

    const patch: Record<string, unknown> = {};
    if (edit.changes.beskrivning !== undefined) patch.beskrivning = edit.changes.beskrivning;
    if (edit.changes.betalningssatt !== undefined) patch.betalningssatt = edit.changes.betalningssatt;
    if (edit.changes.belopp !== undefined) patch.belopp = Math.abs(edit.changes.belopp);
    if (edit.changes.moms !== undefined) patch.moms = edit.changes.moms;
    if (edit.changes.datum !== undefined) patch.datum = edit.changes.datum;
    if (Object.keys(patch).length) {
      await supabase.from('bokforing_transaktioner').update(patch).eq('id', tx.id);
    }
  }

  await supabase
    .from('email_threads')
    .update({ last_message_id: messageId, updated_at: new Date().toISOString() })
    .eq('gmail_thread_id', gmailThreadId);

  return {
    action: 'ok',
    replyBody: `${parsed.replyMessage}\n\n// Enkla Bokslut`,
  };
}
