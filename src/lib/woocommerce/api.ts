import { isIP } from 'net';
import { tokenCipher } from '../token-crypto';

/**
 * WooCommerce: butikens adress, godkännandet och anropen mot REST-API:t.
 *
 * WooCommerce är ett tillägg som varje kund kör på sin egen WordPress, så det
 * finns ingen app att installera. Kunden godkänner läsbehörighet på sin egen
 * sida (/wc-auth/v1/authorize), och WooCommerce skapar en API-nyckel som den
 * skickar till vår callback. Går det inte kan kunden skapa en nyckel själv
 * (WooCommerce → Inställningar → Avancerat → REST API) och klistra in den.
 *
 * Nycklarna krypteras med WOOCOMMERCE_TOKEN_KEY.
 */

export const { encrypt, decrypt } = tokenCipher('WOOCOMMERCE_TOKEN_KEY');

export function appUrl(): string {
  return (process.env.WOOCOMMERCE_APP_URL || 'https://app.enklabokslut.se').replace(/\/$/, '');
}

/**
 * "minbutik.se", "https://minbutik.se/" eller "https://minbutik.se/shop" →
 * "https://minbutik.se/shop". Bara https — nycklarna skickas med varje anrop.
 *
 * Vi anropar adressen från vår server, så den får inte peka på något internt.
 */
export function normaliseraUrl(input: string): string | null {
  let text = input.trim();
  if (!text) return null;
  if (/^http:\/\//i.test(text)) return null;
  if (!/^https:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || isIP(host.replace(/^\[|\]$/g, ''))) {
    return null;
  }
  if (url.username || url.password || url.port) return null;
  const path = url.pathname.replace(/\/+$/, '').replace(/\/wp-admin.*$/, '');
  return `https://${host}${path}`;
}

/** Adressen dit kunden skickas för att godkänna. state kommer tillbaka som user_id. */
export function authorizeUrl(url: string, state: string): string {
  const params = new URLSearchParams({
    app_name: 'Enkla Bokslut',
    scope: 'read',
    user_id: state,
    return_url: `${appUrl()}/integrationer?woocommerce=retur`,
    callback_url: `${appUrl()}/api/woocommerce/callback`,
  });
  return `${url}/wc-auth/v1/authorize?${params}`;
}

export interface Nycklar {
  url: string;
  key: string;
  secret: string;
}

export class WooFel extends Error {}

/**
 * GET mot WooCommerce REST-API:t. Provar först vanlig inloggning på
 * /wp-json. En del servrar tar bort Authorization-huvudet — då skickas
 * nyckeln i adressen i stället (tillåtet över https). Utan "snygga" länkar i
 * WordPress finns inte /wp-json, och då går det via ?rest_route=.
 */
export async function wooGet<T>(n: Nycklar, path: string, params: Record<string, string> = {}): Promise<{ data: T; totalPages: number }> {
  const query = new URLSearchParams(params).toString();
  const forsok = [
    { url: `${n.url}/wp-json/wc/v3${path}${query ? `?${query}` : ''}`, basic: true },
    { url: `${n.url}/wp-json/wc/v3${path}?${new URLSearchParams({ ...params, consumer_key: n.key, consumer_secret: n.secret })}`, basic: false },
    { url: `${n.url}/?${new URLSearchParams({ rest_route: `/wc/v3${path}`, ...params, consumer_key: n.key, consumer_secret: n.secret })}`, basic: false },
  ];

  let senaste = '';
  for (const f of forsok) {
    let res: Response;
    try {
      res = await fetch(f.url, {
        headers: {
          Accept: 'application/json',
          ...(f.basic ? { Authorization: `Basic ${Buffer.from(`${n.key}:${n.secret}`).toString('base64')}` } : {}),
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
        cache: 'no-store',
      });
    } catch (err) {
      throw new WooFel(`Vi når inte butiken (${err instanceof Error ? err.message : 'okänt fel'}). Kontrollera adressen.`);
    }

    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // HTML, t.ex. en 404-sida eller en brandvägg — prova nästa sätt
    }

    if (res.ok && json !== null) {
      return { data: json as T, totalPages: Number(res.headers.get('x-wp-totalpages') ?? '1') || 1 };
    }
    const kod = (json as { code?: string } | null)?.code ?? '';
    const meddelande = (json as { message?: string } | null)?.message ?? '';
    senaste = `${res.status}${kod ? ` ${kod}` : ''}${meddelande ? `: ${meddelande}` : ''}`;
    // Fel nyckel eller för lite behörighet hjälper inget annat sätt mot
    if (res.status === 403 || kod === 'woocommerce_rest_authentication_error') break;
  }

  if (senaste.startsWith('401') || senaste.startsWith('403')) {
    throw new WooFel(`Butiken godkände inte nyckeln (${senaste}). Koppla om WooCommerce.`);
  }
  throw new WooFel(`Butiken svarade inte som en WooCommerce-butik (${senaste || 'inget svar'}). Kontrollera adressen.`);
}
