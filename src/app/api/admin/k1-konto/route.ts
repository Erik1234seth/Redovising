import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  aterstallK1Konto, hamtaK1Andringar, kontoText, loggaHistorik, sparaK1Andring, synligaKonton, taBortK1Konto, tolkaVariant,
  type SparadAndring, type Variant,
} from '@/lib/kontering/k1-andringar';
import { helText, k1Fil, medAndring, originalKonto, skillnadMotOriginal, type K1Andring } from '@/lib/kontering/regelverk';
import { k1Xlsx } from '@/lib/kontering/k1-xlsx';
import { importeraKonton, lasKontoFil } from '@/lib/kontering/k1-import';
import { hamtaRegelmaster } from '@/lib/kontering/regelmaster';

/**
 * Byråns två kontoplaner, löpande bokföring och bokslut (@/lib/kontering/k1-andringar).
 * Alla anrop tar `variant` (lopande eller bokslut) — i adressen, eller i kroppen för PUT och POST.
 *
 *   GET ?konto=5800    originalet, byråns ändring och texten som gäller
 *   GET                alla konton som syns, för kontoplanen
 *   GET ?fil=json|xlsx hela kontobeskrivningarna med ändringar och nya konton
 *   GET ?historik=1    allt som ändrats, nyast först
 *   PUT                spara kontots text (hela texten sparas i kontoplanen).
 *                      `ny: true` lägger till ett konto som inte finns i k1.json.
 *                      `tillbaka: true` tar tillbaka ett borttaget konto.
 *   DELETE ?konto=     återställ kontot till utgångsläget (k1.json), eller ta bort ett tillagt konto ur vyn
 *   POST               importera en xlsx- eller JSON-fil (formulärfältet fil) med samma struktur som
 *                      nedladdningen. Konton som saknas i filen tas bort ur vyn. Utan spara=1 visas
 *                      bara vad som skulle ändras.
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
const FEL_VARIANT = 'variant ska vara lopande eller bokslut';

function andringar(sparade: Map<string, SparadAndring>) {
  return new Map([...sparade].map(([k, v]) => [k, v.andring]));
}
function borttagna(sparade: Map<string, SparadAndring>) {
  return new Set([...sparade].filter(([, v]) => v.borttagenAt).map(([k]) => k));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const variant = tolkaVariant(sp.get('variant'));
  if (!variant) return fel(FEL_VARIANT, 400);
  try {
    const supabase = getSupabase();

    if (sp.get('historik')) {
      const { data, error } = await supabase.from('kontoplan_historik')
        .select('id, konto, handling, data, kalla, created_at')
        .eq('variant', variant).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(2000);
      if (error) throw new Error(error.message);
      const sparade = await hamtaK1Andringar(supabase, variant);
      return NextResponse.json({ historik: data ?? [], borttagna: [...borttagna(sparade)] });
    }

    const sparade = await hamtaK1Andringar(supabase, variant);

    const fil = sp.get('fil');
    if (fil) {
      const data = k1Fil(andringar(sparade), borttagna(sparade), await hamtaRegelmaster(supabase, variant));
      const datum = new Date().toLocaleDateString('sv-SE');
      const namn = `k1-${variant === 'bokslut' ? 'bokslut' : 'lopande'}_${datum}`;
      if (fil === 'json') {
        return new NextResponse(JSON.stringify(data, null, 1) + '\n', {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${namn}.json"`,
          },
        });
      }
      if (fil === 'xlsx') {
        return new NextResponse(new Uint8Array(k1Xlsx(data)), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${namn}.xlsx"`,
          },
        });
      }
      return fel('fil ska vara json eller xlsx', 400);
    }

    const konto = sp.get('konto');
    if (konto === null) {
      const konton = synligaKonton(sparade).map((nr) => {
        const s = sparade.get(nr);
        const k = medAndring(nr, s?.andring);
        return {
          konto: nr,
          namn: k.namn,
          beskrivning: k.beskrivning,
          status: !originalKonto(nr) ? 'ny' : Object.keys(skillnadMotOriginal(nr, s?.andring)).length ? 'andrad' : 'original',
          andradAt: s?.updatedAt ?? null,
        };
      });
      return NextResponse.json({ konton });
    }

    const original = originalKonto(konto);
    const sparad = sparade.get(konto.trim()) ?? null;
    if (!original && !sparad) return fel(`${konto} finns inte i kontoplanen`, 404);
    return NextResponse.json({
      original,
      // Det som skiljer från utgångsläget — kontoplanen sparar hela texten
      andring: sparad ? skillnadMotOriginal(konto.trim(), sparad.andring) : null,
      andradAt: sparad?.updatedAt ?? null,
      borttagenAt: sparad?.borttagenAt ?? null,
      aktuell: medAndring(konto.trim(), sparad?.andring),
    });
  } catch (err) {
    return fel(err);
  }
}

export async function PUT(request: NextRequest) {
  let body: { konto?: string; ny?: boolean; tillbaka?: boolean; variant?: string } & K1Andring;
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
  }
  const variant = tolkaVariant(body.variant);
  if (!variant) return fel(FEL_VARIANT, 400);
  const konto = String(body.konto ?? '').trim();
  const original = originalKonto(konto);
  const supabase = getSupabase();

  try {
    const sparade = await hamtaK1Andringar(supabase, variant);
    const sparad = sparade.get(konto);

    if (body.tillbaka) {
      if (!sparad?.borttagenAt) return fel(`${konto} är inte borttaget`, 400);
      await sparaK1Andring(supabase, variant, konto, {}, sparad.andring);
      await loggaHistorik(supabase, [{ variant, konto, handling: 'tillbaka', data: kontoText(konto, sparad.andring) }]);
      return NextResponse.json({ ok: true });
    }

    if (!original) {
      // Ett konto byrån lagt till: hela texten sparas, det finns inget original att jämföra med
      if (!sparad && !body.ny) return fel(`${konto} finns inte i kontoplanen`, 404);
      if (sparad?.borttagenAt && body.ny) return fel(`${konto} är borttaget — ta tillbaka det under Historik`, 409);
      if (sparad && body.ny) return fel(`${konto} finns redan`, 409);
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
      await sparaK1Andring(supabase, variant, konto, rad);
      await loggaHistorik(supabase, [{ variant, konto, handling: body.ny ? 'tillagd' : 'sparad', data: kontoText(konto, rad as K1Andring) }]);
      return NextResponse.json({ ok: true });
    }

    if (body.ny) return fel(`${konto} ${original.namn} finns redan${sparad?.borttagenAt ? ' men är borttaget — ta tillbaka det under Historik' : ''}`, 409);

    // Hela texten sparas i kontoplanen: det som skickats ovanpå det som gällde
    const andring: K1Andring = {};
    for (const falt of ['namn', 'beskrivning'] as const) {
      const v = typeof body[falt] === 'string' ? body[falt].trim() : undefined;
      if (v === undefined) continue;
      if (!v) return fel(falt === 'namn' ? 'Kontot behöver ett namn' : 'Beskrivningen kan inte vara tom', 400);
      andring[falt] = v;
    }
    for (const falt of LISTOR) {
      const v = body[falt];
      if (v === undefined) continue;
      if (!Array.isArray(v)) return fel(`${falt} ska vara en lista`, 400);
      andring[falt] = v.map((x) => String(x ?? '').trim()).filter(Boolean);
    }

    await sparaK1Andring(supabase, variant, original.konto, andring, sparad?.andring);
    await loggaHistorik(supabase, [{ variant, konto: original.konto, handling: 'sparad', data: kontoText(original.konto, helText(original.konto, { ...sparad?.andring, ...andring })) }]);
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
  const variant = tolkaVariant(form.get('variant'));
  if (!variant) return fel(FEL_VARIANT, 400);
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
    const plan = await importeraKonton(getSupabase(), variant, konton, form.get('spara') === '1', fil.name);
    return NextResponse.json({ ...plan, iFilen: konton.length });
  } catch (err) {
    return fel(err);
  }
}

export async function DELETE(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const variant: Variant | null = tolkaVariant(sp.get('variant'));
  if (!variant) return fel(FEL_VARIANT, 400);
  const konto = (sp.get('konto') ?? '').trim();
  try {
    const supabase = getSupabase();
    const sparad = (await hamtaK1Andringar(supabase, variant)).get(konto);
    if (!originalKonto(konto) && !sparad) return fel(`${konto} finns inte i kontoplanen`, 404);
    if (originalKonto(konto)) {
      await aterstallK1Konto(supabase, variant, konto);
      await loggaHistorik(supabase, [{ variant, konto, handling: 'aterstalld', data: kontoText(konto, undefined) }]);
    } else {
      // Ett tillagt konto tas bort ur vyn — texten ligger kvar i historiken
      await taBortK1Konto(supabase, variant, konto);
      await loggaHistorik(supabase, [{ variant, konto, handling: 'borttagen', data: kontoText(konto, sparad?.andring) }]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}
