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
 *
 * Utöver lösenordet krävs en sms-kod till någon av personerna i
 * `ADMIN_PHONES`. Lösenordet ensamt räcker alltså inte om det läcker.
 */

import { normalizePhone } from './sms/phone';

export const ADMIN_COOKIE = 'admin_session';

/** Kakan som håller sms-koden mellan "skicka kod" och "skriv in kod". */
export const SMS_COOKIE = 'admin_sms';

/** Hur länge en sms-kod går att använda. */
export const SMS_MAX_AGE_SECONDS = 5 * 60;

/** Hur länge en inloggning gäller innan koden måste skrivas in igen. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

/**
 * Vilka som får logga in, och vart deras sms-kod ska. Står i `ADMIN_PHONES`
 * som `Namn:nummer` separerade med komma, t.ex.
 * `Erik:0701234567,Anna:+46731234567`. Namnen visas först efter rätt
 * lösenord, så de avslöjar inget för den som bara hittat inloggningsrutan.
 */
export type AdminPerson = { name: string; phone: string };

export function adminPeople(): AdminPerson[] {
  return (process.env.ADMIN_PHONES ?? '')
    .split(',')
    .map((entry) => {
      const [name, raw] = entry.split(':').map((part) => part.trim());
      const phone = normalizePhone(raw);
      return name && phone ? { name, phone } : null;
    })
    .filter((person): person is AdminPerson => person !== null);
}

/**
 * Om lösenordet eller sms-mottagarna saknas är panelen låst för alla — inte
 * öppen för alla.
 */
export function isConfigured(): boolean {
  return adminPassword() !== null && adminPeople().length > 0;
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

/** Sex slumpade siffror, med inledande nollor. */
export function generateSmsCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return String(value % 1_000_000).padStart(6, '0');
}

/**
 * Sms-koden sparas inte någonstans på servern. Kakan bär utgångstid, vem koden
 * gick till och en signatur över koden — rätt kod går att kontrollera, men
 * koden själv går inte att läsa ut ur kakan. Signaturen bygger på lösenordet,
 * så den som inte har det kan inte heller tillverka en egen kaka.
 */
export async function createSmsChallenge(person: number, smsCode: string): Promise<string | null> {
  const password = adminPassword();
  if (!password) return null;
  const expiresAt = String(Date.now() + SMS_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${person}.${await sign(`sms.${expiresAt}.${person}.${smsCode}`, password)}`;
}

export async function smsCodeMatches(token: string | undefined, input: unknown): Promise<boolean> {
  const password = adminPassword();
  if (!password || !token || typeof input !== 'string') return false;

  const [expiresAt, person, signature] = token.split('.');
  if (!expiresAt || !person || !signature) return false;

  const expires = Number(expiresAt);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const code = input.replace(/\D/g, '');
  return equalConstantTime(signature, await sign(`sms.${expiresAt}.${person}.${code}`, password));
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
