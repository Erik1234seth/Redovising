import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth-user';
import { createServerClient } from '@/lib/supabase-server';
import { matchaBetalningar } from '@/lib/betalningar/kor';

/**
 * POST: matchar kundens fakturor mot bankraderna och svarar med kopplingarna.
 * Fakturalistan anropar den när den öppnas, så en ny faktura kopplas direkt
 * mot det som redan hämtats från banken.
 */
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Inte inloggad' }, { status: 401 });

  const supabase = createServerClient();
  try {
    await matchaBetalningar(supabase, user.id);
  } catch (err) {
    console.error('[fakturor/betalningar]', err);
    return NextResponse.json({ error: 'Kunde inte matcha betalningarna' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('betalningskopplingar')
    .select('faktura_id, konto_hash, bank_transaktion_id, bank_datum, bank_belopp, belopp, del, typ, grund, sakerhet, avvikelse, kommentar, status')
    .eq('user_id', user.id).not('faktura_id', 'is', null).neq('status', 'avvisad')
    .order('bank_datum');
  if (error) return NextResponse.json({ error: 'Kunde inte läsa betalningarna' }, { status: 500 });
  return NextResponse.json({ kopplingar: data ?? [] });
}
