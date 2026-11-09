import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Sparar vad varje AI-anrop kostade i tabellen ai_anrop, så att kostnaden per
 * steg går att läsa i stället för att räknas fram.
 *
 * Loggningen får aldrig stoppa flödet: alla fel fångas här och skrivs bara ut.
 * Bara anrop som gett svar loggas, så ett anrop som avbryts halvvägs syns inte.
 */

export interface Anropsinfo {
  /** Steget i flödet, t.ex. 'konteras'. */
  steg: string;
  userId?: string | null;
  underlagId?: string | null;
}

/**
 * Dollar per miljon tokens, listpriser 2026-11-07. Claudes cache skrivs alltid
 * med 1 timmes livstid (se ./kontering/modeller). "lang" är OpenAIs påslag för
 * långa prompter: över gränsen kostar hela anropet mer, indata dubbelt och
 * svaret en och en halv gång.
 */
const PRISER: Record<string, { indata: number; cacheLast: number; cacheSkriv?: number; utdata: number; lang?: { over: number; indata: number; utdata: number } }> = {
  'gpt-6.1-sol': { indata: 2, cacheLast: 0.1, utdata: 10, lang: { over: 272_000, indata: 2, utdata: 1.5 } },
  'gpt-6-luna': { indata: 0.1, cacheLast: 0.01, utdata: 0.5 },
  'text-embedding-3-small': { indata: 0.02, cacheLast: 0, utdata: 0 },
  'claude-opus-5-5': { indata: 4, cacheLast: 0.2, cacheSkriv: 8, utdata: 20 },
  'claude-sonnet-5-5': { indata: 2, cacheLast: 0.1, cacheSkriv: 4, utdata: 10 },
};
const PER_WEBBSOKNING = 0.01;
const PER_KODMILJO = 0.03;

interface Tokens {
  indata: number;
  cacheLast: number;
  cacheSkrivet: number;
  utdata: number;
  tankande: number;
  webbsokningar: number;
  kodmiljoer: number;
}

function kostnad(modell: string, t: Tokens): number | null {
  // Svaret kan ange en daterad version av modellen
  const nyckel = Object.keys(PRISER).find((k) => modell.startsWith(k));
  if (!nyckel) return null;
  const p = PRISER[nyckel];
  const lang = p.lang && t.indata + t.cacheLast + t.cacheSkrivet > p.lang.over ? p.lang : { indata: 1, utdata: 1 };
  const tokens = (t.indata * p.indata + t.cacheLast * p.cacheLast + t.cacheSkrivet * (p.cacheSkriv ?? p.indata)) * lang.indata + t.utdata * p.utdata * lang.utdata;
  return tokens / 1_000_000 + t.webbsokningar * PER_WEBBSOKNING + t.kodmiljoer * PER_KODMILJO;
}

let klient: SupabaseClient | null = null;

async function spara(anrop: Anropsinfo, modell: string, t: Tokens): Promise<void> {
  try {
    klient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await klient.from('ai_anrop').insert({
      steg: anrop.steg,
      modell,
      user_id: anrop.userId ?? null,
      underlag_id: anrop.underlagId ?? null,
      indata: t.indata,
      cache_last: t.cacheLast,
      cache_skrivet: t.cacheSkrivet,
      utdata: t.utdata,
      tankande: t.tankande,
      webbsokningar: t.webbsokningar,
      kodmiljoer: t.kodmiljoer,
      kostnad_usd: kostnad(modell, t),
    });
    if (error) console.error('[ai-logg] kunde inte spara:', error.message);
  } catch (err) {
    console.error('[ai-logg] kunde inte spara:', err);
  }
}

const tal = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** Chat Completions och Responses kallar fälten olika, och båda räknar cachen som del av indata. */
function openaiTokens(
  usage: Record<string, any> | null | undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
  extra: { webbsokningar?: number; kodmiljoer?: number },
): Tokens {
  const cacheLast = tal(usage?.prompt_tokens_details?.cached_tokens ?? usage?.input_tokens_details?.cached_tokens);
  return {
    indata: Math.max(0, tal(usage?.prompt_tokens ?? usage?.input_tokens) - cacheLast),
    cacheLast,
    cacheSkrivet: 0,
    utdata: tal(usage?.completion_tokens ?? usage?.output_tokens),
    tankande: tal(usage?.completion_tokens_details?.reasoning_tokens ?? usage?.output_tokens_details?.reasoning_tokens),
    webbsokningar: extra.webbsokningar ?? 0,
    kodmiljoer: extra.kodmiljoer ?? 0,
  };
}

/** Svaret från OpenAI. */
export async function loggaOpenAI(
  anrop: Anropsinfo,
  modell: string,
  usage: Record<string, any> | null | undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
  extra: { webbsokningar?: number; kodmiljoer?: number } = {},
): Promise<void> {
  await spara(anrop, modell, openaiTokens(usage, extra));
}

/** Vad ett OpenAI-anrop kostade i dollar, till listpris. Null för en modell utan pris. */
export function kostnadOpenAI(
  modell: string,
  usage: Record<string, any> | null | undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
): number | null {
  return kostnad(modell, openaiTokens(usage, {}));
}

/** Svaret från Claude. Här ligger cachen utanför input_tokens, och tänkandet ingår i output_tokens utan egen siffra. */
export async function loggaClaude(
  anrop: Anropsinfo,
  modell: string,
  usage: Record<string, any> | null | undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<void> {
  await spara(anrop, modell, {
    indata: tal(usage?.input_tokens),
    cacheLast: tal(usage?.cache_read_input_tokens),
    cacheSkrivet: tal(usage?.cache_creation_input_tokens),
    utdata: tal(usage?.output_tokens),
    tankande: 0,
    webbsokningar: tal(usage?.server_tool_use?.web_search_requests),
    kodmiljoer: 0,
  });
}
