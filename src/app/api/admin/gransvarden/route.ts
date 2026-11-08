import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hamtaGransvarden, importeraGransvarden, lasGransvardenFil } from '@/lib/kontering/regelmaster';
import { gransvardenXlsx } from '@/lib/kontering/k1-xlsx';

/**
 * Gränsvärdena (regelmasterns parametrar), gemensamma för löpande bokföring och
 * bokslut (@/lib/kontering/regelmaster).
 *
 *   GET ?fil=json|xlsx  ladda ner gränsvärdena
 *   POST                importera en fil (formulärfältet fil). Ersätter alla gränsvärden —
 *                       det som saknas i filen slutar gälla. Utan spara=1 visas bara vad som
 *                       skulle ändras.
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
  console.error('[admin/gransvarden]', message);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const fil = request.nextUrl.searchParams.get('fil');
  if (fil !== 'json' && fil !== 'xlsx') return fel('fil ska vara json eller xlsx', 400);
  try {
    const gv = await hamtaGransvarden(getSupabase());
    const namn = `Gransvarden_gemensamma_${new Date().toLocaleDateString('sv-SE')}`;
    if (fil === 'json') {
      return new NextResponse(JSON.stringify({ kalla: gv.kalla, parametrar: gv.parametrar }, null, 1) + '\n', {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${namn}.json"`,
        },
      });
    }
    return new NextResponse(new Uint8Array(gransvardenXlsx(gv.parametrar)), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${namn}.xlsx"`,
      },
    });
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
  let parametrar;
  try {
    parametrar = lasGransvardenFil(Buffer.from(await fil.arrayBuffer()), fil.name);
  } catch (err) {
    return fel(err, 400);
  }
  if (!parametrar.length) return fel('Hittade inga gränsvärden i filen', 400);
  try {
    const plan = await importeraGransvarden(getSupabase(), parametrar, form.get('spara') === '1', fil.name);
    return NextResponse.json({ ...plan, iFilen: parametrar.length });
  } catch (err) {
    return fel(err);
  }
}
