import { tokenCipher } from '../token-crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * OAuth mot Zettle (authorization code grant, partner-hosted app).
 *
 * Kunden klickar "Koppla Zettle", godkänner hos Zettle och hoppar tillbaka till
 * /api/zettle/callback. Vi får en access token som gäller i två timmar och en
 * refresh token som gäller i 180 dagar. Varje förnyelse ger en NY refresh token
 * och den gamla slutar gälla — därför sparas den nya direkt, varje gång. Den
 * dagliga synken håller kopplingen vid liv; står den still i ett halvår måste
 * kunden koppla om.
 *
 * Tokens krypteras med ZETTLE_TOKEN_KEY innan de sparas. Läcker tabellen ska
 * den inte ge åtkomst till kundernas kassor.
 *
 * Appen skapas på developer.zettle.com → "Public API credentials". Där anges
 * redirect-URI:n, och den måste stämma exakt med zettleRedirectUri().
 */

const OAUTH_BASE = 'https://oauth.zettle.com';
export const ZETTLE_SCOPES = ['READ:PURCHASE', 'READ:FINANCE'];

/** Förnya lite innan tokenen faktiskt går ut, så ett anrop inte hinner få 401. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export class ZettleKopplingUtgangen extends Error {}

function credentials() {
  const clientId = process.env.ZETTLE_CLIENT_ID;
  const clientSecret = process.env.ZETTLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('ZETTLE_CLIENT_ID eller ZETTLE_CLIENT_SECRET saknas');
  return { clientId, clientSecret };
}

/**
 * Appens domän, inte huvuddomänen — callbacken skickar vidare till
 * integrationssidan och kunden ska landa i appen. Lokalt sätts
 * ZETTLE_REDIRECT_URI till localhost-adressen (och läggs till i Zettle-appen).
 */
export function zettleRedirectUri(): string {
  return process.env.ZETTLE_REDIRECT_URI || 'https://app.enklabokslut.se/api/zettle/callback';
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: credentials().clientId,
    scope: ZETTLE_SCOPES.join(' '),
    redirect_uri: zettleRedirectUri(),
    state,
  });
  return `${OAUTH_BASE}/authorize?${params}`;
}

export interface ZettleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

async function tokenRequest(body: Record<string, string>): Promise<ZettleTokens> {
  const { clientId, clientSecret } = credentials();
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, client_id: clientId, client_secret: clientSecret }),
  });
  const text = await res.text();
  if (!res.ok) {
    // invalid_grant = refresh token återkallad eller för gammal, bara omkoppling hjälper
    if (res.status === 400 && /invalid_grant/i.test(text)) throw new ZettleKopplingUtgangen(text);
    throw new Error(`Zettle token ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export function exchangeCode(code: string): Promise<ZettleTokens> {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: zettleRedirectUri() });
}

export async function fetchOrganizationUuid(accessToken: string): Promise<string> {
  const res = await fetch(`${OAUTH_BASE}/users/self`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Zettle users/self ${res.status}`);
  const data = (await res.json()) as { organizationUuid: string };
  return data.organizationUuid;
}

/** Tar bort appens åtkomst hos Zettle. Misslyckas det tas kopplingen ändå bort hos oss. */
export async function disconnect(accessToken: string): Promise<void> {
  await fetch(`${OAUTH_BASE}/application-connections/self`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

export const { encrypt, decrypt } = tokenCipher('ZETTLE_TOKEN_KEY');

// --- Kopplingen i databasen -------------------------------------------------

export async function sparaKoppling(
  supabase: SupabaseClient,
  userId: string,
  organizationUuid: string,
  tokens: ZettleTokens,
): Promise<void> {
  const { error } = await supabase.from('zettle_kopplingar').upsert({
    user_id: userId,
    organization_uuid: organizationUuid,
    refresh_token: encrypt(tokens.refreshToken),
    access_token: encrypt(tokens.accessToken),
    access_token_expires_at: tokens.expiresAt.toISOString(),
    status: 'aktiv',
    kopplad_at: new Date().toISOString(),
    senaste_fel: null,
  });
  if (error) throw new Error(`Kunde inte spara Zettle-kopplingen: ${error.message}`);
}

/**
 * En giltig access token för kunden, förnyad vid behov. Är refresh-tokenen död
 * markeras kopplingen som utgången så att kunden ser att den måste kopplas om.
 */
export async function accessTokenFor(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: row, error } = await supabase
    .from('zettle_kopplingar')
    .select('refresh_token, access_token, access_token_expires_at, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa Zettle-kopplingen: ${error.message}`);
  if (!row) throw new Error('Kunden har ingen Zettle-koppling');
  if (row.status === 'utgangen') throw new ZettleKopplingUtgangen('Kopplingen har gått ut');

  const expires = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (row.access_token && expires - EXPIRY_MARGIN_MS > Date.now()) return decrypt(row.access_token);

  let tokens: ZettleTokens;
  try {
    tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(row.refresh_token) });
  } catch (err) {
    if (err instanceof ZettleKopplingUtgangen) {
      await supabase.from('zettle_kopplingar').update({
        status: 'utgangen',
        senaste_fel: 'Kopplingen till Zettle har gått ut. Koppla om kontot.',
      }).eq('user_id', userId);
    }
    throw err;
  }

  const { error: saveError } = await supabase.from('zettle_kopplingar').update({
    refresh_token: encrypt(tokens.refreshToken),
    access_token: encrypt(tokens.accessToken),
    access_token_expires_at: tokens.expiresAt.toISOString(),
  }).eq('user_id', userId);
  // Den gamla refresh-tokenen är redan förbrukad — sparas inte den nya tappar vi kopplingen
  if (saveError) throw new Error(`Kunde inte spara förnyad Zettle-token: ${saveError.message}`);

  return tokens.accessToken;
}
