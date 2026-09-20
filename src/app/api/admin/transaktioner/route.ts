import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Raderar utlästa transaktioner.
 *
 * AI:n tar ibland med en rad som inte är en transaktion — en summarad, en
 * dubblett från ett överlappande kontoutdrag. Då ska den gå att stryka utan
 * att hela filen måste läsas om.
 *
 * Antalet på underlaget räknas om efteråt, annars skulle chippet i panelen
 * påstå 65 rader när det finns 62.
 */

/**
 * Id:na hamnar i URL:en hos PostgREST, så en markering av tusen rader blir en
 * URL på fyrtio kilobyte och avvisas med "Bad Request". Därför portionsvis.
 */
const CHUNK = 100;

function portioner<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json().catch(() => ({}));
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Inga transaktioner angivna' }, { status: 400 });
    }
    if (ids.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Ogiltiga id:n' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Vilka filer som berörs behöver vi veta innan raderna är borta
    const berorda: string[] = [];
    for (const del of portioner(ids as string[])) {
      const { data, error: readError } = await supabase
        .from('transaktioner')
        .select('underlag_id')
        .in('id', del);
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
      for (const r of data ?? []) berorda.push(r.underlag_id as string);
    }

    for (const del of portioner(ids as string[])) {
      const { error } = await supabase.from('transaktioner').delete().in('id', del);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const underlagId of new Set(berorda)) {
      const { count } = await supabase
        .from('transaktioner')
        .select('id', { count: 'exact', head: true })
        .eq('underlag_id', underlagId);
      await supabase
        .from('bokforing_underlag')
        .update({ transaktioner_antal: count ?? 0 })
        .eq('id', underlagId);
    }

    return NextResponse.json({ ok: true, raderade: berorda.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internt fel';
    console.error('[admin/transaktioner]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
