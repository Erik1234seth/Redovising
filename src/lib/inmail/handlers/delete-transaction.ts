import { SupabaseClient } from '@supabase/supabase-js';
import { callOpenAI, parseJSON, formatAmount } from '../openai-client';

interface AIDeleteResponse {
  transaction_indices: number[];  // 1-baserade index att ta bort
  replyMessage: string;
  needsConfirmation: boolean;
  confirmationQuestion?: string;
}

// Step 1: Identify which transactions to delete, ask for confirmation
export async function handleDeleteRequest(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  gmailThreadId: string;
  messageId: string;
  body: string;
  threadTransactionIds?: string[];
}): Promise<{ action: string; replyBody: string; pendingState?: string }> {
  const { supabase, profile, gmailThreadId, messageId, body, threadTransactionIds } = params;
  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';

  let transactions: Array<{ id: string; beskrivning: string; belopp: number; datum: string }> = [];

  if (threadTransactionIds?.length) {
    const { data } = await supabase
      .from('bokforing_transaktioner')
      .select('id, beskrivning, belopp, datum')
      .in('id', threadTransactionIds);
    transactions = data ?? [];
  }

  if (!transactions.length) {
    const { data } = await supabase
      .from('bokforing_transaktioner')
      .select('id, beskrivning, belopp, datum')
      .eq('user_id', profile.id)
      .order('datum', { ascending: false })
      .limit(10);
    transactions = data ?? [];
  }

  if (!transactions.length) {
    return {
      action: 'no_transactions',
      replyBody: `Hej${firstName}!\n\nDu har inga bokförda transaktioner att ta bort.\n\n// Enkla Bokslut`,
    };
  }

  const txList = transactions
    .map((t, i) => `${i + 1}. ${t.datum} — ${t.beskrivning} — ${formatAmount(Number(t.belopp))}`)
    .join('\n');

  const systemPrompt = `Du är bokföringsassistent. Användaren vill ta bort transaktioner.

Tillgängliga transaktioner:
${txList}

Identifiera vilka som ska tas bort baserat på användarens meddelande.

Returnera JSON:
{
  "transaction_indices": [1, 2, ...] (1-baserade index på de som ska tas bort),
  "needsConfirmation": true (alltid true — vi bekräftar alltid radering),
  "confirmationQuestion": "Är du säker på att du vill ta bort: [lista]?",
  "replyMessage": "använd detta om du är osäker på vad som ska tas bort"
}

Om du är osäker: sätt transaction_indices: [] och förklara i replyMessage.`;

  const raw = await callOpenAI({
    model: 'o3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body },
    ],
    responseFormat: { type: 'json_object' },
    maxTokens: 500,
  });

  const parsed = parseJSON<AIDeleteResponse>(raw);

  if (!parsed.transaction_indices?.length) {
    return {
      action: 'unclear',
      replyBody: `Hej${firstName}!\n\n${parsed.replyMessage || 'Vi förstod inte vilken transaktion du vill ta bort.'}\n\nHär är dina senaste transaktioner:\n\n${txList}\n\nSkriv vilken nummer du vill ta bort.\n\n// Enkla Bokslut`,
    };
  }

  // Store pending delete info in thread state
  const toDelete = parsed.transaction_indices
    .map(i => transactions[i - 1])
    .filter(Boolean);

  const toDeleteIds = toDelete.map(t => t.id).join(',');
  const toDeleteDesc = toDelete.map((t, i) => `${i + 1}. ${t.datum} — ${t.beskrivning} — ${formatAmount(Number(t.belopp))}`).join('\n');

  // Save pending state in email_threads
  await supabase.from('email_threads').upsert({
    user_id: profile.id,
    gmail_thread_id: gmailThreadId,
    last_message_id: messageId,
    transaction_ids: transactions.map(t => t.id),
    state: `pending_delete:${toDeleteIds}`,
  }, { onConflict: 'gmail_thread_id' });

  const confirmQ = parsed.confirmationQuestion || `Är du säker på att du vill ta bort dessa transaktioner?\n\n${toDeleteDesc}\n\nSvara "ja" för att bekräfta eller "nej" för att avbryta.`;

  return {
    action: 'awaiting_confirmation',
    replyBody: `Hej${firstName}!\n\n${confirmQ}\n\n// Enkla Bokslut`,
    pendingState: `pending_delete:${toDeleteIds}`,
  };
}

// Step 2: Execute confirmed deletion
export async function handleDeleteConfirm(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  gmailThreadId: string;
  messageId: string;
  pendingState: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, gmailThreadId, messageId, pendingState } = params;
  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';

  const idsToDelete = pendingState.replace('pending_delete:', '').split(',').filter(Boolean);

  if (!idsToDelete.length) {
    return { action: 'error', replyBody: `Hej${firstName}!\n\nNågot gick fel med raderingen. Vänligen försök igen.\n\n// Enkla Bokslut` };
  }

  const { data: txBefore } = await supabase
    .from('bokforing_transaktioner')
    .select('beskrivning, belopp, datum')
    .in('id', idsToDelete);

  await supabase.from('bokforing_transaktioner').delete().in('id', idsToDelete);

  // Clear pending state
  await supabase
    .from('email_threads')
    .update({ state: null, last_message_id: messageId, updated_at: new Date().toISOString() })
    .eq('gmail_thread_id', gmailThreadId);

  const deleted = (txBefore ?? [])
    .map((t, i) => `${i + 1}. ${t.datum} — ${t.beskrivning} — ${formatAmount(Number(t.belopp))}`)
    .join('\n');

  return {
    action: 'ok',
    replyBody: `Hej${firstName}!\n\nFöljande transaktioner har tagits bort:\n\n${deleted}\n\n// Enkla Bokslut`,
  };
}

// Step 2b: Cancel deletion
export async function handleDeleteCancel(params: {
  supabase: SupabaseClient;
  profile: { id: string; full_name: string; email: string };
  gmailThreadId: string;
  messageId: string;
}): Promise<{ action: string; replyBody: string }> {
  const { supabase, profile, gmailThreadId, messageId } = params;
  const firstName = profile.full_name ? ' ' + profile.full_name.split(' ')[0] : '';

  await supabase
    .from('email_threads')
    .update({ state: null, last_message_id: messageId, updated_at: new Date().toISOString() })
    .eq('gmail_thread_id', gmailThreadId);

  return {
    action: 'ok',
    replyBody: `Hej${firstName}!\n\nRaderingen avbröts. Inga transaktioner togs bort.\n\n// Enkla Bokslut`,
  };
}
