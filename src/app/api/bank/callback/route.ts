import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { skapaSession } from '@/lib/bank/enablebanking';
import { sparaSession } from '@/lib/bank/sync';

/**
 * Hit skickar Enable Banking tillbaka kunden efter bankinloggningen, med en
 * engångskod och vår state. Staten säger vilket konto och vilken bank det gäller.
 */

const STATE_MAX_AGE_MS = 30 * 60 * 1000;

function tillbaka(request: Request, resultat: string, sida: string | null = null) {
  // Sidan kunden startade kopplingen från: startsidan eller Integrationer.
  // På app-domänen skriver middleware om /integrationer till /app/integrationer.
  const url = new URL(request.url);
  const mal = sida === '/' ? '' : '/integrationer';
  const path = url.hostname.startsWith('app.') ? mal || '/' : `/app${mal}`;
  return NextResponse.redirect(new URL(`${path}?bank=${resultat}`, url));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');

  if (!state) return tillbaka(request, 'avbruten');

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from('bank_oauth_states')
    .delete()
    .eq('state', state)
    .select('user_id, aspsp_name, aspsp_country, created_at, tillbaka')
    .maybeSingle();

  // Kunden avbröt hos banken
  if (params.get('error') || !code) return tillbaka(request, 'avbruten', row?.tillbaka);

  if (!row || Date.now() - new Date(row.created_at).getTime() > STATE_MAX_AGE_MS) {
    return tillbaka(request, 'fel', row?.tillbaka);
  }

  try {
    const session = await skapaSession(code);
    await sparaSession(supabase, row.user_id, { name: row.aspsp_name, country: row.aspsp_country }, session);
  } catch (err) {
    console.error('[bank/callback]', err);
    return tillbaka(request, 'fel', row.tillbaka);
  }

  // Första hämtningen startar sidan, så att kunden ser att något händer
  return tillbaka(request, 'kopplad', row.tillbaka);
}
