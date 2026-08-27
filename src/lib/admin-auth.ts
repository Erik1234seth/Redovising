/**
 * Inloggningen till adminpanelen.
 *
 * Koden låg tidigare hårdkodad i `_shell.tsx` och kontrollerades i webbläsaren,
 * vilket betyder att den gick att läsa i klientbundeln och att den inte
 * skyddade någonting alls — `/api/admin/*` svarade på vem som helst. Nu ligger
 * lösenordet i `ADMIN_PASSWORD` på servern, och en lyckad inloggning ger en
 * signerad kaka som middleware kräver innan admin-API:t svarar.
 *
 * Signeringen görs med Web Crypto istället för Nodes `crypto`, för att samma
 * kod ska fungera både i API-routen och i middleware (som kör på Edge).
 *
 * Nyckeln till signaturen är lösenordet självt. Det ger en trevlig bieffekt:
 * byter du ADMIN_PASSWORD slutar alla utfärdade kakor att gälla direkt.
 */

export const ADMIN_COOKIE = 'admin_session';

/** Hur länge en inloggning gäller innan koden måste skrivas in igen. */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();

function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

/** Om lösenordet saknas är panelen låst för alla — inte öppen för alla. */
export function isConfigured(): boolean {
  return adminPassword() !== null;
}

async function sign(payload: string, password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Jämför två strängar utan att avslöja hur långt fram de är lika. En vanlig
 * `===` avbryter vid första skillnaden, och skillnaden i svarstid går att mäta.
 */
export function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function passwordMatches(input: unknown): boolean {
  const password = adminPassword();
  if (!password || typeof input !== 'string') return false;
  return equalConstantTime(input, password);
}

/** Kakans innehåll: när den går ut, och en signatur över samma tidpunkt. */
export async function createSession(): Promise<string | null> {
  const password = adminPassword();
  if (!password) return null;
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${await sign(expiresAt, password)}`;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  const password = adminPassword();
  if (!password || !token) return false;

  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) return false;

  const expires = Number(expiresAt);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  return equalConstantTime(signature, await sign(expiresAt, password));
}
