import { NextResponse, after } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { userFromRequest } from '@/lib/auth-user';
import { definieraTyst } from '@/lib/underlag/definiera';
import { arZip } from '@/lib/underlag/filtyp';
import { packaUppZip } from '@/lib/underlag/zip';

/**
 * Appen laddar upp underlag direkt till lagringen, utan att gå via servern.
 * Efteråt anropar den hit, och kundens nya underlag definieras av AI:n.
 *
 * Bara kundens egna underlag från det senaste dygnet som inte definierats än —
 * ett anrop kan inte få AI:n att köra om gamla filer eller någon annans.
 */

export const maxDuration = 300;

const MAX_PER_ANROP = 20;

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });

  const supabase = createServerClient();
  const dygn = new Date(Date.now() - 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('bokforing_underlag')
    .select('id, user_id, sender_email, source, gmail_message_id, file_path, file_name, mime_type')
    .eq('user_id', user.id)
    .is('definierad_at', null)
    .gte('created_at', dygn)
    .order('created_at')
    .limit(MAX_PER_ANROP);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rader = data ?? [];
  const ids = rader.map((r) => r.id);
  // Svaret går direkt — kunden ska inte vänta på AI:n. Zip-arkiv packas upp
  // först, och filerna i dem definieras som vilka underlag som helst.
  after(async () => {
    for (const r of rader) {
      if (arZip(r.file_name, r.mime_type)) ids.push(...await packaUppZip(supabase, r));
    }
    for (const id of ids) await definieraTyst(supabase, id);
  });
  return NextResponse.json({ ok: true, antal: ids.length });
}
