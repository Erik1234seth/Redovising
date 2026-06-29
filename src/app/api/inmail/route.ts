import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from '@/lib/inmail/classify';
import { handleNewTransaction } from '@/lib/inmail/handlers/new-transaction';
import { handleEditTransaction } from '@/lib/inmail/handlers/edit-transaction';
import { handleDeleteRequest, handleDeleteConfirm, handleDeleteCancel } from '@/lib/inmail/handlers/delete-transaction';
import { handleViewTransactions } from '@/lib/inmail/handlers/view-transactions';
import { handleUnknownUser } from '@/lib/inmail/handlers/unknown-user';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';

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
      attachments?: Array<{ base64: string; mimeType: string; name: string }>;
    };

    const { senderEmail, gmailThreadId, messageId } = body;
    const subject = body.subject ?? '';
    const emailBody = body.emailBody ?? '';
    const attachments = body.attachments ?? [];

    if (!senderEmail || !gmailThreadId || !messageId) {
      return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Look up user
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', senderEmail)
      .single();

    // Unknown user — handle separately
    if (!profile) {
      const result = await handleUnknownUser({
        supabase,
        senderEmail,
        subject,
        body: emailBody,
        gmailThreadId,
        messageId,
      });
      return NextResponse.json(result);
    }

    // Load thread state if this is part of an existing thread
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id, state, transaction_ids')
      .eq('gmail_thread_id', gmailThreadId)
      .single();

    const pendingState = thread?.state ?? null;

    // Handle pending confirmation/cancellation first
    if (pendingState?.startsWith('pending_delete:')) {
      const { intent } = await classifyIntent({
        subject,
        body: emailBody,
        hasAttachments: attachments.length > 0,
        pendingState,
      });

      if (intent === 'CONFIRM_ACTION') {
        const result = await handleDeleteConfirm({
          supabase, profile, gmailThreadId, messageId, pendingState,
        });
        return NextResponse.json(result);
      } else if (intent === 'CANCEL_ACTION') {
        const result = await handleDeleteCancel({
          supabase, profile, gmailThreadId, messageId,
        });
        return NextResponse.json(result);
      }
      // If neither confirm nor cancel, fall through to normal classification
    }

    // Classify intent
    const classification = await classifyIntent({
      subject,
      body: emailBody,
      hasAttachments: attachments.length > 0,
      pendingState,
    });

    console.log(`[inmail] ${senderEmail} → ${classification.intent} (${classification.confidence.toFixed(2)}): ${classification.reasoning}`);

    const threadTransactionIds = thread?.transaction_ids ?? [];

    switch (classification.intent) {
      case 'NEW_TRANSACTION':
        return NextResponse.json(await handleNewTransaction({
          supabase, profile, gmailThreadId, messageId, attachments,
        }));

      case 'EDIT_TRANSACTION':
        return NextResponse.json(await handleEditTransaction({
          supabase, profile, gmailThreadId, messageId,
          body: emailBody,
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
          supabase, profile, subject, body: emailBody,
        }));

      case 'UNCLEAR':
      default:
        return NextResponse.json({
          action: 'ok',
          replyBody: `Hej${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}!\n\nTack för ditt mejl. Vi förstod inte riktigt vad du behöver hjälp med. Kan du beskriva lite mer vad du vill göra?\n\nExempel:\n- Skicka kvitto eller faktura som bilaga för att bokföra\n- Skriv "visa mina transaktioner" för att se dina bokföringar\n- Skriv "ta bort transaktion" följt av vilken\n\n// Enkla Bokslut`,
        });
    }
  } catch (err) {
    console.error('Error in /api/inmail:', err);
    return NextResponse.json({ error: 'Internt fel' }, { status: 500 });
  }
}
