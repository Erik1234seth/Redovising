import type { SupabaseClient } from '@supabase/supabase-js';
import { tolkaBetalsatt } from './betalsatt';
import { TRANSAKTION_KOLUMNER, konteraTransaktioner, planeradeVerifikationer, type Kontering, type Transaktion } from './kontera';
import { iKronor } from './kronor';
import { bokforForfallna } from './preliminar';
import { kontonamn, preliminaraKonton, type Preliminart, type Resultat, type ResultatTransaktion } from './omgang/svar';
import type { Tillrackligt } from '@/lib/transaktioner/tillrackligt';

/**
 * Pending: transaktioner som väntar på mer information för att kunna
 * bokföras. De ligger i Granska i Flöde, märkta med om en fråga skickats till
 * kunden eller inte.
 *
 * En transaktion är pending när något står under "saknas" (`tillrackligt`,
 * status 'saknar') och byrån inte valt konto. Det som bara byrån kan avgöra —
 * en tveksam dubblett, ett kontoval där allt redan finns — är inte pending:
 * ny information ändrar inget där.
 *
 * När transaktionen lästes ut fick den ett eller flera preliminära konton
 * (`tillrackligt.preliminara`): kontona affären kan hamna på beroende på
 * svaret. I slutet av dagen (/api/cron/pending) konteras kundens pending
 * transaktioner om, var för sig, när kunden mejlat eller nya bankrader kommit
 * sedan förra försöket. Konteringen ser originalfilen, mejlen och bankraderna
 * som vanligt (./kontera), och får dessutom vad som saknades, de preliminära
 * kontona, om frågan skickats och vad som är nytt. Filens andra transaktioner
 * rörs inte.
 *
 * Utfallet: räcker det nya blir konteringen grön och bokförs direkt. Annars
 * är den kvar som pending, med det som fortfarande saknas och nya preliminära
 * konton. Flödes körning uppdateras, så att det syns i Flöde.
 */

/** Kön som kvällsjobbet lägger kunderna i (/api/queues/pending). */
export const PENDING_AMNE = 'pending';

export interface PendingMeddelande {
  userId: string;
  /** Resten från förra anropet. Saknas: alla med ny information. */
  ids?: string[];
}

/** Det pending-transaktionen bär med sig i `tillrackligt`. */
export interface PendingTillrackligt extends Tillrackligt {
  preliminara?: { konto: string; kontonamn?: string; nar: string }[];
  /** Senaste gången den konterades om med ny information. */
  provad_at?: string;
  omkorningar?: number;
}

interface PendingRad {
  id: string;
  user_id: string;
  created_at: string;
  tillrackligt: PendingTillrackligt;
  fraga_utkast_id: string | null;
}

export interface PendingInfo {
  /** När frågan om transaktionen skickades till kunden, annars null. */
  fragaSkickad: string | null;
  /** Ett utkast med frågan finns, men har inte skickats. */
  utkast: boolean;
  provadAt: string | null;
  omkorningar: number;
}

const iDelar = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

/** Kundens pending transaktioner: något saknas, byrån har inte valt konto, och den är inte bokförd. */
async function lasPending(supabase: SupabaseClient, userId: string): Promise<PendingRad[]> {
  const { data, error } = await supabase.from('transaktioner')
    .select('id, user_id, created_at, tillrackligt, fraga_utkast_id')
    .eq('user_id', userId).eq('tillrackligt->>status', 'saknar')
    .is('vald_kontering', null).is('dublett_av', null).is('dublett_orsak', null)
    .limit(1000);
  if (error) throw new Error(`Kunde inte läsa pending transaktioner: ${error.message}`);
  const rader = (data ?? []) as PendingRad[];
  if (!rader.length) return [];
  const bokforda = new Set<string>();
  for (const del of iDelar(rader.map((r) => r.id), 200)) {
    const { data: v } = await supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', del);
    for (const x of v ?? []) bokforda.add(x.transaktion_id as string);
  }
  return rader.filter((r) => !bokforda.has(r.id));
}

/** Frågemejlen: när varje utkast skickades, null när det inte skickats. */
async function lasUtkast(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string | null>> {
  const ut = new Map<string, string | null>();
  for (const del of iDelar([...new Set(ids)], 200)) {
    const { data } = await supabase.from('mejl_utkast').select('id, sent_at').in('id', del);
    for (const u of data ?? []) ut.set(u.id as string, (u.sent_at as string | null) ?? null);
  }
  return ut;
}

/** Visningen i Flöde: om en fråga skickats och när transaktionen senast konterades om. Nyckel: transaktionens id. */
export async function pendingInfo(supabase: SupabaseClient, userId: string): Promise<Record<string, PendingInfo>> {
  const rader = await lasPending(supabase, userId);
  const utkast = await lasUtkast(supabase, rader.map((r) => r.fraga_utkast_id).filter((x): x is string => !!x));
  return Object.fromEntries(rader.map((r) => {
    const skickat = r.fraga_utkast_id ? utkast.get(r.fraga_utkast_id) : undefined;
    return [r.id, {
      fragaSkickad: skickat ?? null,
      utkast: !!r.fraga_utkast_id && skickat === null,
      provadAt: r.tillrackligt.provad_at ?? null,
      omkorningar: r.tillrackligt.omkorningar ?? 0,
    }];
  }));
}

interface Nytt {
  mejl: { datum: string; amne: string }[];
  bank: { skapad: string; text: string }[];
}

/** Kundens mejl till byrån och nya bankrader sedan det tidigaste datumet. */
async function lasNytt(supabase: SupabaseClient, userId: string, sedan: string): Promise<Nytt> {
  const [{ data: profil }, { data: alias }] = await Promise.all([
    supabase.from('profiles').select('email').eq('id', userId).maybeSingle(),
    supabase.from('person_aliases').select('alias_email').eq('user_id', userId),
  ]);
  const adresser = [...new Set([profil?.email, ...(alias ?? []).map((a) => a.alias_email)]
    .filter((e): e is string => !!e).map((e) => e.trim().toLowerCase()))];
  const [{ data: mejl, error: mFel }, { data: bank, error: bFel }] = await Promise.all([
    adresser.length
      ? supabase.from('mail_messages').select('sent_at, subject').in('customer_email', adresser).eq('direction', 'in')
        .gt('sent_at', sedan).order('sent_at').limit(200)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('transaktioner').select('created_at, datum, belopp, valuta, riktning, motpart, beskrivning')
      .eq('user_id', userId).eq('kalla', 'bank').gt('created_at', sedan).order('datum').limit(500),
  ]);
  if (mFel) throw new Error(`Kunde inte läsa mejlen: ${mFel.message}`);
  if (bFel) throw new Error(`Kunde inte läsa bankraderna: ${bFel.message}`);
  return {
    mejl: (mejl ?? []).map((m) => ({ datum: String(m.sent_at), amne: String(m.subject ?? '') })),
    bank: (bank ?? []).map((b) => ({
      skapad: String(b.created_at),
      text: `${b.datum} ${b.riktning === 'in' ? 'IN' : 'UT'} ${Number(b.belopp)} ${b.valuta || 'SEK'} · ${[b.motpart, b.beskrivning].filter(Boolean).join(' · ') || '—'}`,
    })),
  };
}

/** Vad konteringen får veta om att transaktionen är pending. */
function pendingText(r: PendingRad, fragaSkickad: string | null | undefined, sedan: string, nytt: Nytt): string {
  const t = r.tillrackligt;
  const dag = (d: string) => d.slice(0, 10);
  const mejl = nytt.mejl.filter((m) => m.datum > sedan);
  const bank = nytt.bank.filter((b) => b.skapad > sedan);
  return [
    `DEN HÄR TRANSAKTIONEN VÄNTAR PÅ MER INFORMATION (pending). Den konterades ${dag(sedan)}, men då saknades:`,
    ...t.saknas.map((s) => `- ${s.vad}${s.varfor ? ` — ${s.varfor}` : ''}`),
    t.preliminara?.length
      ? `Preliminära konton då, beroende på svaret:\n${t.preliminara.map((p) => `- ${p.konto}${p.kontonamn ? ` ${p.kontonamn}` : ''}${p.nar ? ` — ${p.nar}` : ''}`).join('\n')}`
      : '',
    fragaSkickad ? `Vi frågade kunden om det i ett mejl ${dag(fragaSkickad)}.` : 'Vi har inte frågat kunden om det än.',
    `NYTT SEDAN ${dag(sedan)}:`,
    mejl.length ? `- ${mejl.length} mejl från kunden (${mejl.map((m) => `${dag(m.datum)} "${m.amne || 'inget ämne'}"`).join(', ')}) — de står i mejlväxlingen.` : '- Inga mejl från kunden.',
    bank.length ? `- ${bank.length} nya bankrader, som också står bland kundens transaktioner:\n${bank.slice(0, 60).map((b) => `  ${b.text}`).join('\n')}` : '- Inga nya bankrader.',
    `Pröva om det nya besvarar det som saknades — ett svar från kunden, eller en bankrad som visar betalningen. Kontera sedan som vanligt och utgå från de preliminära kontona; byt bara konto när det nya talar för det.
- "saknas": det som fortfarande saknas för att kunna bokföra. Tom lista när det vi nu har räcker — då bokförs transaktionen. Står frågan obesvarad står den kvar. Fråga inte om något nytt som inte spelar någon roll för konto, moms eller avdrag.
- "preliminara_konton": när något fortfarande saknas, kontona affären kan hamna på beroende på svaret — kontot i "delar" först — med vilket svar som leder dit. Tom lista när inget saknas.
- Säg i motiveringen vad i det nya som avgjorde, eller att inget av det nya gällde transaktionen.`,
  ].filter(Boolean).join('\n');
}

export interface PendingUtfall {
  /** Kunder och transaktioner som konterades om. */
  provade: number;
  /** Blev gröna och bokfördes. */
  losta: number;
  /** Fortfarande pending. */
  kvar: number;
  /** Inget nytt sedan förra försöket — de konterades inte om. */
  ofardiga: number;
  /** Fick inte plats i det här anropet: konteras om i nästa (se /api/queues/pending). */
  rest: string[];
  fel: string[];
  /** Torrkörning: vad konteringen svarade, inget sparat. */
  torr?: { transaktionId: string; fel: string | null; konto: string | null; omdome: string | null; motivering: string; pending: Kontering['pending'] | null }[];
}

/** Så många transaktioner per anrop. Konteringen körs fyra åt gången, och allt ska bli klart inom Vercels fem minuter. */
export const PENDING_PER_ANROP = 8;

/**
 * Konterar om kundens pending transaktioner som fått ny information sedan
 * förra försöket. `alla` konterar om dem ändå. `startad` är när anropet
 * började — konteringen måste bli klar inom Vercels tidsgräns räknat därifrån.
 */
export async function korOmPending(
  supabase: SupabaseClient,
  userId: string,
  { startad = Date.now(), alla = false, torrkorning = false, ids, max = PENDING_PER_ANROP }: {
    startad?: number; alla?: boolean; torrkorning?: boolean;
    /** Bara de här — resten från ett tidigare anrop. Annars alla med ny information. */
    ids?: string[];
    max?: number;
  } = {},
): Promise<PendingUtfall> {
  const utfall: PendingUtfall = { provade: 0, losta: 0, kvar: 0, ofardiga: 0, rest: [], fel: [] };
  const rader = (await lasPending(supabase, userId)).filter((r) => !ids || ids.includes(r.id));
  if (!rader.length) return utfall;

  const sedanFor = (r: PendingRad) => r.tillrackligt.provad_at ?? r.created_at;
  const tidigast = rader.reduce((m, r) => (sedanFor(r) < m ? sedanFor(r) : m), sedanFor(rader[0]));
  const nytt = await lasNytt(supabase, userId, tidigast);
  const harNytt = (r: PendingRad) => nytt.mejl.some((m) => m.datum > sedanFor(r)) || nytt.bank.some((b) => b.skapad > sedanFor(r));
  const alltAtt = rader.filter((r) => ids || alla || harNytt(r));
  utfall.ofardiga = rader.length - alltAtt.length;
  // Den som väntat längst först
  alltAtt.sort((a, b) => sedanFor(a).localeCompare(sedanFor(b)));
  const att = alltAtt.slice(0, max);
  utfall.rest = alltAtt.slice(max).map((r) => r.id);
  if (!att.length) return utfall;

  const utkast = await lasUtkast(supabase, att.map((r) => r.fraga_utkast_id).filter((x): x is string => !!x));
  // Transaktioner från före de preliminära kontona: kontot de konterades på är det preliminära
  const { data: forut } = await supabase.from('konteringar').select('transaktion_id, konto').in('transaktion_id', att.map((r) => r.id));
  const forutKonto = new Map((forut ?? []).filter((k) => k.konto).map((k) => [k.transaktion_id as string, k.konto as string]));
  for (const r of att) {
    const konto = forutKonto.get(r.id);
    if (!r.tillrackligt.preliminara?.length && konto) r.tillrackligt.preliminara = [{ konto, kontonamn: kontonamn(konto), nar: '' }];
  }
  const texter = new Map(att.map((r) => [r.id, pendingText(r, r.fraga_utkast_id ? utkast.get(r.fraga_utkast_id) : null, sedanFor(r), nytt)]));
  const svar = await konteraTransaktioner(supabase, userId, att.map((r) => r.id), { pending: texter, startad, torrkorning });
  if (torrkorning) {
    return {
      ...utfall,
      provade: svar.length,
      torr: svar.map((s) => ({
        transaktionId: s.transaktionId, fel: s.fel ?? null, konto: s.konteringar[0]?.konto ?? null, omdome: s.konteringar[0]?.omdome ?? null,
        motivering: s.konteringar[0]?.motivering ?? '', pending: s.konteringar[0]?.pending ?? null,
      })),
    };
  }

  const nu = new Date().toISOString();
  const perId = new Map(att.map((r) => [r.id, r]));
  const losta: string[] = [];
  const andrade = new Map<string, Kontering>();
  for (const s of svar) {
    const r = perId.get(s.transaktionId);
    const k = s.konteringar[0];
    if (!r) continue;
    if (s.fel || !k?.pending) {
      // Ingen ny provad_at: den prövas igen nästa gång
      utfall.fel.push(`${s.transaktionId}: ${s.fel ?? 'konteringen gav inget svar om det som saknas'}`);
      continue;
    }
    utfall.provade++;
    const { saknas, preliminara } = k.pending;
    const tillrackligt: PendingTillrackligt = {
      ...r.tillrackligt,
      status: saknas.length ? 'saknar' : 'tillrackligt',
      saknas,
      preliminara: preliminaraKonton(saknas, preliminara),
      provad_at: nu,
      omkorningar: (r.tillrackligt.omkorningar ?? 0) + 1,
    };
    const { error } = await supabase.from('transaktioner').update({ tillrackligt }).eq('id', r.id);
    if (error) { utfall.fel.push(`${r.id}: ${error.message}`); continue; }
    andrade.set(r.id, k);
    if (!saknas.length && k.omdome === 'gron') losta.push(r.id);
    else utfall.kvar++;
  }

  if (losta.length) {
    const { bokforda, fel } = await bokforForfallna(supabase, { userId, transaktionIds: losta, nu: true });
    utfall.losta = bokforda;
    utfall.kvar += losta.length - bokforda;
    utfall.fel.push(...fel);
  }
  if (andrade.size) {
    try {
      await uppdateraFlode(supabase, userId, andrade, nu);
    } catch (err) {
      utfall.fel.push(`Flöde kunde inte uppdateras: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return utfall;
}

/**
 * Flöde visar körningarna (kontering_prov), så den nya konteringen skrivs in
 * där transaktionen står: konto, moms, det som saknas, de preliminära kontona
 * och verifikationen.
 */
async function uppdateraFlode(supabase: SupabaseClient, userId: string, andrade: Map<string, Kontering>, nu: string) {
  const [{ data: profil }, { data: trans, error: tFel }] = await Promise.all([
    supabase.from('profiles').select('har_foretagskonto, redovisningsmetod').eq('id', userId).maybeSingle(),
    supabase.from('transaktioner').select(TRANSAKTION_KOLUMNER).in('id', [...andrade.keys()]),
  ]);
  if (tFel) throw new Error(tFel.message);
  const betalsatt = tolkaBetalsatt(profil?.har_foretagskonto ?? null);
  const perId = new Map(((trans ?? []) as unknown as (Transaktion & { tillrackligt: PendingTillrackligt })[]).map((t) => [t.id, t]));

  const { data: rader, error } = await supabase.from('kontering_prov').select('id, resultat')
    .eq('user_id', userId).eq('status', 'klar').is('jamfor_med', null).order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);

  const gjorda = new Set<string>();
  for (const rad of rader ?? []) {
    const resultat = rad.resultat as Resultat | null;
    let andrat = false;
    for (const f of resultat?.filer ?? []) for (const x of f.transaktioner) {
      // Den nyaste körningen där transaktionen står är den som visas
      if (!x.transaktionId || gjorda.has(x.transaktionId)) continue;
      const k = andrade.get(x.transaktionId);
      const t = perId.get(x.transaktionId);
      if (!k || !t) continue;
      Object.assign(x, flodesTransaktion(x, t, k, betalsatt, profil?.redovisningsmetod ?? null, nu));
      gjorda.add(x.transaktionId);
      andrat = true;
    }
    if (andrat) {
      const { error: uFel } = await supabase.from('kontering_prov').update({ resultat }).eq('id', rad.id);
      if (uFel) throw new Error(uFel.message);
    }
  }
}

function flodesTransaktion(
  x: ResultatTransaktion,
  t: Transaktion & { tillrackligt: PendingTillrackligt },
  k: Kontering,
  betalsatt: ReturnType<typeof tolkaBetalsatt>,
  metod: string | null,
  nu: string,
): Partial<ResultatTransaktion> {
  const saknas = t.tillrackligt.saknas ?? [];
  let verifikation: ResultatTransaktion['verifikation'] = null;
  let faktura: ResultatTransaktion['faktura'] = null;
  if (k.konto && betalsatt) {
    try {
      const plan = planeradeVerifikationer(iKronor(t), k.konto, k.momssats ?? 0, betalsatt, metod, undefined, k.momsdelar, k.omvand);
      const visa = (rader: { konto: string; belopp: number }[]) => rader.map((r) => ({ konto: r.konto, kontonamn: kontonamn(r.konto), belopp: Math.round(r.belopp * 100) / 100 }));
      verifikation = visa(plan[0].rader);
      if (plan[1]) faktura = { datum: plan[0].datum, betalning: { datum: plan[1].datum, rader: visa(plan[1].rader) } };
    } catch {
      // Verifikationen visas inte — konteringen syns ändå
    }
  }
  return {
    saknas,
    preliminara: (t.tillrackligt.preliminara ?? []) as Preliminart[],
    omkord: { at: nu, antal: t.tillrackligt.omkorningar ?? 1, lost: !saknas.length },
    fel: null,
    kontering: {
      konto: k.konto,
      kontonamn: k.konto ? kontonamn(k.konto) : '',
      momssats: k.momssats,
      momsdelar: k.momsdelar,
      omvand: k.omvand,
      motivering: k.motivering,
      regler: k.regler,
      granskning: k.granskning,
      flaggor: k.flaggor,
      omdome: k.omdome,
      sakerhet: k.granskning?.sakerhet ?? x.kontering?.sakerhet ?? 'medel',
      momshantering: x.kontering?.momshantering ?? '',
    },
    verifikation,
    faktura,
  };
}

/** Kunderna som har pending transaktioner. */
export async function kunderMedPending(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('transaktioner').select('user_id')
    .eq('tillrackligt->>status', 'saknar').is('vald_kontering', null).is('dublett_av', null).is('dublett_orsak', null)
    .not('user_id', 'is', null).limit(5000);
  if (error) throw new Error(`Kunde inte läsa pending transaktioner: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.user_id as string))];
}
