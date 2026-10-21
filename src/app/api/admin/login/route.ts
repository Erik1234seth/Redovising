import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SMS_COOKIE,
  SMS_MAX_AGE_SECONDS,
  adminPeople,
  createSession,
  createSmsChallenge,
  generateSmsCode,
  isConfigured,
  isValidSession,
  passwordMatches,
  smsCodeMatches,
} from '@/lib/admin-auth';
import { sendSms } from '@/lib/sms/twilio';

/**
 * Inloggningen till adminpanelen.
 *
 * GET säger om den nuvarande kakan duger, POST loggar in, DELETE loggar ut.
 * Det här är den enda routen under `/api/admin/` som middleware släpper förbi
 * utan kaka — annars gick den inte att logga in genom.
 *
 * POST tas i tre steg, och lösenordet skickas med i alla tre:
 *   { code }                    → vilka personer som kan få en sms-kod
 *   { code, person }            → skickar sms-koden till den personen
 *   { code, person, smsCode }   → kontrollerar sms-koden och loggar in
 */

/**
 * Bromskloss mot att någon sitter och gissar koden. Räknaren lever i minnet på
 * den instans som råkar svara, så på Vercel delas den inte mellan instanser —
 * den gör gissandet långsamt, inte omöjligt. Ett långt lösenord gör resten.
 * Fel sms-kod räknas som ett misslyckat försök, och varje skickat sms också —
 * annars gick det att få oss att skicka hur många sms som helst.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function tooManyAttempts(ip: string): boolean {
  const seen = attempts.get(ip);
  if (!seen || seen.until < Date.now()) return false;
  return seen.count >= MAX_ATTEMPTS;
}

function noteFailure(ip: string) {
  const seen = attempts.get(ip);
  if (!seen || seen.until < Date.now()) {
    attempts.set(ip, { count: 1, until: Date.now() + WINDOW_MS });
    return;
  }
  seen.count += 1;
}

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'okänd';
}

function sessionCookie(response: NextResponse, value: string, maxAge: number, name = ADMIN_COOKIE) {
  response.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  return response;
}

/** Panelen frågar den här vid start för att veta om den ska visa kodrutan. */
export async function GET(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'ADMIN_PASSWORD eller ADMIN_PHONES saknas i miljövariablerna' },
      { status: 500 },
    );
  }
  const valid = await isValidSession(request.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ ok: valid }, { status: valid ? 200 : 401 });
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          'ADMIN_PASSWORD eller ADMIN_PHONES saknas i miljövariablerna. Panelen är låst tills de är satta.',
      },
      { status: 500 },
    );
  }

  const ip = clientIp(request);
  if (tooManyAttempts(ip)) {
    return NextResponse.json(
      { error: 'För många försök. Vänta en kvart och prova igen.' },
      { status: 429 },
    );
  }

  const { code, person, smsCode } = await request.json().catch(() => ({}));
  if (!passwordMatches(code)) {
    noteFailure(ip);
    return NextResponse.json({ error: 'Fel kod' }, { status: 401 });
  }

  const people = adminPeople();

  // Steg 1: lösenordet stämmer, visa vilka som kan ta emot en sms-kod
  if (person === undefined || person === null) {
    return NextResponse.json({ step: 'person', people: people.map((p) => p.name) });
  }

  const index = Number(person);
  const recipient = Number.isInteger(index) ? people[index] : undefined;
  if (!recipient) return NextResponse.json({ error: 'Okänd person' }, { status: 400 });

  // Steg 2: skicka sms-koden
  if (!smsCode) {
    noteFailure(ip);
    const smsValue = generateSmsCode();
    const challenge = await createSmsChallenge(index, smsValue);
    if (!challenge) return NextResponse.json({ error: 'Kunde inte skapa koden' }, { status: 500 });

    try {
      await sendSms({ to: recipient.phone, body: `Din kod till adminpanelen: ${smsValue}` });
    } catch (error) {
      console.error('[admin-login] sms gick inte iväg', error);
      return NextResponse.json({ error: 'Kunde inte skicka sms. Prova igen.' }, { status: 502 });
    }

    return sessionCookie(
      NextResponse.json({ step: 'sms', sentTo: `•••• ${recipient.phone.slice(-4)}` }),
      challenge,
      SMS_MAX_AGE_SECONDS,
      SMS_COOKIE,
    );
  }

  // Steg 3: kontrollera sms-koden och logga in
  const challenge = request.cookies.get(SMS_COOKIE)?.value;
  if (challenge?.split('.')[1] !== String(index) || !(await smsCodeMatches(challenge, smsCode))) {
    noteFailure(ip);
    return NextResponse.json({ error: 'Fel eller för gammal sms-kod' }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await createSession();
  if (!token) return NextResponse.json({ error: 'Kunde inte skapa sessionen' }, { status: 500 });

  const response = sessionCookie(NextResponse.json({ ok: true }), token, SESSION_MAX_AGE_SECONDS);
  return sessionCookie(response, '', 0, SMS_COOKIE);
}

export async function DELETE() {
  return sessionCookie(NextResponse.json({ ok: true }), '', 0);
}
