import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tolkaVariant } from '@/lib/kontering/k1-andringar';
import { hamtaRegelmaster, importeraRegelmaster, lasRegelmasterFil } from '@/lib/kontering/regelmaster';
import { regelmasterXlsx } from '@/lib/kontering/k1-xlsx';

/**
 * Regelmasterns gränsvärden och regler i en kontoplan (@/lib/kontering/regelmaster).
 *
 *   GET ?variant=&fil=json|xlsx  ladda ner hela regelmastern
 *   POST                         importera en fil (formulärfälten fil och variant). Ersätter allt —
 *                                det som saknas i filen slutar gälla. Utan spara=1 visas bara vad
 *                                som skulle ändras.
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
  console.error('[admin/regelmaster]', message);
  return NextResponse.json({ error: message }, { status });
}

const FEL_VARIANT = 'variant ska vara lopande eller bokslut';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const variant = tolkaVariant(sp.get('variant'));
  if (!variant) return fel(FEL_VARIANT, 400);
  const fil = sp.get('fil');
  if (fil !== 'json' && fil !== 'xlsx') return fel('fil ska vara json eller xlsx', 400);
  try {
    const rm = await hamtaRegelmaster(getSupabase(), variant);
    const namn = `Regelmaster_${variant}_${new Date().toLocaleDateString('sv-SE')}`;
    if (fil === 'json') {
      return new NextResponse(JSON.stringify({ kalla: rm.kalla, parametrar: rm.parametrar, regler: rm.regler }, null, 1) + '\n', {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${namn}.json"`,
        },
      });
    }
    return new NextResponse(new Uint8Array(regelmasterXlsx(rm)), {
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
  const variant = tolkaVariant(form.get('variant'));
  if (!variant) return fel(FEL_VARIANT, 400);
  const fil = form.get('fil');
  if (!(fil instanceof File)) return fel('Ingen fil', 400);
  if (!/\.(xlsx|json)$/i.test(fil.name)) return fel('Filen ska vara .xlsx eller .json', 400);
  let innehall;
  try {
    innehall = lasRegelmasterFil(Buffer.from(await fil.arrayBuffer()), fil.name);
  } catch (err) {
    return fel(err, 400);
  }
  if (!innehall.regler.length) return fel('Hittade inga regler i filen', 400);
  try {
    const plan = await importeraRegelmaster(getSupabase(), variant, innehall, form.get('spara') === '1', fil.name);
    return NextResponse.json({ ...plan, iFilen: { regler: innehall.regler.length, parametrar: innehall.parametrar.length } });
  } catch (err) {
    return fel(err);
  }
}
