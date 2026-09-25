import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { exchangeCode, fetchOrganizationUuid, sparaKoppling } from '@/lib/zettle/oauth';

/**
 * Hit skickar Zettle tillbaka kunden efter inloggningen, med en engångskod och
 * vår state. Staten säger vilket konto kopplingen hör till — kunden är inte
 * nödvändigtvis inloggad i samma flik, och koden i sig säger ingenting om det.
 */

const STATE_MAX_AGE_MS = 30 * 60 * 1000;

function tillbaka(request: Request, resultat: string) {
  // På app-domänen skriver middleware om /integrationer till /app/integrationer
  const url = new URL(request.url);
  const path = url.hostname.startsWith('app.') ? '/integrationer' : '/app/integrationer';
  return NextResponse.redirect(new URL(`${path}?zettle=${resultat}`, url));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');

  // Kunden tryckte avbryt hos Zettle
  if (params.get('error') || !code || !state) return tillbaka(request, 'avbruten');

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from('zettle_oauth_states')
    .delete()
    .eq('state', state)
    .select('user_id, created_at')
    .maybeSingle();
  if (!row || Date.now() - new Date(row.created_at).getTime() > STATE_MAX_AGE_MS) {
    return tillbaka(request, 'fel');
  }

  try {
    const tokens = await exchangeCode(code);
    const orgUuid = await fetchOrganizationUuid(tokens.accessToken);
    await sparaKoppling(supabase, row.user_id, orgUuid, tokens);
  } catch (err) {
    console.error('[zettle/callback]', err);
    return tillbaka(request, 'fel');
  }

  // Första hämtningen startar sidan, så att kunden ser att något händer
  return tillbaka(request, 'kopplad');
}
