import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRINCIPER_INLEDNING } from '@/lib/kontering/principer';
import { regelmaster } from '@/lib/kontering/regelverk';
import { hamtaRegelmaster } from '@/lib/kontering/regelmaster';
import { hamtaPrinciper, sparaPrinciper, tolkaVariant } from '@/lib/kontering/k1-andringar';

/**
 * De generella reglerna i en kontoplan (variant lopande eller bokslut), för fliken Regler:
 *   - byråns principer — gäller alltid, alla kunder. Var kontoplan har sina.
 *   - regelmastern: gränsvärdena och reglerna, var kontoplan har sina (@/lib/kontering/regelmaster)
 *   - regler och kontext som byrån skrivit i flödesschemat för alla kunder (bara löpande)
 *
 *   GET ?variant=      allt ovan
 *   PUT { variant, principer: string[] }  sparar principerna
 *
 * Kundspecifika regler (@/lib/transaktioner/kundregler) är inte med: de väljs
 * per transaktion och hör inte till de generella.
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
  console.error('[admin/regler]', message);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const variant = tolkaVariant(request.nextUrl.searchParams.get('variant'));
  if (!variant) return fel('variant ska vara lopande eller bokslut', 400);
  try {
    const supabase = getSupabase();
    const [principer, rm] = await Promise.all([hamtaPrinciper(supabase, variant), hamtaRegelmaster(supabase, variant)]);
    let flodesschema: unknown[] = [];
    if (variant === 'lopande') {
      const { data, error } = await supabase
        .from('flodes_instruktioner')
        .select('id, typ, steg, namn, galler, text, created_at')
        .eq('omfang', 'alla')
        .order('created_at');
      if (error) throw new Error(error.message);
      flodesschema = data ?? [];
    }
    return NextResponse.json({
      principer: { inledning: PRINCIPER_INLEDNING, lista: principer.lista, updatedAt: principer.updatedAt },
      regelmaster: { kalla: rm.kalla, updatedAt: rm.updatedAt, antalParametrar: rm.parametrar.length, regler: regelmaster(rm) },
      flodesschema,
    });
  } catch (err) {
    return fel(err);
  }
}

export async function PUT(request: NextRequest) {
  let body: { variant?: string; principer?: unknown };
  try {
    body = await request.json();
  } catch {
    return fel('Ogiltig JSON', 400);
  }
  const variant = tolkaVariant(body.variant);
  if (!variant) return fel('variant ska vara lopande eller bokslut', 400);
  if (!Array.isArray(body.principer)) return fel('principer ska vara en lista', 400);
  const lista = body.principer.map((p) => String(p ?? '').trim()).filter(Boolean);
  try {
    await sparaPrinciper(getSupabase(), variant, lista);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fel(err);
  }
}
