import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { aterstallK1Konto, hamtaK1Andringar, sparaK1Andring } from '@/lib/kontering/k1-andringar';
import { originalKonto, type K1Andring } from '@/lib/kontering/regelverk';

/**
 * Byrån ändrar kontobeskrivningen för ett K1-konto (@/lib/kontering/k1-andringar).
 *
 *   GET     originalet, byråns ändring och texten som gäller
 *   PUT     spara kontots text — fält som är lika med originalet sparas som original
 *   DELETE  återställ kontot till originalet
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function fel(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[admin/k1-konto]', message);
  return NextResponse.json({ error: message }, { status });
}

const LISTOR = ['anvandNar', 'anvandInteNar', 'beslutsregler', 'varningar', 'exempel', 'granskningNar', 'nyckelord'] as const;

export async function GET(request: NextRequest) {
  const konto = request.nextUrl.searchParams.get('konto') ?? '';
  const original = originalKonto(konto);
  if (!original) return fel(`${konto} finns inte bland K1-kontona`, 404);
  try {
    const sparad = (await hamtaK1Andringar(getSupabase())).get(original.konto) ?? null;
    return NextResponse.json({
      original,
      andring: sparad?.andring ?? null,
      andradAt: sparad?.updatedAt ?? null,
      aktuell: { ...original, ...(sparad?.andring ?? {}) },
    });
  } catch (err) {
    return fel(err);
  }
}

export async function PUT(request: NextRequest) {
  let body: { konto?: string } & K1Andring;
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
  }
  const original = originalKonto(body.konto ?? '');
  if (!original) return fel(`${body.konto} finns inte bland K1-kontona`, 404);

  // Bara det som skiljer från originalet sparas, så att en senare ny k1.json syns i resten
  const andring: { [K in keyof K1Andring]: K1Andring[K] | null } = {};
  const beskrivning = typeof body.beskrivning === 'string' ? body.beskrivning.trim() : undefined;
  if (beskrivning !== undefined) {
    if (!beskrivning) return fel('Beskrivningen kan inte vara tom', 400);
    andring.beskrivning = beskrivning === original.beskrivning ? null : beskrivning;
  }
  for (const falt of LISTOR) {
    const v = body[falt];
    if (v === undefined) continue;
    if (!Array.isArray(v)) return fel(`${falt} ska vara en lista`, 400);
    const rader = v.map((x) => String(x ?? '').trim()).filter(Boolean);
    andring[falt] = JSON.stringify(rader) === JSON.stringify(original[falt]) ? null : rader;
  }

  try {
    const supabase = getSupabase();
    if (Object.values(andring).every((v) => v === null)) await aterstallK1Konto(supabase, original.konto);
    else await sparaK1Andring(supabase, original.konto, andring);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}

export async function DELETE(request: NextRequest) {
  const konto = request.nextUrl.searchParams.get('konto') ?? '';
  if (!originalKonto(konto)) return fel(`${konto} finns inte bland K1-kontona`, 404);
  try {
    await aterstallK1Konto(getSupabase(), konto);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}
