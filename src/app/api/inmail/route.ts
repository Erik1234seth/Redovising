import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from '@/lib/inmail/classify';
import { isNoReplyAddress } from '@/lib/inmail/no-reply';
import { handleEditTransaction } from '@/lib/inmail/handlers/edit-transaction';
import { handleDeleteRequest, handleDeleteConfirm, handleDeleteCancel } from '@/lib/inmail/handlers/delete-transaction';
import { handleViewTransactions } from '@/lib/inmail/handlers/view-transactions';
import { handleUnknownUser } from '@/lib/inmail/handlers/unknown-user';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { saveMailAttachments } from '@/lib/inmail/save-attachments';
import { withUnderlagAck } from '@/lib/inmail/underlag-ack';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Svaret på mejlet, plus en bekräftelse när det kom underlag med det. */
export async function POST(request: Request) {
  return withUnderlagAck(request, await handlePost(request.clone()));
}

async function handlePost(request: Request) {
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
      // Nyare scriptversioner laddar upp filerna själva och skickar bara namnen hit
      attachments?: Array<{ base64?: string; mimeType?: string; name?: string; size?: number }>;
    };

    const { senderEmail, gmailThreadId, messageId } = body;
    const subject = body.subject ?? '';
    const emailBody = body.emailBody ?? '';
    const attachments = body.attachments ?? [];

    if (!senderEmail || !gmailThreadId || !messageId) {
      return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 });
    }

    // Systemutskick och studsar får aldrig ett utkast. Skriptet skapar bara ett
    // utkast när svaret har replyBody, så det räcker att svara utan.
    if (isNoReplyAddress(senderEmail)) {
      console.log(`[inmail] ${senderEmail} är en no-reply-adress — inget utkast`);
      return NextResponse.json({ action: 'skipped', reason: 'no-reply-sender' });
    }

    const supabase = getSupabase();

    // Bilagorna sparas som underlag först, oavsett vem som skickat dem och vad
    // AI:n sedan kommer fram till. Då finns filen kvar även om tolkningen fallerar.
    const savedUnderlag = await saveMailAttachments({ supabase, senderEmail, messageId, attachments });
    if (savedUnderlag) console.log(`[inmail] ${savedUnderlag} bilagor från ${senderEmail} sparade som underlag`);

    // Look up user
    let { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', senderEmail)
      .single();

    // Kunden kan svara från en annan adress än den kontot står på. Har någon
    // kopplat adressen för hand i adminpanelen hör den till samma person, och
    // svaret ska då byggas på kundens uppgifter och inte behandlas som ett
    // mejl från en främling.
    if (!profile) {
      const { data: alias } = await supabase
        .from('person_aliases')
        .select('user_id')
        .eq('alias_email', senderEmail.trim().toLowerCase())
        .not('user_id', 'is', null)
        .maybeSingle();

      if (alias?.user_id) {
        const { data: linked } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', alias.user_id)
          .single();
        if (linked) {
          console.log(`[inmail] ${senderEmail} är en kopplad adress till ${linked.email}`);
          profile = linked;
        }
      }
    }

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
        // Filerna är redan sparade som underlag ovan. Tolkningen görs i ett
        // separat steg senare, inte här — och inget svar går tillbaka.
        return NextResponse.json({ action: 'saved_as_underlag', saved: savedUnderlag });

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
          replyBody: `Hej${profile.full_name ? ' ' + profile.full_name.split(' ')[0] : ''}!\n\nTack för ditt mejl. Vi förstod inte riktigt vad du behöver hjälp med. Kan du beskriva lite mer vad du vill göra?\n\nExempel:\n- Skicka kvitto eller faktura som bilaga för att bokföra\n- Skriv "visa mina transaktioner" för att se dina bokföringar\n- Skriv "ta bort transaktion" följt av vilken`,
        });
    }
  } catch (err) {
    console.error('Error in /api/inmail:', err);
    return NextResponse.json({ error: 'Internt fel' }, { status: 500 });
  }
}
