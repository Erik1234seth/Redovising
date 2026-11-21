import type { SupabaseClient } from '@supabase/supabase-js';
import { bankFalt, type BankFalt } from './bank/falt';
import type { EbTransaktion } from './bank/enablebanking';

/**
 * Det kundens startsida och kontovy visar: checklistan, bankkontona med vad
 * varje bankrad är kopplad till, och året hittills ur huvudboken.
 *
 * En bankrad är kopplad när något i bokföringen förklarar den:
 * - ett underlag (kvitto, faktura) med samma belopp och datum — dubblettkontrollen
 *   har satt dublett_av på bankraden (../transaktioner/dubbletter)
 * - en dagskassa från Zettle eller Shopify som utbetalningen redan ingår i (dublett_orsak)
 * - en fil som Flöde kopplat till raden (underlag_kopplingar)
 * - en faktura som raden betalar (betalningskopplingar), egen eller inskickad
 */

async function allaSidor<T>(hamta: (fran: number, till: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const ut: T[] = [];
  for (let fran = 0; ; fran += 1000) {
    const { data, error } = await hamta(fran, fran + 999);
    if (error) throw new Error(error.message);
    ut.push(...(data ?? []));
    if ((data ?? []).length < 1000) return ut;
  }
}

// ---------- Kopplingar ----------

export interface Koppling {
  /** Vad raden är kopplad till, som det visas för kunden. */
  text: string;
  slag: 'underlag' | 'faktura' | 'dagskassa';
  /** För fakturor: hur säker matchningen är. */
  sakerhet?: 'saker' | 'trolig' | 'forslag';
}

const bankNyckel = (hash: string, id: string) => `${hash}|${id}`;

/** Varje kopplad bankrad hos kunden → vad den är kopplad till. */
export async function bankkopplingar(supabase: SupabaseClient, userId: string): Promise<Map<string, Koppling>> {
  const ut = new Map<string, Koppling>();

  const bankrader = await allaSidor<{ id: string; bank_konto_hash: string; bank_transaktion_id: string; dublett_av: string | null; dublett_orsak: string | null }>((a, b) =>
    supabase.from('transaktioner')
      .select('id, bank_konto_hash, bank_transaktion_id, dublett_av, dublett_orsak')
      .eq('user_id', userId).eq('kalla', 'bank').order('id').range(a, b));
  const nyckelFor = new Map(bankrader.map((r) => [r.id, bankNyckel(r.bank_konto_hash, r.bank_transaktion_id)]));

  // Underlagen raderna pekar på, och filerna de kommer från
  const malIdn = [...new Set(bankrader.map((r) => r.dublett_av).filter((x): x is string => !!x))];
  const { data: betalningar } = await supabase
    .from('betalningskopplingar')
    .select('konto_hash, bank_transaktion_id, transaktion_id, sakerhet, del, fakturor(faktura_nr, kund_namn)')
    .eq('user_id', userId).neq('status', 'avvisad');
  for (const b of betalningar ?? []) if (b.transaktion_id) malIdn.push(b.transaktion_id);

  const mal = new Map<string, { beskrivning: string | null; motpart: string | null; underlag_id: string | null }>();
  for (let i = 0; i < malIdn.length; i += 200) {
    const { data } = await supabase.from('transaktioner').select('id, beskrivning, motpart, underlag_id').in('id', malIdn.slice(i, i + 200));
    for (const t of data ?? []) mal.set(t.id, t);
  }

  const { data: filkopplingar } = await supabase
    .from('underlag_kopplingar').select('transaktion_id, underlag_id').eq('user_id', userId).not('transaktion_id', 'is', null);

  const filIdn = [...new Set([...mal.values()].map((t) => t.underlag_id).concat((filkopplingar ?? []).map((k) => k.underlag_id)).filter((x): x is string => !!x))];
  const filnamn = new Map<string, string>();
  for (let i = 0; i < filIdn.length; i += 200) {
    const { data } = await supabase.from('bokforing_underlag').select('id, file_name').in('id', filIdn.slice(i, i + 200));
    for (const f of data ?? []) filnamn.set(f.id, f.file_name);
  }
  const underlagText = (id: string | null | undefined) => {
    const t = id ? mal.get(id) : undefined;
    return (t?.underlag_id && filnamn.get(t.underlag_id)) || t?.beskrivning || t?.motpart || 'Underlag';
  };

  // Fakturorna först: de säger mest om vad betalningen gällde
  for (const b of (betalningar ?? []) as unknown as {
    konto_hash: string; bank_transaktion_id: string; transaktion_id: string | null; sakerhet: Koppling['sakerhet']; del: string;
    fakturor: { faktura_nr: string; kund_namn: string | null } | null;
  }[]) {
    const nyckel = bankNyckel(b.konto_hash, b.bank_transaktion_id);
    if (ut.has(nyckel)) continue;
    const text = b.fakturor
      ? `${b.del === 'skatteverket' ? 'ROT/RUT för din faktura' : 'Din faktura'} ${b.fakturor.faktura_nr}${b.fakturor.kund_namn ? ` till ${b.fakturor.kund_namn}` : ''}`
      : underlagText(b.transaktion_id);
    ut.set(nyckel, { text, slag: 'faktura', sakerhet: b.sakerhet });
  }
  for (const r of bankrader) {
    const nyckel = nyckelFor.get(r.id)!;
    if (ut.has(nyckel)) continue;
    if (r.dublett_av) ut.set(nyckel, { text: underlagText(r.dublett_av), slag: 'underlag' });
    else if (r.dublett_orsak) ut.set(nyckel, { text: r.dublett_orsak, slag: 'dagskassa' });
  }
  for (const k of filkopplingar ?? []) {
    const nyckel = nyckelFor.get(k.transaktion_id);
    if (nyckel && !ut.has(nyckel)) ut.set(nyckel, { text: filnamn.get(k.underlag_id) ?? 'Underlag', slag: 'underlag' });
  }
  return ut;
}

// ---------- Bankkonton ----------

export interface Bankkonto {
  kontoHash: string;
  namn: string | null;
  iban: string | null;
  valuta: string | null;
  bank: string | null;
  /** 'aktiv', 'utgangen', eller 'borttagen' när kopplingen tagits bort men raderna finns kvar. */
  status: 'aktiv' | 'utgangen' | 'borttagen';
  senastHamtad: string | null;
  /** Saldot efter den senaste transaktionen, när banken skickar det. */
  saldo: { belopp: number; valuta: string; datum: string } | null;
  antal: number;
  kopplade: number;
}

export interface Bankrad {
  kontoHash: string;
  transaktionId: string;
  bokforingsdag: string;
  beloppOre: number;
  valuta: string;
  text: string | null;
  motpart: string | null;
  falt: BankFalt;
  koppling: Koppling | null;
}

interface RadIn {
  konto_hash: string;
  transaktion_id: string;
  bokforingsdag: string;
  belopp_ore: number;
  valuta: string;
  text: string | null;
  motpart: string | null;
  data: EbTransaktion | null;
}

function tillBankrad(r: RadIn, egetKonto: string | null | undefined, kopplingar: Map<string, Koppling>): Bankrad {
  const falt = r.data ? bankFalt(r.data, egetKonto) : {};
  return {
    kontoHash: r.konto_hash,
    transaktionId: r.transaktion_id,
    bokforingsdag: r.bokforingsdag,
    beloppOre: r.belopp_ore,
    valuta: r.valuta,
    text: r.text,
    motpart: r.motpart ?? falt.motpart_namn ?? null,
    falt,
    koppling: kopplingar.get(bankNyckel(r.konto_hash, r.transaktion_id)) ?? null,
  };
}

async function kontonMedKopplingar(supabase: SupabaseClient, userId: string) {
  const [{ data: konton }, { data: kopplingar }] = await Promise.all([
    supabase.from('bank_konton').select('konto_hash, session_id, iban, namn, valuta').eq('user_id', userId),
    supabase.from('bank_kopplingar').select('session_id, aspsp_name, status, senast_synkad_at').eq('user_id', userId),
  ]);
  const session = new Map((kopplingar ?? []).map((k) => [k.session_id, k]));
  return (konton ?? []).map((k) => ({ ...k, koppling: session.get(k.session_id) ?? null }));
}

/** Kundens bankkonton med saldo och hur många rader som är kopplade, plus de senast kopplade raderna. */
export async function bankoversikt(supabase: SupabaseClient, userId: string, antalSenaste = 6) {
  const [konton, kopplingar] = await Promise.all([kontonMedKopplingar(supabase, userId), bankkopplingar(supabase, userId)]);
  const rader = await allaSidor<{ konto_hash: string; transaktion_id: string; bokforingsdag: string }>((a, b) =>
    supabase.from('bank_transaktioner').select('konto_hash, transaktion_id, bokforingsdag').eq('user_id', userId).order('bokforingsdag', { ascending: false }).order('transaktion_id').range(a, b));

  const ut: Bankkonto[] = [];
  for (const k of konton) {
    const egna = rader.filter((r) => r.konto_hash === k.konto_hash);
    // Saldot står på bankraderna; den senaste rad som har det gäller
    const { data: senaste } = await supabase.from('bank_transaktioner')
      .select('bokforingsdag, data').eq('user_id', userId).eq('konto_hash', k.konto_hash)
      .order('bokforingsdag', { ascending: false }).order('transaktion_id', { ascending: false }).limit(20);
    const medSaldo = (senaste ?? []).find((r) => (r.data as EbTransaktion | null)?.balance_after_transaction?.amount);
    const saldo = medSaldo ? (medSaldo.data as EbTransaktion).balance_after_transaction! : null;
    ut.push({
      kontoHash: k.konto_hash,
      namn: k.namn,
      iban: k.iban,
      valuta: k.valuta,
      bank: k.koppling?.aspsp_name ?? null,
      status: !k.koppling ? 'borttagen' : k.koppling.status === 'aktiv' ? 'aktiv' : 'utgangen',
      senastHamtad: k.koppling?.senast_synkad_at ?? null,
      saldo: saldo ? { belopp: Number(saldo.amount), valuta: saldo.currency, datum: medSaldo!.bokforingsdag } : null,
      antal: egna.length,
      kopplade: egna.filter((r) => kopplingar.has(bankNyckel(r.konto_hash, r.transaktion_id))).length,
    });
  }
  // Aktiva konton först, sedan de som behöver kopplas om, sist de borttagna
  const ordning = { aktiv: 0, utgangen: 1, borttagen: 2 };
  ut.sort((a, b) => ordning[a.status] - ordning[b.status] || b.antal - a.antal);

  const kopplade = rader.filter((r) => kopplingar.has(bankNyckel(r.konto_hash, r.transaktion_id))).slice(0, antalSenaste);
  const egetKonto = new Map(konton.map((k) => [k.konto_hash, k.iban]));
  let senaste: Bankrad[] = [];
  if (kopplade.length) {
    const { data } = await supabase.from('bank_transaktioner')
      .select('konto_hash, transaktion_id, bokforingsdag, belopp_ore, valuta, text, motpart, data')
      .eq('user_id', userId).in('transaktion_id', kopplade.map((r) => r.transaktion_id));
    senaste = ((data ?? []) as RadIn[])
      .filter((r) => kopplade.some((k) => k.konto_hash === r.konto_hash && k.transaktion_id === r.transaktion_id))
      .map((r) => tillBankrad(r, egetKonto.get(r.konto_hash), kopplingar))
      .sort((a, b) => b.bokforingsdag.localeCompare(a.bokforingsdag));
  }
  return { konton: ut, senaste };
}

/** Ett kontos alla rader, nyast först, med vad varje rad är kopplad till. Null om kontot inte är kundens. */
export async function kontotsRader(supabase: SupabaseClient, userId: string, kontoHash: string) {
  const konton = await kontonMedKopplingar(supabase, userId);
  const k = konton.find((x) => x.konto_hash === kontoHash);
  if (!k) return null;
  const [kopplingar, rader] = await Promise.all([
    bankkopplingar(supabase, userId),
    allaSidor<RadIn>((a, b) =>
      supabase.from('bank_transaktioner')
        .select('konto_hash, transaktion_id, bokforingsdag, belopp_ore, valuta, text, motpart, data')
        .eq('user_id', userId).eq('konto_hash', kontoHash)
        .order('bokforingsdag', { ascending: false }).order('transaktion_id').range(a, b)),
  ]);
  return {
    konto: {
      kontoHash: k.konto_hash, namn: k.namn, iban: k.iban, bank: k.koppling?.aspsp_name ?? null,
      status: !k.koppling ? 'borttagen' : k.koppling.status === 'aktiv' ? 'aktiv' : 'utgangen',
      senastHamtad: k.koppling?.senast_synkad_at ?? null,
    },
    rader: rader.map((r) => tillBankrad(r, k.iban, kopplingar)),
  };
}

// ---------- Året hittills ----------

export interface Arsoversikt {
  ar: number;
  fran: string;
  till: string;
  intakter: number;
  kostnader: number;
  resultat: number;
  /** Utgående minus ingående moms bokförd i år. Positivt = att betala. */
  moms: number;
  verifikationer: number;
  manader: { manad: number; intakter: number; kostnader: number }[];
}

/**
 * Året hittills ur huvudboken, räknat som byråns rapporter (admin/_rapporter):
 * debet positivt, borttagna och tillagda rader räknas inte. Intäkter är
 * klass 3, kostnaderna klass 4–8 utom bokslutets resultatkonto 8999.
 */
export async function arsoversikt(supabase: SupabaseClient, userId: string, idag = new Date()): Promise<Arsoversikt> {
  const ar = idag.getFullYear();
  const fran = `${ar}-01-01`;
  const till = idag.toISOString().slice(0, 10);
  const ver = await allaSidor<{ datum: string; verifikation_rader: { konto: string; belopp: number; borttagen: boolean; tillagd: boolean }[] }>((a, b) =>
    supabase.from('verifikationer')
      .select('datum, verifikation_rader(konto, belopp, borttagen, tillagd)')
      .eq('user_id', userId).gte('datum', fran).lte('datum', till).order('datum').order('id').range(a, b));

  const manader = Array.from({ length: 12 }, (_, i) => ({ manad: i + 1, intakter: 0, kostnader: 0 }));
  let intakter = 0;
  let kostnader = 0;
  let moms = 0;
  for (const v of ver) {
    const m = manader[Number(v.datum.slice(5, 7)) - 1];
    for (const r of v.verifikation_rader ?? []) {
      if (r.borttagen || r.tillagd) continue;
      const k = Number(r.konto);
      const b = Number(r.belopp);
      if (k >= 3000 && k <= 3999) { intakter -= b; m.intakter -= b; }
      else if (k >= 4000 && k <= 8989) { kostnader += b; m.kostnader += b; }
      else if (k >= 2610 && k <= 2649) moms -= b;
    }
  }
  const avrunda = (n: number) => Math.round(n * 100) / 100;
  return {
    ar, fran, till,
    intakter: avrunda(intakter),
    kostnader: avrunda(kostnader),
    resultat: avrunda(intakter - kostnader),
    moms: avrunda(moms),
    verifikationer: ver.length,
    manader: manader.slice(0, idag.getMonth() + 1).map((m) => ({ ...m, intakter: avrunda(m.intakter), kostnader: avrunda(m.kostnader) })),
  };
}

// ---------- Checklistan ----------

export interface Checkpunkt {
  id: 'bank' | 'ombud' | 'underlag' | 'kassa';
  klar: boolean;
  valfri?: boolean;
}

export async function checklista(supabase: SupabaseClient, userId: string): Promise<Checkpunkt[]> {
  const [profil, bank, underlag, zettle, shopify, woo] = await Promise.all([
    supabase.from('profiles').select('ombud_klart_at').eq('id', userId).maybeSingle(),
    supabase.from('bank_kopplingar').select('session_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('bokforing_underlag').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('zettle_kopplingar').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('shopify_butiker').select('shop', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('woocommerce_butiker').select('url', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  const p = profil.data;
  return [
    { id: 'bank', klar: (bank.count ?? 0) > 0 },
    { id: 'ombud', klar: !!p?.ombud_klart_at },
    { id: 'underlag', klar: (underlag.count ?? 0) > 0 },
    { id: 'kassa', klar: (zettle.count ?? 0) + (shopify.count ?? 0) + (woo.count ?? 0) > 0, valfri: true },
  ];
}
