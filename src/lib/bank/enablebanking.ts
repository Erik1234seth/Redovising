import { createPrivateKey, createSign, type KeyObject } from 'crypto';

/**
 * Enable Banking: kopplar kundens bankkonto via PSD2 och läser transaktioner.
 * Vi läser bara — inga betalningar initieras.
 *
 * Varje anrop signeras med en JWT (RS256) med applikationens privata nyckel.
 * Applikationen skapas i Enable Bankings Control Panel, som ger ett app-id och
 * en .pem-fil. De läggs i ENABLE_BANKING_APP_ID och ENABLE_BANKING_PRIVATE_KEY
 * (hela pem-filen, radbrytningar får skrivas som \n).
 *
 * Kunden godkänner hos sin bank och kommer tillbaka till /api/bank/callback med
 * en kod som blir en session. Sessionen gäller tills medgivandet går ut (ofta
 * 90–180 dagar), sedan måste kunden koppla om.
 */

const API = 'https://api.enablebanking.com';

export class BankSessionUtgangen extends Error {}

function credentials() {
  const appId = process.env.ENABLE_BANKING_APP_ID?.trim();
  // Tål citattecken och \n från en inklistrad .env-rad lika väl som riktiga radbrytningar
  const pem = process.env.ENABLE_BANKING_PRIVATE_KEY?.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  if (!appId || !pem) throw new Error('ENABLE_BANKING_APP_ID eller ENABLE_BANKING_PRIVATE_KEY saknas');
  let key: KeyObject;
  try {
    key = createPrivateKey(pem);
  } catch {
    throw new Error('ENABLE_BANKING_PRIVATE_KEY går inte att läsa — klistra in hela pem-filen');
  }
  return { appId, key };
}

export function bankRedirectUri(): string {
  return process.env.ENABLE_BANKING_REDIRECT_URI || 'https://app.enklabokslut.se/api/bank/callback';
}

function b64url(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function jwt(): string {
  const { appId, key } = credentials();
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ typ: 'JWT', alg: 'RS256', kid: appId })}.${b64url({
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat,
    exp: iat + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  return `${unsigned}.${signature}`;
}

async function eb<T>(method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    // Utgånget eller återkallat medgivande — kunden måste koppla om
    if (/EXPIRED_SESSION|CLOSED_SESSION|REVOKED|SESSION_DOES_NOT_EXIST|EXPIRED_CONSENT/i.test(text)) {
      throw new BankSessionUtgangen(`Bankens medgivande har gått ut (${res.status})`);
    }
    throw new Error(`Enable Banking ${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// --- Banker och koppling ----------------------------------------------------

export interface Aspsp {
  name: string;
  country: string;
  logo?: string;
  psu_types?: string[];
  maximum_consent_validity?: number;
  beta?: boolean;
}

export async function listaBanker(country = 'SE'): Promise<Aspsp[]> {
  const svar = await eb<{ aspsps: Aspsp[] }>('GET', `/aspsps?country=${encodeURIComponent(country)}&service=AIS`);
  return svar.aspsps ?? [];
}

/** Längsta medgivande vi ber om; banken kan ha ett kortare tak. */
const MAX_GILTIGHET_S = 180 * 24 * 60 * 60;

export async function startaAuth(opts: {
  aspsp: Aspsp;
  psuType: 'business' | 'personal';
  state: string;
}): Promise<string> {
  const giltighet = Math.min(opts.aspsp.maximum_consent_validity ?? MAX_GILTIGHET_S, MAX_GILTIGHET_S);
  const svar = await eb<{ url: string }>('POST', '/auth', {
    access: { valid_until: new Date(Date.now() + (giltighet - 60) * 1000).toISOString() },
    aspsp: { name: opts.aspsp.name, country: opts.aspsp.country },
    state: opts.state,
    redirect_url: bankRedirectUri(),
    psu_type: opts.psuType,
    language: 'sv',
  });
  return svar.url;
}

export interface EbKonto {
  uid: string;
  identification_hash: string;
  account_id?: { iban?: string; other?: { identification?: string } };
  name?: string;
  details?: string;
  product?: string;
  currency?: string;
}

export interface EbSession {
  session_id: string;
  accounts: EbKonto[];
  access?: { valid_until?: string };
}

export function skapaSession(code: string) {
  return eb<EbSession>('POST', '/sessions', { code });
}

export function hamtaSession(sessionId: string) {
  return eb<{ status?: string; access?: { valid_until?: string } }>('GET', `/sessions/${encodeURIComponent(sessionId)}`);
}

export async function avslutaSession(sessionId: string) {
  await eb('DELETE', `/sessions/${encodeURIComponent(sessionId)}`).catch(() => {});
}

// --- Transaktioner ----------------------------------------------------------

export interface EbTransaktion {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: 'CRDT' | 'DBIT';
  status?: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  remittance_information?: string[] | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  note?: string | null;
}

/** Bokförda transaktioner från och med ett datum, alla sidor. */
export async function hamtaTransaktioner(uid: string, dateFrom: string): Promise<EbTransaktion[]> {
  const alla: EbTransaktion[] = [];
  let continuationKey: string | undefined;
  do {
    const params = new URLSearchParams({ date_from: dateFrom, transaction_status: 'BOOK' });
    if (continuationKey) params.set('continuation_key', continuationKey);
    const svar = await eb<{ transactions?: EbTransaktion[]; continuation_key?: string | null }>(
      'GET',
      `/accounts/${encodeURIComponent(uid)}/transactions?${params}`,
    );
    alla.push(...(svar.transactions ?? []));
    continuationKey = svar.continuation_key || undefined;
  } while (continuationKey);
  return alla;
}
