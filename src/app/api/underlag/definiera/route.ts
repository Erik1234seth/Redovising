import { NextResponse, after } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { userFromRequest } from '@/lib/auth-user';
import { sorteringVidUppladdning } from '@/lib/underlag/sortering';
import { arZip } from '@/lib/underlag/filtyp';
import { packaUppZip } from '@/lib/underlag/zip';

/**
 * Appen laddar upp underlag direkt till lagringen, utan att gå via servern.
 * Efteråt anropar den hit, och kundens nya underlag sorteras efter reglerna
 * (zip-arkiv, filtyper som inte går att läsa) och zip-arkiven packas upp.
 * Resten läser Flöde — ingen AI körs när filen kommer in (sedan 2026-11-09).
 *
 * Bara kundens egna underlag från det senaste dygnet som inte sorterats än.
 * Namnet på vägen är kvar för att appen anropar den.
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
    .is('sortering_at', null)
    .gte('created_at', dygn)
    .order('created_at')
    .limit(MAX_PER_ANROP);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rader = data ?? [];
  // Svaret går direkt — kunden ska inte vänta på uppackningen
  after(async () => {
    for (const r of rader) {
      const regel = sorteringVidUppladdning(r.file_name, r.mime_type, r.sender_email);
      if (!Object.keys(regel).length) continue;
      await supabase.from('bokforing_underlag').update(regel).eq('id', r.id);
      if (arZip(r.file_name, r.mime_type)) await packaUppZip(supabase, r);
    }
  });
  return NextResponse.json({ ok: true, antal: rader.length });
}
