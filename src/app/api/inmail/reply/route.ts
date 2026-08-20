import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from '@/lib/inmail/classify';
import { handleNewTransaction } from '@/lib/inmail/handlers/new-transaction';
import { handleEditTransaction } from '@/lib/inmail/handlers/edit-transaction';
import { handleDeleteRequest, handleDeleteConfirm, handleDeleteCancel } from '@/lib/inmail/handlers/delete-transaction';
import { handleViewTransactions } from '@/lib/inmail/handlers/view-transactions';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { handleUnknownUser } from '@/lib/inmail/handlers/unknown-user';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
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
      subject?: string;
      emailBody?: string;
      emailHistory: string;
      attachments?: Array<{ base64: string; mimeType: string; name: string }>;
    };

    const { senderEmail, gmailThreadId, messageId, emailHistory } = body;
    const subject = body.subject ?? '';
    const emailBody = body.emailBody ?? '';
    const attachments = body.attachments ?? [];

    if (!senderEmail || !gmailThreadId || !messageId) {
      return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Require known user for replies
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', senderEmail)
      .single();

    // Okänd avsändare i en tråd är inte samma sak som ingen avsändare. Sedan
    // välkomstmejlet till nya leads går från vår Gmail börjar varje sådan
    // konversation med ett meddelande från oss, så leadets första svar räknas
    // som ett svar och hamnar här — utan profil. Förr tystnade AI:n då.
    // Prospektflödet klarar situationen; det är samma som ett förstagångsmejl,
    // fast med historik.
    if (!profile) {
      console.log(`[inmail/reply] ${senderEmail} saknar konto — hanteras som prospekt`);
      return NextResponse.json(await handleUnknownUser({
        supabase,
        senderEmail,
        subject,
        body: emailBody,
        gmailThreadId,
        messageId,
        emailHistory,
      }));
    }

    const { data: thread } = await supabase
      .from('email_threads')
      .select('id, state, transaction_ids')
      .eq('gmail_thread_id', gmailThreadId)
      .single();

    const pendingState = thread?.state ?? null;
    const threadTransactionIds: string[] = thread?.transaction_ids ?? [];

    // Handle pending delete confirmation
    if (pendingState?.startsWith('pending_delete:')) {
      const { intent } = await classifyIntent({
        subject,
        body: emailBody,
        hasAttachments: attachments.length > 0,
        pendingState,
      });

      if (intent === 'CONFIRM_ACTION') {
        return NextResponse.json(await handleDeleteConfirm({
          supabase, profile, gmailThreadId, messageId, pendingState,
        }));
      } else if (intent === 'CANCEL_ACTION') {
        return NextResponse.json(await handleDeleteCancel({
          supabase, profile, gmailThreadId, messageId,
        }));
      }
    }

    // Classify reply intent
    const classification = await classifyIntent({
      subject,
      body: emailBody,
      hasAttachments: attachments.length > 0,
      pendingState,
    });

    console.log(`[inmail/reply] ${senderEmail} → ${classification.intent} (${classification.confidence.toFixed(2)})`);

    switch (classification.intent) {
      case 'NEW_TRANSACTION':
        // Could be new receipt even in reply thread
        return NextResponse.json(await handleNewTransaction({
          supabase, profile, gmailThreadId, messageId, attachments,
        }));

      case 'EDIT_TRANSACTION':
        return NextResponse.json(await handleEditTransaction({
          supabase, profile, gmailThreadId, messageId,
          body: emailBody,
          emailHistory,
          threadTransactionIds,
        }));

      case 'DELETE_TRANSACTION':
        return NextResponse.json(await handleDeleteRequest({
          supabase, profile, gmailThreadId, messageId,
          body: emailBody,
          threadTransactionIds,
        }));

      case 'VIEW_TRANSACTIONS':
        return NextResponse.json(await handleViewTransactions({
          supabase, profile,
        }));

      case 'GENERAL_QUESTION':
        return NextResponse.json(await handleGeneralQuestion({
          supabase, profile, subject, body: emailBody, emailHistory,
        }));

      default:
        // Fallback: treat as edit correction (original behavior)
        return NextResponse.json(await handleEditTransaction({
          supabase, profile, gmailThreadId, messageId,
          body: emailBody,
          emailHistory,
          threadTransactionIds,
        }));
    }
  } catch (err) {
    console.error('Error in /api/inmail/reply:', err);
    return NextResponse.json({ error: 'Internt fel' }, { status: 500 });
  }
}
