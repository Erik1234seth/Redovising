import { createHmac, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tokenCipher } from '../token-crypto';

/**
 * Shopify-appen: installation, signaturer och tokens.
 *
 * Butiken kan installera appen på två sätt:
 *  - från Shopify (App Store eller installationslänk). Shopify sköter
 *    godkännandet av behörigheterna och öppnar sedan appsidan (/shopify) inne i
 *    Shopify-admin. Sidan skickar en session token och vi byter den mot en
 *    access token (token exchange).
 *  - från vår integrationssida, där kunden skriver in sin butiksadress och
 *    skickas till Shopifys godkännande (authorization code grant).
 *
 * En butik som installerats från Shopify vet vi ännu inte vem den tillhör.
 * Kunden kopplar den till sitt konto med en engångskod från appsidan.
 *
 * Appen skapas i Shopifys Dev Dashboard. Client ID och client secret läggs i
 * SHOPIFY_CLIENT_ID och SHOPIFY_CLIENT_SECRET, och tokens krypteras med
 * SHOPIFY_TOKEN_KEY.
 */

export const API_VERSION = '2026-07';
// read_all_orders (ordrar äldre än 60 dagar) läggs till här och i Dev Dashboard
// när Shopify har godkänt ansökan om den
export const SHOPIFY_SCOPES = [
  'read_orders',
  'read_shopify_payments_accounts',
  'read_shopify_payments_payouts',
];

export class ShopifyEjInstallerad extends Error {}

const { encrypt, decrypt } = tokenCipher('SHOPIFY_TOKEN_KEY');

export function credentials() {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('SHOPIFY_CLIENT_ID eller SHOPIFY_CLIENT_SECRET saknas');
  return { clientId, clientSecret };
}

/** "Min Butik.myshopify.com", "https://min-butik.myshopify.com/" eller bara "min-butik". */
export function normaliseraShop(input: string): string | null {
  let shop = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!shop.includes('.')) shop = `${shop}.myshopify.com`;
  return isValidShop(shop) ? shop : null;
}

/** Bara riktiga myshopify-domäner — annars kunde vem som helst få oss att skicka hemligheter till sin egen server. */
export function isValidShop(shop: string | null | undefined): shop is string {
  return !!shop && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

export function shopifyRedirectUri(): string {
  return process.env.SHOPIFY_REDIRECT_URI || 'https://app.enklabokslut.se/api/shopify/callback';
}

export function authorizeUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: credentials().clientId,
    scope: SHOPIFY_SCOPES.join(','),
    redirect_uri: shopifyRedirectUri(),
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

// --- Signaturer -------------------------------------------------------------

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Frågesträngen Shopify skickar vid installation och callback är signerad med vår hemlighet. */
export function verifyQueryHmac(params: URLSearchParams): boolean {
  const hmac = params.get('hmac');
  if (!hmac) return false;
  const message = [...params.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const digest = createHmac('sha256', credentials().clientSecret).update(message).digest('hex');
  return safeEqual(digest, hmac);
}

/** Webhooks signeras över den råa kroppen, base64. */
export function verifyWebhookHmac(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const digest = createHmac('sha256', credentials().clientSecret).update(rawBody, 'utf8').digest('base64');
  return safeEqual(digest, header);
}

/**
 * Session token från App Bridge (JWT, HS256 med vår hemlighet). Säger vilken
 * butik appsidan i Shopify-admin visas för. Returnerar butikens domän.
 */
export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;

  const { clientId, clientSecret } = credentials();
  const expected = createHmac('sha256', clientSecret).update(`${header}.${payload}`).digest('base64url');
  if (!safeEqual(expected, signature)) return null;

  let claims: { aud?: string; exp?: number; nbf?: number; dest?: string };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  // Några sekunders marginal för klockor som går olika
  if (claims.aud !== clientId || !claims.exp || claims.exp < now - 5 || (claims.nbf && claims.nbf > now + 5)) return null;

  try {
    const shop = new URL(claims.dest ?? '').hostname;
    return isValidShop(shop) ? shop : null;
  } catch {
    return null;
  }
}

export function bearer(request: Request): string | null {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
}

// --- Tokens -----------------------------------------------------------------

interface TokenSvar {
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
}

async function tokenRequest(shop: string, body: Record<string, string>): Promise<TokenSvar> {
  const { clientId, clientSecret } = credentials();
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Shopify token ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenSvar;
}

export function exchangeCode(shop: string, code: string) {
  return tokenRequest(shop, { code });
}

/** Byter appsidans session token mot en offline-token som synken kan använda. */
export function exchangeSessionToken(shop: string, sessionToken: string) {
  return tokenRequest(shop, {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: sessionToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
  });
}

/**
 * Sparar butikens token. userId sätts bara när vi vet vem butiken tillhör —
 * en installation från Shopify lämnar en befintlig koppling orörd.
 */
export async function sparaInstallation(supabase: SupabaseClient, shop: string, svar: TokenSvar, userId?: string) {
  const row: Record<string, unknown> = {
    shop,
    access_token: encrypt(svar.access_token),
    refresh_token: svar.refresh_token ? encrypt(svar.refresh_token) : null,
    access_token_expires_at: svar.expires_in ? new Date(Date.now() + svar.expires_in * 1000).toISOString() : null,
    scope: svar.scope,
    status: 'aktiv',
    senaste_fel: null,
  };
  if (userId) {
    // En kund har en butik: en tidigare butik på samma konto släpps
    await supabase.from('shopify_butiker').update({ user_id: null, kopplad_at: null }).eq('user_id', userId).neq('shop', shop);
    row.user_id = userId;
    row.kopplad_at = new Date().toISOString();
  }

  const { data: finns } = await supabase.from('shopify_butiker').select('shop, status').eq('shop', shop).maybeSingle();
  if (!finns || finns.status !== 'aktiv') row.installerad_at = new Date().toISOString();

  const { error } = await supabase.from('shopify_butiker').upsert(row);
  if (error) throw new Error(`Kunde inte spara Shopify-butiken: ${error.message}`);
}

const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/** Butikens access token, förnyad om Shopify har gett oss en som går ut. */
export async function accessTokenFor(supabase: SupabaseClient, shop: string): Promise<string> {
  const { data: row, error } = await supabase
    .from('shopify_butiker')
    .select('access_token, refresh_token, access_token_expires_at, status')
    .eq('shop', shop)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa Shopify-butiken: ${error.message}`);
  if (!row?.access_token || row.status !== 'aktiv') throw new ShopifyEjInstallerad('Appen är inte installerad i butiken');

  const expires = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : null;
  if (expires === null || expires - EXPIRY_MARGIN_MS > Date.now() || !row.refresh_token) return decrypt(row.access_token);

  const svar = await tokenRequest(shop, { grant_type: 'refresh_token', refresh_token: decrypt(row.refresh_token) });
  const { error: saveError } = await supabase.from('shopify_butiker').update({
    access_token: encrypt(svar.access_token),
    refresh_token: svar.refresh_token ? encrypt(svar.refresh_token) : row.refresh_token,
    access_token_expires_at: svar.expires_in ? new Date(Date.now() + svar.expires_in * 1000).toISOString() : null,
  }).eq('shop', shop);
  if (saveError) throw new Error(`Kunde inte spara förnyad Shopify-token: ${saveError.message}`);
  return svar.access_token;
}

/** Appen är avinstallerad: token är död hos Shopify, så den slängs även här. */
export async function markeraAvinstallerad(supabase: SupabaseClient, shop: string) {
  await supabase.from('shopify_butiker').update({
    status: 'avinstallerad',
    access_token: null,
    refresh_token: null,
    access_token_expires_at: null,
  }).eq('shop', shop);
}

/** Tar bort appen från butiken, som när kunden kopplar bort den hos oss. */
export async function avinstallera(shop: string, token: string) {
  await shopifyGraphql(shop, token, 'mutation { appUninstall { userErrors { message } } }').catch(() => {});
}

// --- GraphQL ----------------------------------------------------------------

interface GraphqlSvar<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
}

export async function shopifyGraphql<T>(shop: string, token: string, query: string, variables?: object): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401) throw new ShopifyEjInstallerad('Shopify nekade åtkomst — installera appen igen');
    const body = res.ok ? ((await res.json()) as GraphqlSvar<T>) : null;
    const throttled = res.status === 429 || body?.errors?.some((e) => e.extensions?.code === 'THROTTLED');
    if (throttled && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (body?.errors?.length) throw new Error(`Shopify: ${body.errors.map((e) => e.message).join('; ').slice(0, 300)}`);
    return body!.data as T;
  }
}
