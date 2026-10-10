import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { cleanBody } from '@/lib/inmail/clean-body';
import { isNoReplyAddress } from '@/lib/inmail/no-reply';

/**
 * Mail-AI:ns svar blir ett utkast i vår inkorg i stället för i Gmail.
 *
 * Läggs ytterst runt /api/inmail och /api/inmail/reply. Apps Script skapar ett
 * Gmail-utkast bara när svaret har `replyBody` — därför plockas fältet bort här
 * och texten sparas i `mejl_utkast`. Inget går ut förrän någon trycker Skicka
 * i adminpanelen. Det kräver ingen ändring i check-inbox.gs.
 *
 * Det inkommande mejlet skrivs samtidigt till `mail_messages`, så att det syns
 * i inkorgen direkt och inte först när Gmail-synken går (en gång i timmen).
 * Synken gör upsert på samma id och skriver då över med Gmails egna uppgifter.
 *
 * `request` måste vara en oläst kopia.
 */
export async function sparaMejlutkast(request: Request, response: Response): Promise<Response> {
  if (response.status !== 200) return response;

  let data: Record<string, unknown>;
  try {
    data = await response.clone().json();
  } catch {
    return response;
  }

  try {
    const body = await request.json() as {
      senderEmail?: string; gmailThreadId?: string; messageId?: string; subject?: string; emailBody?: string;
      attachments?: { name?: string }[];
    };
    const email = body.senderEmail?.trim().toLowerCase();
    if (!email || !body.messageId || !body.gmailThreadId || isNoReplyAddress(email)) return response;

    const supabase = createServerClient();
    const raw = (body.emailBody ?? '').replace(/\r/g, '').slice(0, 50_000);
    const { error: mFel } = await supabase.from('mail_messages').upsert({
      gmail_message_id: body.messageId,
      gmail_thread_id: body.gmailThreadId,
      direction: 'in',
      from_email: email,
      to_emails: [],
      customer_email: email,
      subject: body.subject?.trim() || null,
      body: cleanBody(raw),
      body_raw: raw,
      attachment_names: (body.attachments ?? []).map((a, i) => a.name || `bilaga-${i + 1}`),
      sent_at: new Date().toISOString(),
    }, { onConflict: 'gmail_message_id', ignoreDuplicates: true });
    if (mFel) console.error('[inkorg] kunde inte spara inkommande mejl:', mFel.message);

    const text = typeof data.replyBody === 'string' ? data.replyBody.trim() : '';
    if (!text) return response;

    const { data: rad, error } = await supabase.from('mejl_utkast').insert({
      till_email: email,
      amne: body.subject?.trim() || null,
      text,
      gmail_thread_id: body.gmailThreadId,
      svar_pa_message_id: body.messageId,
      kalla: 'ai',
    }).select('id').single();

    // Samma mejl två gånger (Apps Script försökte igen) ger samma utkast — det första vinner
    if (error && error.code !== '23505') {
      // Utkastet får inte försvinna: hellre ett Gmail-utkast som förr än inget alls
      console.error('[inkorg] kunde inte spara utkastet, låter Gmail ta det:', error.message);
      return response;
    }

    const { replyBody, ...rest } = data;
    void replyBody;
    return NextResponse.json({ ...rest, utkast: rad?.id ?? 'finns redan' });
  } catch (err) {
    console.error('[inkorg] sparaMejlutkast:', err instanceof Error ? err.message : err);
    return response;
  }
}
