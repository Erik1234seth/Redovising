import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { aterstallK1Konto, hamtaK1Andringar, sparaK1Andring } from '@/lib/kontering/k1-andringar';
import { k1Fil, medAndring, originalKonto, type K1Andring } from '@/lib/kontering/regelverk';
import { k1Xlsx } from '@/lib/kontering/k1-xlsx';
import { importeraKonton, lasKontoFil } from '@/lib/kontering/k1-import';

/**
 * Byrån ändrar och lägger till K1-konton (@/lib/kontering/k1-andringar).
 *
 *   GET ?konto=5800    originalet, byråns ändring och texten som gäller
 *   GET                alla konton som de gäller, för kontoplanen
 *   GET ?fil=json|xlsx hela kontobeskrivningarna med ändringar och nya konton
 *   PUT                spara kontots text — fält som är lika med originalet sparas som original.
 *                      `ny: true` lägger till ett konto som inte finns i k1.json.
 *   DELETE ?konto=     återställ kontot till originalet, eller ta bort ett tillagt konto
 *   POST               importera en xlsx- eller JSON-fil (formulärfältet fil) med samma struktur som
 *                      nedladdningen. Utan spara=1 visas bara vad som skulle ändras.
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

function andringar(sparade: Awaited<ReturnType<typeof hamtaK1Andringar>>) {
  return new Map([...sparade].map(([k, v]) => [k, v.andring]));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  try {
    const sparade = await hamtaK1Andringar(getSupabase());

    const fil = sp.get('fil');
    if (fil) {
      const data = k1Fil(andringar(sparade));
      const datum = new Date().toLocaleDateString('sv-SE');
      if (fil === 'json') {
        return new NextResponse(JSON.stringify(data, null, 1) + '\n', {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="K1_kontobeskrivningar_${datum}.json"`,
          },
        });
      }
      if (fil === 'xlsx') {
        return new NextResponse(new Uint8Array(k1Xlsx(data)), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="K1_kontobeskrivningar_${datum}.xlsx"`,
          },
        });
      }
      return fel('fil ska vara json eller xlsx', 400);
    }

    const konto = sp.get('konto');
    if (konto === null) {
      const konton = k1Fil(andringar(sparade)).konton.map((k) => {
        const s = sparade.get(k.konto);
        return {
          konto: k.konto,
          namn: k.namn,
          beskrivning: k.beskrivning,
          status: !originalKonto(k.konto) ? 'ny' : s ? 'andrad' : 'original',
          andradAt: s?.updatedAt ?? null,
        };
      });
      return NextResponse.json({ konton });
    }

    const original = originalKonto(konto);
    const sparad = sparade.get(konto.trim()) ?? null;
    if (!original && !sparad) return fel(`${konto} finns inte bland K1-kontona`, 404);
    return NextResponse.json({
      original,
      andring: sparad?.andring ?? null,
      andradAt: sparad?.updatedAt ?? null,
      aktuell: medAndring(konto.trim(), sparad?.andring),
    });
  } catch (err) {
    return fel(err);
  }
}

export async function PUT(request: NextRequest) {
  let body: { konto?: string; ny?: boolean } & K1Andring;
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
  }
  const konto = String(body.konto ?? '').trim();
  const original = originalKonto(konto);
  const supabase = getSupabase();

  try {
    if (!original) {
      // Ett konto byrån lagt till: hela texten sparas, det finns inget original att jämföra med
      const finns = (await hamtaK1Andringar(supabase)).has(konto);
      if (!finns && !body.ny) return fel(`${konto} finns inte bland K1-kontona`, 404);
      if (!/^\d{4}$/.test(konto)) return fel('Kontonumret ska vara fyra siffror', 400);
      const namn = String(body.namn ?? '').trim();
      const beskrivning = String(body.beskrivning ?? '').trim();
      if (!namn) return fel('Kontot behöver ett namn', 400);
      if (!beskrivning) return fel('Beskrivningen kan inte vara tom', 400);
      const rad: Record<string, unknown> = { namn, beskrivning };
      for (const falt of LISTOR) {
        const v = body[falt] ?? [];
        if (!Array.isArray(v)) return fel(`${falt} ska vara en lista`, 400);
        rad[falt] = v.map((x) => String(x ?? '').trim()).filter(Boolean);
      }
      await sparaK1Andring(supabase, konto, rad);
      return NextResponse.json({ ok: true });
    }

    if (body.ny) return fel(`${konto} ${original.namn} finns redan`, 409);

    // Bara det som skiljer från originalet sparas, så att en senare ny k1.json syns i resten
    const andring: { [K in keyof K1Andring]: K1Andring[K] | null } = {};
    for (const falt of ['namn', 'beskrivning'] as const) {
      const v = typeof body[falt] === 'string' ? body[falt].trim() : undefined;
      if (v === undefined) continue;
      if (!v) return fel(falt === 'namn' ? 'Kontot behöver ett namn' : 'Beskrivningen kan inte vara tom', 400);
      andring[falt] = v === original[falt] ? null : v;
    }
    for (const falt of LISTOR) {
      const v = body[falt];
      if (v === undefined) continue;
      if (!Array.isArray(v)) return fel(`${falt} ska vara en lista`, 400);
      const rader = v.map((x) => String(x ?? '').trim()).filter(Boolean);
      andring[falt] = JSON.stringify(rader) === JSON.stringify(original[falt]) ? null : rader;
    }

    if (Object.values(andring).every((v) => v === null)) await aterstallK1Konto(supabase, original.konto);
    else await sparaK1Andring(supabase, original.konto, andring);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fel('Skicka filen som formulär', 400);
  }
  const fil = form.get('fil');
  if (!(fil instanceof File)) return fel('Ingen fil', 400);
  if (!/\.(xlsx|json)$/i.test(fil.name)) return fel('Filen ska vara .xlsx eller .json', 400);
  let konton;
  try {
    konton = lasKontoFil(Buffer.from(await fil.arrayBuffer()), fil.name);
  } catch (err) {
    return fel(err, 400);
  }
  if (!konton.length) return fel('Hittade inga konton i filen', 400);
  try {
    const plan = await importeraKonton(getSupabase(), konton, form.get('spara') === '1');
    return NextResponse.json({ ...plan, iFilen: konton.length });
  } catch (err) {
    return fel(err);
  }
}

export async function DELETE(request: NextRequest) {
  const konto = (request.nextUrl.searchParams.get('konto') ?? '').trim();
  try {
    const supabase = getSupabase();
    if (!originalKonto(konto) && !(await hamtaK1Andringar(supabase)).has(konto)) {
      return fel(`${konto} finns inte bland K1-kontona`, 404);
    }
    await aterstallK1Konto(supabase, konto);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}
