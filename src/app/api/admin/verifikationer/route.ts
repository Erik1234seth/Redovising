import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Raderar verifikationer som markerats i verifikationslistan.
 *
 * DELETE { ids } → { raderade }
 *
 * Konteringsraderna försvinner med verifikationen (on delete cascade). En
 * verifikation som AI:n eller Erik bokfört från en transaktion lämnar
 * transaktionen och konteringsförslagen kvar — den blir obokförd igen och
 * kan bokföras om. Det går inte att ångra en radering.
 */

const CHUNK = 200;

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ids: unknown = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string' && x)) {
    return NextResponse.json({ error: 'Markera minst en verifikation' }, { status: 400 });
  }
  const supabase = createServerClient();
  let raderade = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.from('verifikationer').delete().in('id', ids.slice(i, i + CHUNK)).select('id');
    if (error) {
      return NextResponse.json({ error: `Kunde inte radera verifikationerna: ${error.message}`, raderade }, { status: 500 });
    }
    raderade += data?.length ?? 0;
  }
  return NextResponse.json({ raderade });
}
