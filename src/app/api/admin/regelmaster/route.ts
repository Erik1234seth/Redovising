import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tolkaVariant } from '@/lib/kontering/k1-andringar';
import { hamtaAiRegler, importeraAiRegler, lasAiReglerFil } from '@/lib/kontering/regelmaster';
import { aiReglerXlsx } from '@/lib/kontering/k1-xlsx';

/**
 * Regelmasterns AI-regler i en kontoplan (@/lib/kontering/regelmaster). Gränsvärdena
 * är gemensamma och har en egen route, /api/admin/gransvarden.
 *
 *   GET ?variant=&fil=json|xlsx  ladda ner reglerna
 *   POST                         importera en fil (formulärfälten fil och variant). Ersätter alla
 *                                regler — det som saknas i filen slutar gälla. Utan spara=1 visas
 *                                bara vad som skulle ändras.
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
    const ai = await hamtaAiRegler(getSupabase(), variant);
    const namn = `Regelmaster_${variant === 'lopande' ? 'Lopande' : 'Bokslut'}_${new Date().toLocaleDateString('sv-SE')}`;
    if (fil === 'json') {
      return new NextResponse(JSON.stringify({ kalla: ai.kalla, regler: ai.regler }, null, 1) + '\n', {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${namn}.json"`,
        },
      });
    }
    return new NextResponse(new Uint8Array(aiReglerXlsx(ai.regler, `AI-regler ${variant === 'lopande' ? 'löpande' : 'bokslut'}`)), {
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
  let regler;
  try {
    regler = lasAiReglerFil(Buffer.from(await fil.arrayBuffer()), fil.name);
  } catch (err) {
    return fel(err, 400);
  }
  if (!regler.length) return fel('Hittade inga regler i filen', 400);
  try {
    const plan = await importeraAiRegler(getSupabase(), variant, regler, form.get('spara') === '1', fil.name);
    return NextResponse.json({ ...plan, iFilen: regler.length });
  } catch (err) {
    return fel(err);
  }
}
