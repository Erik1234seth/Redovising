import type { SupabaseClient } from '@supabase/supabase-js';
import { KUND_KOLUMNER, byggKundkontext, type Kund } from '@/lib/ai-test/kundkontext';
import { byggMejlkontext } from '@/lib/mejlkontext';
import type { ValdKontering } from './kontera';
import { fraga } from './modeller';
import { rensaMomsdelar, sammaMoms } from './momsdelar';
import { slaUppKonto } from './regelverk';

/**
 * Kundbilden: det konteringen behöver veta om kunden för att förstå en
 * enskild transaktion. Två delar:
 *
 * - Årslistan: alla kundens transaktioner, en rad var, byggd med kod varje
 *   gång. Den är alltid aktuell och kostar ingenting.
 * - Sammanställningen: en modell läser årslistan, mejlen och kundprofilen och
 *   skriver vad den ser — återkommande motparter och vad de är, privata
 *   mönster, lån, abonnemang, vad som är oklart. Den sparas i `kundbilder`
 *   och byggs om först när kunden fått många nya transaktioner, när den är
 *   gammal eller när någon ber om det (Kör om alla).
 *
 * Byråns val i Granska står med i årslistan som en stark ledtråd, inte som
 * facit — de kan vara fel de också. Till konteringen visas också kontot varje
 * rad redan fått (`medKonton`): bokfört, byråns val, eller AI:ns när båda
 * modellerna är gröna och överens. Då kan modellen själv se hur kundens
 * liknande köp konterats, också innan något hunnit bli verifikation.
 */

/** Betal- och momskonton. De säger inget om vad affären är, så de visas inte för en bokförd rad. */
const BETAL_OCH_MOMS = new Set(['1930', '2013', '2017', '2641', '2611', '2614', '2615', '2621', '2631', '2645', '2647']);

const MODELL = 'claude-opus-5-5' as const;
// Så många rader får årslistan, de senaste först. Fler än så får inte plats med marginal.
const MAX_RADER = 1500;
const GAMMAL_DAGAR = 30;

export interface Arsrad {
  id: string;
  datum: string | null;
  riktning: 'in' | 'ut';
  belopp: number;
  valuta: string | null;
  motpart: string | null;
  beskrivning: string | null;
  kalla: string;
  underlag_id: string | null;
  vald_kontering: ValdKontering | null;
}

export interface Arslista {
  rader: Arsrad[];
  /** Radens nummer i listan, K1, K2 … */
  nummer: Map<string, number>;
  text: string;
  filnamn: Map<string, string>;
}

/**
 * Kundens transaktioner, utom säkra dubbletter, som en kompakt lista i
 * datumordning. Med `medKonton` står kontot varje rad fått, utom för raderna
 * i `utanKontoFor` — de som konteras just nu. Ser modellen sitt eget gamla
 * svar upprepar den det, och då blir en omkörning efter en ny instruktion
 * meningslös.
 */
export async function hamtaArslista(
  supabase: SupabaseClient,
  userId: string,
  { medKonton = false, utanKontoFor = new Set<string>() }: { medKonton?: boolean; utanKontoFor?: Set<string> } = {},
): Promise<Arslista> {
  const rader: Arsrad[] = [];
  for (let fran = 0; rader.length < MAX_RADER; fran += 1000) {
    const { data, error } = await supabase.from('transaktioner')
      .select('id, datum, riktning, belopp, valuta, motpart, beskrivning, kalla, underlag_id, vald_kontering')
      .eq('user_id', userId).is('dublett_av', null)
      .order('datum', { ascending: false, nullsFirst: false }).order('id')
      .range(fran, fran + 999);
    if (error) throw new Error(`Kunde inte läsa kundens transaktioner: ${error.message}`);
    rader.push(...(data ?? []) as Arsrad[]);
    if ((data ?? []).length < 1000) break;
  }
  const underlagIds = [...new Set(rader.map((r) => r.underlag_id).filter((x): x is string => !!x))];
  const filnamn = new Map<string, string>();
  // En sida som läses med ett annat underlag har inga egna transaktioner —
  // står det ändå några kvar på den är de gamla och hör inte hit
  const sidor = new Set<string>();
  for (let i = 0; i < underlagIds.length; i += 200) {
    const { data } = await supabase.from('bokforing_underlag').select('id, file_name, del_av').in('id', underlagIds.slice(i, i + 200));
    for (const f of data ?? []) {
      filnamn.set(f.id, f.file_name);
      if (f.del_av) sidor.add(f.id);
    }
  }
  const lista = rader.filter((r) => !r.underlag_id || !sidor.has(r.underlag_id)).slice(0, MAX_RADER).reverse();

  const konton = medKonton ? await kontonFor(supabase, lista.map((r) => r.id).filter((id) => !utanKontoFor.has(id))) : new Map<string, string>();
  const nummer = new Map(lista.map((r, i) => [r.id, i + 1]));
  const text = lista.map((r, i) => {
    const vald = utanKontoFor.has(r.id) ? ''
      : konton.has(r.id) ? ` → ${konton.get(r.id)}`
      : r.vald_kontering?.konto ? ` · byrån valde ${r.vald_kontering.konto} ${slaUppKonto(r.vald_kontering.konto)?.namn ?? ''}`.trimEnd() : '';
    const kalla = r.kalla === 'bank' ? 'bankrad' : r.kalla === 'woocommerce' ? 'webbutik' : filnamn.get(r.underlag_id ?? '') ?? 'fil';
    return `K${i + 1} ${r.datum ?? 'okänt datum'} ${r.riktning === 'in' ? 'IN ' : 'UT '} ${Number(r.belopp)} ${r.valuta || 'SEK'} · ${r.motpart || '—'} · ${(r.beskrivning ?? '').slice(0, 80)} · ${kalla.slice(0, 40)}${vald}`;
  }).join('\n');
  return { rader: lista, nummer, text, filnamn };
}

const kontonamn = (konton: string[]) => konton.map((k) => `${k} ${slaUppKonto(k)?.namn ?? ''}`.trim()).join(' + ');

/**
 * Kontot varje transaktion fått, med varifrån: bokförd, byrån eller AI. En
 * bokförd rad visar verifikationens konton. Byråns val går före AI:n, och
 * AI:n visas bara när båda modellerna är gröna och överens — oense säger inget.
 */
async function kontonFor(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const ut = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const del = ids.slice(i, i + 200);
    const [t, k, v] = await Promise.all([
      supabase.from('transaktioner').select('id, vald_kontering').in('id', del),
      supabase.from('konteringar').select('transaktion_id, konto, momssats, momsdelar, omdome').in('transaktion_id', del),
      supabase.from('verifikationer').select('transaktion_id, verifikation_rader(konto, borttagen)').in('transaktion_id', del),
    ]);
    if (t.error ?? k.error ?? v.error) throw new Error(`Kunde inte läsa kundens konteringar: ${(t.error ?? k.error ?? v.error)!.message}`);
    for (const x of v.data ?? []) {
      const rader = ((x.verifikation_rader ?? []) as { konto: string; borttagen: boolean }[]).filter((r) => !r.borttagen && !BETAL_OCH_MOMS.has(r.konto));
      const konton = [...new Set(rader.map((r) => r.konto))];
      if (x.transaktion_id && konton.length) ut.set(x.transaktion_id, `${kontonamn(konton)} (bokförd)`);
    }
    for (const x of t.data ?? []) {
      const vald = x.vald_kontering as ValdKontering | null;
      if (ut.has(x.id) || !vald?.konto) continue;
      const delar = rensaMomsdelar(vald.momsdelar);
      ut.set(x.id, `${kontonamn(delar ? [...new Set(delar.map((d) => d.konto ?? vald.konto))] : [vald.konto])} (byrån valde)`);
    }
    const perTransaktion = new Map<string, { konto: string | null; momssats: number | null; momsdelar: unknown; omdome: string }[]>();
    for (const x of k.data ?? []) perTransaktion.set(x.transaktion_id, [...(perTransaktion.get(x.transaktion_id) ?? []), x]);
    for (const [id, lista] of perTransaktion) {
      if (ut.has(id) || lista.length < 2) continue;
      const [a] = lista;
      const overens = lista.every((x) => x.omdome === 'gron' && x.konto && x.konto === a.konto
        && sammaMoms({ momssats: Number(x.momssats), momsdelar: rensaMomsdelar(x.momsdelar) }, { momssats: Number(a.momssats), momsdelar: rensaMomsdelar(a.momsdelar) }));
      if (!overens) continue;
      const delar = rensaMomsdelar(a.momsdelar);
      ut.set(id, `${kontonamn(delar ? [...new Set(delar.map((d) => d.konto ?? a.konto!))] : [a.konto!])} (AI, båda överens)`);
    }
  }
  return ut;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kundbild'],
  properties: { kundbild: { type: 'string' } },
};

const FAST = `Du hjälper en svensk bokföringsbyrå att förstå en kund — en enskild näringsidkare med förenklat årsbokslut (K1) och kontantmetoden — innan kundens transaktioner konteras.

Du får kundprofilen, kundens mejl till byrån och en lista med kundens transaktioner (K1, K2 …). Skriv en kundbild på svenska som en kollega kan läsa på två minuter innan hen konterar en enskild transaktion. Den ska hjälpa till att förstå vad en transaktion är — inte välja konto.

Ta med:
- Vad verksamheten faktiskt gör, utifrån transaktionerna och mejlen, och om det skiljer sig från profilen.
- Återkommande motparter: vem de är, vad affären troligen gäller, ungefär hur ofta och vilka belopp. Hänvisa till rader (K12, K40).
- Intäkterna: varifrån de kommer, plattformar, kassasystem, Swish, utlandet.
- Mönster som tyder på privata transaktioner, egna insättningar och uttag, lån, leasing, abonnemang, försäkringar, skatter.
- Det som är oklart eller ser ovanligt ut och som konteringen bör vara försiktig med.
- Vad kunden själv har förklarat i mejlen om sina köp och sin verksamhet.

Byråns tidigare val står som "byrån valde" i listan. De är en stark ledtråd om vad en affär är, men de kan vara fel — återge mönstret, inte kontot som en regel.

Hitta inte på. Skriv "oklart" hellre än att gissa. Högst cirka 6 000 tecken, i stycken eller punkter.`;

/** Den sparade sammanställningen, eller null om ingen finns. */
export async function hamtaKundbild(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from('kundbilder').select('text').eq('user_id', userId).maybeSingle();
  return data?.text || null;
}

/** Behöver sammanställningen byggas om? Ingen finns, den är gammal, eller kunden har fått många nya transaktioner. */
async function inaktuell(supabase: SupabaseClient, userId: string, antal: number): Promise<boolean> {
  const { data } = await supabase.from('kundbilder').select('byggd_at, antal_transaktioner, text').eq('user_id', userId).maybeSingle();
  if (!data?.text || !data.byggd_at) return true;
  if (Date.now() - Date.parse(data.byggd_at) > GAMMAL_DAGAR * 86_400_000) return true;
  return antal - (data.antal_transaktioner ?? 0) >= Math.max(10, Math.round((data.antal_transaktioner ?? 0) * 0.2));
}

/**
 * Bygger kundbilden om den behövs, eller alltid med `tvinga`. Svarar med om
 * den byggdes.
 */
export async function byggKundbild(supabase: SupabaseClient, userId: string, { tvinga = false } = {}): Promise<boolean> {
  const arslista = await hamtaArslista(supabase, userId);
  if (!tvinga && !(await inaktuell(supabase, userId, arslista.rader.length))) return false;

  const { data: profil, error } = await supabase.from('profiles').select(KUND_KOLUMNER).eq('id', userId).maybeSingle();
  if (error) throw new Error(`Kunde inte läsa kunden: ${error.message}`);
  const mejl = await byggMejlkontext(supabase, { userId, emails: [(profil as unknown as Kund | null)?.email] });

  try {
    const { data, modell } = await fraga<{ kundbild: string }>(MODELL, {
      system: { fast: FAST, kund: '' },
      user: [
        byggKundkontext(profil as unknown as Kund | null),
        mejl ? `KUNDENS MEJL MED BYRÅN:\n${mejl}` : 'Det finns inga mejl från kunden.',
        `KUNDENS TRANSAKTIONER (${arslista.rader.length} st, äldst först):\n${arslista.text || '(inga än)'}`,
      ].filter(Boolean).join('\n\n'),
      namn: 'kundbild',
      schema: SCHEMA,
    });
    const { error: sFel } = await supabase.from('kundbilder').upsert({
      user_id: userId, text: data.kundbild.trim(), modell, byggd_at: new Date().toISOString(),
      antal_transaktioner: arslista.rader.length, fel: null,
    }, { onConflict: 'user_id' });
    if (sFel) throw new Error(`Kunde inte spara kundbilden: ${sFel.message}`);
    return true;
  } catch (err) {
    const fel = err instanceof Error ? err.message : String(err);
    await supabase.from('kundbilder').upsert({ user_id: userId, fel }, { onConflict: 'user_id' });
    throw new Error(`Kundbilden: ${fel}`);
  }
}
