import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from '@/lib/inmail/classify';
import { handleNewTransaction } from '@/lib/inmail/handlers/new-transaction';
import { handleEditTransaction } from '@/lib/inmail/handlers/edit-transaction';
import { handleDeleteRequest, handleDeleteConfirm, handleDeleteCancel } from '@/lib/inmail/handlers/delete-transaction';
import { handleViewTransactions } from '@/lib/inmail/handlers/view-transactions';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { handleOnboarding } from '@/lib/inmail/handlers/onboarding';

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

    if (!senderEmail || !gmailThreadId || !messageId || !emailHistory) {
      return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check thread state first — onboarding users don't have a profile yet
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id, state, transaction_ids')
      .eq('gmail_thread_id', gmailThreadId)
      .single();

    if (thread?.state?.startsWith('onboarding:')) {
      return NextResponse.json(await handleOnboarding({
        supabase,
        senderEmail,
        emailHistory,
        gmailThreadId,
        messageId,
      }));
    }

    // Require known user for all other reply types
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', senderEmail)
      .single();

    if (!profile) {
      return NextResponse.json({ action: 'no_user' });
    }

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
