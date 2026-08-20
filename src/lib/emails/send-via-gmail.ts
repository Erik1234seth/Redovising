import { logEmail, type EmailKind } from '../email-log';

/**
 * Skickar mejl genom Erik's Gmail istället för Resend.
 *
 * Varför inte Resend: mail-AI:n bevakar redan Gmail-inkorgen. Går välkomstmejlet
 * ut därifrån hamnar det i Skickat, svaret landar i samma tråd, och AI:n kan ta
 * över konversationen. Ett mejl från noreply@ via Resend blir en återvändsgränd.
 *
 * Hur: Apps Script-projektet som redan driver mail-AI:n publiceras även som
 * webbapp med en `doPost`. Vi postar dit, scriptet kallar `GmailApp.sendEmail`
 * och svarar med Gmail-trådens id. Delad hemlighet i kroppen, eftersom en
 * publicerad Apps Script-webbapp inte kan kräva egna headers.
 *
 * Gränser värda att känna till: Apps Script får skicka 1 500 mejl per dygn på
 * ett Workspace-konto (100 på ett vanligt gmail.com-konto). Vi ligger långt
 * under, men taket är per dygn och delas med allt annat scriptet skickar.
 */

interface GmailResult {
  ok: boolean;
  /** Gmail-trådens id, så att svaret går att koppla ihop med utskicket. */
  threadId?: string;
  error?: string;
}

async function callScript(payload: Record<string, unknown>): Promise<GmailResult> {
  const url = process.env.GMAIL_SCRIPT_URL;
  const secret = process.env.GMAIL_SCRIPT_SECRET;

  if (!url || !secret) {
    return { ok: false, error: 'GMAIL_SCRIPT_URL eller GMAIL_SCRIPT_SECRET saknas' };
  }

  // Apps Script svarar med en 302 till script.googleusercontent.com; fetch
  // följer den av sig själv. Timeouten finns för att ett trögt script inte ska
  // hålla lead-routen gisslan — SMS:et ska ut oavsett.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, ...payload }),
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();

  if (!response.ok) {
    return { ok: false, error: `Apps Script svarade ${response.status}: ${text.slice(0, 200)}` };
  }

  try {
    const parsed = JSON.parse(text) as { ok?: boolean; threadId?: string; error?: string };
    if (!parsed.ok) return { ok: false, error: parsed.error || 'Apps Script nekade utskicket' };
    return { ok: true, threadId: parsed.threadId };
  } catch {
    // Kommer man hit har scriptet oftast returnerat en inloggningssida, vilket
    // betyder att webbappen inte är publicerad för "alla".
    return { ok: false, error: `Oväntat svar från Apps Script: ${text.slice(0, 200)}` };
  }
}

export async function sendViaGmail(params: {
  to: string;
  subject: string;
  html: string;
  kind: EmailKind;
}): Promise<boolean> {
  let result: GmailResult;

  try {
    result = await callScript({
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { ok: false, error: message };
  }

  if (!result.ok) {
    console.error(`[gmail] ${params.kind} till ${params.to} misslyckades:`, result.error);
  }

  await logEmail({
    to: params.to,
    subject: params.subject,
    kind: params.kind,
    provider: 'gmail',
    providerId: result.threadId,
    error: result.ok ? null : result.error,
  });

  return result.ok;
}
