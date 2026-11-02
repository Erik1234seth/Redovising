import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Riksbankens dagliga mittkurser, sparade i tabellen valutakurser så att ett
 * belopp i utländsk valuta kan räknas om till kronor för vilket datum som helst.
 *
 * Varför Riksbanken: kurserna är officiella, gratis och går tillbaka till 1993,
 * och Skatteverket godtar dem. En kurs är kronor per EN enhet av valutan, även
 * för yen (0,06 kr) — Riksbanken anger inte 100 JPY som vissa banker gör.
 *
 * Kurser finns bara för bankdagar och publiceras runt 16:15 svensk tid. För en
 * lördag, en helgdag eller dagens datum före publiceringen gäller närmast
 * föregående bankdag, vilket är praxis i bokföringen.
 *
 * Utan API-nyckel tillåter Riksbanken bara ett fåtal anrop i minuten. Ett anrop
 * per år räcker dock: ByGroup/130 ger alla valutor för ett helt intervall.
 */

const API = 'https://api.riksbank.se/swea/v1/Observations/ByGroup/130';

/** Längre tillbaka än så letar vi inte efter en föregående bankdag. */
const MAX_DAGAR_TILLBAKA = 7;

/** Riksbanken svarar 429 med "Try again in 34 seconds" — vi väntar så länge, högst så här många gånger. */
const MAX_FORSOK = 4;

interface Observation { seriesId: string; date: string; value: number }

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hamtaIntervall(fran: string, tom: string): Promise<Observation[]> {
  for (let forsok = 1; ; forsok++) {
    const res = await fetch(`${API}/${fran}/${tom}`, { cache: 'no-store' });
    if (res.status === 429 && forsok < MAX_FORSOK) {
      const text = await res.text();
      const sek = Number(text.match(/in (\d+) seconds/)?.[1] ?? 60);
      await vanta((sek + 1) * 1000);
      continue;
    }
    // Ett intervall utan bankdagar (t.ex. bara en helg) svarar 204 utan kropp
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`Riksbanken svarade ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}

/**
 * Hämtar kurserna för perioden och sparar dem. Finns en kurs redan skrivs den
 * över — Riksbanken rättar ibland en kurs i efterhand. Långa perioder hämtas ett
 * år i taget.
 */
export async function hamtaValutakurser(
  supabase: SupabaseClient,
  fran: string,
  tom: string,
): Promise<{ kurser: number; valutor: number }> {
  const rader: { datum: string; valuta: string; sek: number }[] = [];
  for (let ar = Number(fran.slice(0, 4)); ar <= Number(tom.slice(0, 4)); ar++) {
    const a = ar === Number(fran.slice(0, 4)) ? fran : `${ar}-01-01`;
    const b = ar === Number(tom.slice(0, 4)) ? tom : `${ar}-12-31`;
    for (const o of await hamtaIntervall(a, b)) {
      // SEKEURPMI → EUR. Andra serier i gruppen (SEKETT) är inga valutor.
      const valuta = o.seriesId.match(/^SEK([A-Z]{3})PMI$/)?.[1];
      if (valuta && typeof o.value === 'number' && o.value > 0) rader.push({ datum: o.date, valuta, sek: o.value });
    }
  }

  for (let i = 0; i < rader.length; i += 1000) {
    const { error } = await supabase.from('valutakurser').upsert(rader.slice(i, i + 1000), { onConflict: 'valuta,datum' });
    if (error) throw new Error(`Kunde inte spara valutakurserna: ${error.message}`);
  }
  return { kurser: rader.length, valutor: new Set(rader.map((r) => r.valuta)).size };
}

export interface Valutakurs {
  /** Kronor per en enhet av valutan. */
  sek: number;
  /** Bankdagen kursen gäller — kan vara före det datum man frågade om. */
  datum: string;
}

/**
 * Kursen som gäller ett datum: samma dag, eller närmast föregående bankdag.
 * null när ingen kurs finns inom en vecka — okänd valuta, en valuta Riksbanken
 * slutat notera, eller en dag som inte hämtats än. Gissa aldrig då.
 */
export async function valutakurs(
  supabase: SupabaseClient,
  valuta: string,
  datum: string,
): Promise<Valutakurs | null> {
  const kod = valuta.trim().toUpperCase();
  if (kod === 'SEK') return { sek: 1, datum };

  const tidigast = new Date(Date.parse(datum) - MAX_DAGAR_TILLBAKA * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('valutakurser')
    .select('datum, sek')
    .eq('valuta', kod)
    .lte('datum', datum)
    .gte('datum', tidigast)
    .order('datum', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa valutakursen: ${error.message}`);
  return data ? { sek: Number(data.sek), datum: data.datum } : null;
}

/** Beloppet i kronor, avrundat till ören, med kursen som användes. null utan kurs. */
export async function tillKronor(
  supabase: SupabaseClient,
  belopp: number,
  valuta: string,
  datum: string,
): Promise<{ sek: number; kurs: Valutakurs } | null> {
  const kurs = await valutakurs(supabase, valuta, datum);
  if (!kurs) return null;
  return { sek: Math.round(belopp * kurs.sek * 100) / 100, kurs };
}
