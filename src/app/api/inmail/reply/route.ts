import { NextResponse, after } from 'next/server';
import { arUnderlagsmejl, korUnderlagsflode } from '@/lib/underlag-kontroll';
import { createClient } from '@supabase/supabase-js';
import { classifyIntent } from '@/lib/inmail/classify';
import { isNoReplyAddress } from '@/lib/inmail/no-reply';
import { handleEditTransaction } from '@/lib/inmail/handlers/edit-transaction';
import { handleDeleteRequest, handleDeleteConfirm, handleDeleteCancel } from '@/lib/inmail/handlers/delete-transaction';
import { handleViewTransactions } from '@/lib/inmail/handlers/view-transactions';
import { handleGeneralQuestion } from '@/lib/inmail/handlers/general-question';
import { handleUnknownUser } from '@/lib/inmail/handlers/unknown-user';
import { saveMailAttachments } from '@/lib/inmail/save-attachments';
import { withUnderlagAck } from '@/lib/inmail/underlag-ack';
import { arendenEfterMejl } from '@/lib/arenden/efter-mejl';
import { sparaMejlutkast } from '@/lib/inkorg/mejlutkast';
import { smsKontextForMejl } from '@/lib/inkorg/kontext';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Avläsning och kontroll av underlag körs efter svaret, men inom samma anrop. */
export const maxDuration = 300;

/** Svaret på mejlet, plus en bekräftelse när det kom underlag med det. */
export async function POST(request: Request) {
  const kopia = request.clone();
  const utkastKopia = request.clone();
  const svar = await withUnderlagAck(request, await handlePost(request.clone()));
  // Ger mejlet något vi ska göra senare blir det ett ärende, efter svaret
  arendenEfterMejl(kopia, svar);
  // Svaret blir ett utkast i adminpanelens inkorg, inte i Gmail
  return sparaMejlutkast(utkastKopia, svar);
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
      emailHistory: string;
      // Nyare scriptversioner laddar upp filerna själva och skickar bara namnen hit
      attachments?: Array<{ base64?: string; mimeType?: string; name?: string; size?: number }>;
    };

    const { senderEmail, gmailThreadId, messageId, emailHistory } = body;
    const subject = body.subject ?? '';
    const emailBody = body.emailBody ?? '';
    const attachments = body.attachments ?? [];

    if (!senderEmail || !gmailThreadId || !messageId) {
      return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 });
    }

    // Systemutskick och studsar får aldrig ett utkast. Skriptet skapar bara ett
    // utkast när svaret har replyBody, så det räcker att svara utan.
    if (isNoReplyAddress(senderEmail)) {
      console.log(`[inmail/reply] ${senderEmail} är en no-reply-adress — inget utkast`);
      return NextResponse.json({ action: 'skipped', reason: 'no-reply-sender' });
    }

    const supabase = getSupabase();

    // Bilagorna sparas som underlag först — se samma steg i /api/inmail
    const savedUnderlag = await saveMailAttachments({ supabase, senderEmail, messageId, attachments });
    if (savedUnderlag) console.log(`[inmail/reply] ${savedUnderlag} bilagor från ${senderEmail} sparade som underlag`);

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
        attachmentNames: attachments.map((a, i) => a.name || `bilaga-${i + 1}`),
        smsKontext: await smsKontextForMejl(supabase, senderEmail),
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

    // Underlag först: bilagor, eller ett svar på det vi frågat om underlaget.
    // Avläsning och kontroll tar minuter och görs efter svaret till Apps
    // Script. Utkastet hamnar i inkorgen när det är klart.
    if (await arUnderlagsmejl({
      supabase, profil: profile, amne: subject, text: emailBody, historik: emailHistory,
      harBilagor: savedUnderlag > 0 || attachments.length > 0,
    })) {
      after(() => korUnderlagsflode({
        supabase: getSupabase(), profil: profile, avsandare: senderEmail, messageId,
        threadId: gmailThreadId, amne: subject, text: emailBody, historik: emailHistory,
      }));
      return NextResponse.json({ action: 'underlag_kontroll' });
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
        // Filerna är redan sparade som underlag ovan. Tolkningen görs i ett
        // separat steg senare, inte här — och inget svar går tillbaka.
        return NextResponse.json({ action: 'saved_as_underlag', saved: savedUnderlag });

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
          attachmentNames: attachments.map((a, i) => a.name || `bilaga-${i + 1}`),
          smsKontext: await smsKontextForMejl(supabase, senderEmail),
        }));

      default:
        // Filer utan begriplig text är inlämnade underlag — ingen ändringsfråga.
        // Bekräftelsen läggs på av withUnderlagAck.
        if (attachments.length) {
          return NextResponse.json({ action: 'saved_as_underlag', saved: savedUnderlag });
        }
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
