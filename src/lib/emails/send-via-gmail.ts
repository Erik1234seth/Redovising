import { randomUUID } from 'crypto';
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
 *
 * ─── Tappade svar ─────────────────────────────────────────────────────────────
 * Apps Script svarar på en POST med en 302 till en engångsadress där svaret
 * ligger. Adressen går att läsa en enda gång (provat: andra läsningen ger en ny
 * 302), och ibland svarar den 404 redan första gången. Mejlet har då redan gått
 * iväg — scriptet körde klart innan omdirigeringen skickades.
 *
 * Varje utskick får därför ett eget `ref`. Scriptet sparar utfallet under det,
 * och tappar vi svaret frågar vi efter det igen med `action: 'lookup'`. Vi
 * skickar aldrig om, så ett tappat svar kan inte bli ett dubbelt mejl.
 */

interface GmailResult {
  ok: boolean;
  /** Gmail-trådens id, så att svaret går att koppla ihop med utskicket. */
  threadId?: string;
  error?: string;
}

const SEND_TIMEOUT_MS = 20_000;
/** Scriptet väntar själv upp till 15 s på ett pågående utskick. */
const LOOKUP_TIMEOUT_MS = 25_000;

/** Ett svar vi inte fick läsa. Mejlet kan mycket väl ha gått iväg. */
class LostResponse extends Error {}

/**
 * Gör en felsida läsbar. Google svarar med hela HTML-sidor, och de första 200
 * tecknen av en sådan är bara skript — det såg ut som att meddelandet kapats.
 */
function describeBody(status: number, text: string): string {
  if (!/<html|<!doctype/i.test(text)) return `HTTP ${status}: ${text.slice(0, 500)}`;
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  return `HTTP ${status}${title ? ` (${title})` : ''} — Google svarade med en felsida i stället för scriptets svar`;
}

async function post(url: string, body: Record<string, unknown>, timeoutMs: number): Promise<GmailResult & Record<string, unknown>> {
  const signal = AbortSignal.timeout(timeoutMs);

  let response: Response;
  try {
    // Omdirigeringen följs för hand, så att vi vet om det var scriptet eller
    // engångsadressen som fallerade
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal,
    });
  } catch (err) {
    // Timeout innan scriptet svarat: det kan fortfarande hålla på att skicka
    throw new LostResponse(err instanceof Error ? err.message : String(err));
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new LostResponse(`HTTP ${response.status} utan adress att hämta svaret på`);
    try {
      response = await fetch(location, { signal });
    } catch (err) {
      throw new LostResponse(err instanceof Error ? err.message : String(err));
    }
    if (!response.ok) {
      // Scriptet har kört klart — det var bara svaret som försvann på vägen
      throw new LostResponse(describeBody(response.status, await response.text()));
    }
  }

  const text = await response.text();
  if (!response.ok) return { ok: false, error: `Apps Script svarade ${describeBody(response.status, text)}` };

  try {
    return JSON.parse(text);
  } catch {
    // Kommer man hit har scriptet oftast returnerat en inloggningssida, vilket
    // betyder att webbappen inte är publicerad för "alla".
    return { ok: false, error: `Oväntat svar från Apps Script: ${describeBody(response.status, text)}` };
  }
}

async function callScript(payload: Record<string, unknown>): Promise<GmailResult> {
  const url = process.env.GMAIL_SCRIPT_URL;
  const secret = process.env.GMAIL_SCRIPT_SECRET;

  if (!url || !secret) {
    return { ok: false, error: 'GMAIL_SCRIPT_URL eller GMAIL_SCRIPT_SECRET saknas' };
  }

  const ref = randomUUID();

  try {
    const parsed = await post(url, { secret, ref, ...payload }, SEND_TIMEOUT_MS);
    if (!parsed.ok) return { ok: false, error: parsed.error || 'Apps Script nekade utskicket' };
    return { ok: true, threadId: parsed.threadId };
  } catch (err) {
    if (!(err instanceof LostResponse)) throw err;
    return recover(url, secret, ref, err.message);
  }
}

/** Frågar scriptet hur det gick med ett utskick vars svar vi tappade. */
async function recover(url: string, secret: string, ref: string, lost: string): Promise<GmailResult> {
  console.warn(`[gmail] tappade svaret (${lost}), frågar scriptet om ${ref}`);

  let answer: Record<string, unknown>;
  try {
    answer = await post(url, { secret, action: 'lookup', ref }, LOOKUP_TIMEOUT_MS);
  } catch (err) {
    const again = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Svaret från Gmail tappades (${lost}) och kontrollen misslyckades också (${again}). Okänt om mejlet gick iväg.` };
  }

  // En äldre scriptversion känner inte till lookup och svarar att to/subject/html saknas
  if (!answer.supported) {
    return { ok: false, error: `Svaret från Gmail tappades (${lost}). Okänt om mejlet gick iväg — Apps Script behöver publiceras om för att kunna kontrollera det.` };
  }

  if (answer.found && answer.result) {
    const result = answer.result as GmailResult;
    if (result.ok) console.log(`[gmail] ${ref} hade gått iväg trots tappat svar`);
    return result.ok
      ? { ok: true, threadId: result.threadId }
      : { ok: false, error: result.error || 'Apps Script nekade utskicket' };
  }

  return { ok: false, error: `Svaret från Gmail tappades (${lost}) och scriptet har inget utskick registrerat. Mejlet gick troligen inte iväg.` };
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
