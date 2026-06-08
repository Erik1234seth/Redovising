import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface TransactionUpdate {
  transaction_index: number;
  changes: {
    beskrivning?: string;
    betalningssatt?: string;
    belopp?: number;
    moms?: number;
    datum?: string;
    ta_bort?: boolean;
  };
}

interface AIResponse {
  updates: TransactionUpdate[];
  replyMessage: string;
}

function formatAmount(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-inmail-secret');
    if (secret !== process.env.INMAIL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      senderEmail: string;
      gmailThreadId: string;
      messageId: string;
      emailHistory: string;
    };

    const { senderEmail, gmailThreadId, messageId, emailHistory } = body;

    if (!senderEmail || !gmailThreadId || !messageId || !emailHistory) {
      return NextResponse.json({ error: 'Saknar fält' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Find the thread
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id, user_id, transaction_ids')
      .eq('gmail_thread_id', gmailThreadId)
      .single();

    if (!thread) {
      return NextResponse.json({ action: 'no_thread' });
    }

    // Fetch current transactions so AI knows what exists
    const { data: transactions } = await supabase
      .from('bokforing_transaktioner')
      .select('id, beskrivning, belopp, moms, datum, betalningssatt')
      .in('id', thread.transaction_ids);

    if (!transactions?.length) {
      return NextResponse.json({ action: 'no_transactions' });
    }

    const txList = transactions
      .map((t, i) => `${i + 1}. ${t.beskrivning} — ${t.belopp} kr — Betalat: ${t.betalningssatt} — Datum: ${t.datum}`)
      .join('\n');

    const systemPrompt = `Du är en bokföringsassistent. Användaren svarar på ett mail om sina bokförda transaktioner och vill göra ändringar.

Aktuella transaktioner:
${txList}

Läs mailkonversationen och returnera ett JSON-objekt med exakt dessa fält:
{
  "updates": [
    {
      "transaction_index": number (1-baserat index i listan ovan),
      "changes": {
        "beskrivning": "ny beskrivning" (om ändrad),
        "betalningssatt": "Från företagskonto" eller "Från privatkonto" eller "Kontant" (om ändrad),
        "belopp": number (om ändrat),
        "moms": number (om ändrat),
        "datum": "YYYY-MM-DD" (om ändrat),
        "ta_bort": true (om transaktionen ska tas bort)
      }
    }
  ],
  "replyMessage": "ett kort vänligt svar på svenska som bekräftar vad vi ändrat"
}

Om inga ändringar behövs, returnera updates: [] och ett lämpligt svar.`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Mailkonversation:\n\n${emailHistory}` },
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!aiRes.ok) throw new Error('OpenAI-fel');

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? '';

    let parsed: AIResponse;
    try {
      parsed = JSON.parse(raw) as AIResponse;
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]) as AIResponse;
      else throw new Error('Kunde inte tolka AI-svaret');
    }

    // Apply updates
    for (const update of parsed.updates ?? []) {
      const tx = transactions[update.transaction_index - 1];
      if (!tx) continue;

      if (update.changes.ta_bort) {
        await supabase.from('bokforing_transaktioner').delete().eq('id', tx.id);
      } else {
        const patch: Record<string, unknown> = {};
        if (update.changes.beskrivning !== undefined) patch.beskrivning = update.changes.beskrivning;
        if (update.changes.betalningssatt !== undefined) patch.betalningssatt = update.changes.betalningssatt;
        if (update.changes.belopp !== undefined) patch.belopp = Math.abs(update.changes.belopp);
        if (update.changes.moms !== undefined) patch.moms = update.changes.moms;
        if (update.changes.datum !== undefined) patch.datum = update.changes.datum;
        if (Object.keys(patch).length) {
          await supabase.from('bokforing_transaktioner').update(patch).eq('id', tx.id);
        }
      }
    }

    // Update thread with latest message id
    await supabase
      .from('email_threads')
      .update({ last_message_id: messageId, updated_at: new Date().toISOString() })
      .eq('id', thread.id);

    return NextResponse.json({
      action: 'ok',
      replyBody: parsed.replyMessage + '\n\n// Enkla Bokslut',
    });
  } catch (err) {
    console.error('Error in /api/inmail/reply:', err);
    return NextResponse.json({ error: 'Internt fel' }, { status: 500 });
  }
}
