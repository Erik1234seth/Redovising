import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSession,
  isConfigured,
  isValidSession,
  passwordMatches,
} from '@/lib/admin-auth';

/**
 * Inloggningen till adminpanelen.
 *
 * GET säger om den nuvarande kakan duger, POST loggar in, DELETE loggar ut.
 * Det här är den enda routen under `/api/admin/` som middleware släpper förbi
 * utan kaka — annars gick den inte att logga in genom.
 */

/**
 * Bromskloss mot att någon sitter och gissar koden. Räknaren lever i minnet på
 * den instans som råkar svara, så på Vercel delas den inte mellan instanser —
 * den gör gissandet långsamt, inte omöjligt. Ett långt lösenord gör resten.
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

function sessionCookie(response: NextResponse, value: string, maxAge: number) {
  response.cookies.set(ADMIN_COOKIE, value, {
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
      { ok: false, error: 'ADMIN_PASSWORD saknas i miljövariablerna' },
      { status: 500 },
    );
  }
  const valid = await isValidSession(request.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ ok: valid }, { status: valid ? 200 : 401 });
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD saknas i miljövariablerna. Panelen är låst tills den är satt.' },
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

  const { code } = await request.json().catch(() => ({ code: null }));
  if (!passwordMatches(code)) {
    noteFailure(ip);
    return NextResponse.json({ error: 'Fel kod' }, { status: 401 });
  }

  attempts.delete(ip);
  const token = await createSession();
  if (!token) return NextResponse.json({ error: 'Kunde inte skapa sessionen' }, { status: 500 });

  return sessionCookie(NextResponse.json({ ok: true }), token, SESSION_MAX_AGE_SECONDS);
}

export async function DELETE() {
  return sessionCookie(NextResponse.json({ ok: true }), '', 0);
}
