import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { markeraDubbletter } from '../transaktioner/dubbletter';
import { matchaBetalningar } from '../betalningar/kor';
import { BankSessionUtgangen, hamtaSession, hamtaTransaktioner, type EbKonto, type EbSession, type EbTransaktion } from './enablebanking';

/**
 * Hämtar bokförda transaktioner från kundens kopplade bankkonton till
 * bank_transaktioner, och lägger in dem som vanliga rader i transaktioner
 * (kalla='bank') med troliga dubbletter flaggade. Ingenting bokförs än.
 *
 * Varje körning hämtar från några dagar före förra hämtningen, eftersom banker
 * ibland bokför med eftersläpning. Samma transaktion skrivs över, inte dubbelt.
 *
 * Utan kunden närvarande tillåter PSD2 bara fyra hämtningar per konto och dygn,
 * så synken körs en gång om morgonen och annars bara när kunden trycker.
 */

const OVERLAPP_DAGAR = 5;

function datum(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Första hämtningen: från årsskiftet förra året, så bokslutsåret kommer med. */
function forstaDatum() {
  return `${new Date().getUTCFullYear() - 1}-01-01`;
}

function tillOre(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

/**
 * Transaktionens id. Bankens referens (entry_reference) när den finns; annars
 * ett hash av innehållet plus löpnummer, så två likadana köp samma dag blir två
 * rader. Hämtningen börjar alltid vid ett dygnsskifte, så löpnumret blir
 * detsamma varje gång samma dag hämtas.
 *
 * transaction_id används inte: enligt Enable Banking är det inte unikt och kan
 * ändras mellan hämtningar, vilket gav dubbletter när överlappet hämtades om.
 */
function idn(transaktioner: EbTransaktion[]): string[] {
  const antal = new Map<string, number>();
  return transaktioner.map((t) => {
    if (t.entry_reference) return `ref:${t.entry_reference}`;
    const nyckel = createHash('sha256')
      .update(JSON.stringify([
        t.booking_date ?? t.value_date,
        t.transaction_amount.amount,
        t.transaction_amount.currency,
        t.credit_debit_indicator,
        t.remittance_information ?? [],
        t.creditor?.name ?? '',
        t.debtor?.name ?? '',
      ]))
      .digest('hex')
      .slice(0, 32);
    const n = (antal.get(nyckel) ?? 0) + 1;
    antal.set(nyckel, n);
    return `h:${nyckel}:${n}`;
  });
}

function rad(userId: string, kontoHash: string, id: string, t: EbTransaktion) {
  const inkommande = t.credit_debit_indicator === 'CRDT';
  const belopp = Math.abs(tillOre(t.transaction_amount.amount));
  return {
    user_id: userId,
    konto_hash: kontoHash,
    transaktion_id: id,
    bokforingsdag: t.booking_date ?? t.value_date ?? t.transaction_date,
    belopp_ore: inkommande ? belopp : -belopp,
    valuta: t.transaction_amount.currency,
    text: [...(t.remittance_information ?? []), t.note].filter(Boolean).join(' ').trim() || null,
    motpart: (inkommande ? t.debtor?.name : t.creditor?.name) || null,
    data: t,
    hamtad_at: new Date().toISOString(),
  };
}

/** Bankraden som en vanlig transaktion. Belopp i kronor och riktning, som AI:ns rader. */
function transaktionsrad(r: ReturnType<typeof rad>) {
  return {
    user_id: r.user_id,
    bank_konto_hash: r.konto_hash,
    bank_transaktion_id: r.transaktion_id,
    radnr: 0,
    datum: r.bokforingsdag,
    beskrivning: r.text ?? r.motpart ?? '',
    motpart: r.motpart,
    belopp: Math.abs(r.belopp_ore) / 100,
    valuta: r.valuta,
    riktning: r.belopp_ore >= 0 ? 'in' : 'ut',
    kalla: 'bank',
  };
}

/**
 * Sparar en ny session och dess konton. En äldre koppling mot samma bank ersätts.
 *
 * Banken lämnar ofta ut alla kundens konton, så kunden väljer själv hos oss
 * vilka vi läser. Ett konto vi sett förut behåller sitt val; ett nytt konto är
 * valt bara om det är bankens enda. Svarar med antalet nya konton som väntar
 * på kundens val.
 */
export async function sparaSession(
  supabase: SupabaseClient,
  userId: string,
  aspsp: { name: string; country: string },
  session: EbSession,
): Promise<{ attValja: number }> {
  const { data: gamla } = await supabase
    .from('bank_kopplingar')
    .select('session_id')
    .eq('user_id', userId)
    .eq('aspsp_name', aspsp.name)
    .eq('aspsp_country', aspsp.country);

  const { error } = await supabase.from('bank_kopplingar').insert({
    session_id: session.session_id,
    user_id: userId,
    aspsp_name: aspsp.name,
    aspsp_country: aspsp.country,
    giltig_till: session.access?.valid_until ?? null,
  });
  if (error) throw new Error(`Kunde inte spara bankkopplingen: ${error.message}`);

  const konton = session.accounts.map((k: EbKonto) => ({
    user_id: userId,
    konto_hash: k.identification_hash,
    session_id: session.session_id,
    uid: k.uid,
    iban: k.account_id?.iban ?? k.account_id?.other?.identification ?? null,
    namn: k.name || k.details || k.product || null,
    valuta: k.currency ?? null,
  }));
  let attValja = 0;
  if (konton.length) {
    const { data: kanda } = await supabase
      .from('bank_konton')
      .select('konto_hash')
      .eq('user_id', userId)
      .in('konto_hash', konton.map((k) => k.konto_hash));
    const kandaHash = new Set((kanda ?? []).map((k) => k.konto_hash));
    const nya = konton.filter((k) => !kandaHash.has(k.konto_hash));
    const gamlaKonton = konton.filter((k) => kandaHash.has(k.konto_hash));

    // synkad_till och vald lämnas orörda, så ett omkopplat konto fortsätter där det var
    if (gamlaKonton.length) {
      const { error: kontoFel } = await supabase.from('bank_konton').upsert(gamlaKonton);
      if (kontoFel) throw new Error(`Kunde inte spara bankkontona: ${kontoFel.message}`);
    }
    if (nya.length) {
      const ensamt = konton.length === 1;
      const { error: kontoFel } = await supabase.from('bank_konton').insert(nya.map((k) => ({ ...k, vald: ensamt })));
      if (kontoFel) throw new Error(`Kunde inte spara bankkontona: ${kontoFel.message}`);
      if (!ensamt) attValja = nya.length;
    }
  }

  const gamlaIdn = (gamla ?? []).map((g) => g.session_id);
  if (gamlaIdn.length) await supabase.from('bank_kopplingar').delete().in('session_id', gamlaIdn);
  return { attValja };
}

/**
 * Kunden väljer bort eller till ett konto. Bortvalt konto läses inte längre;
 * med rensa tas dess hämtade rader bort också, utom de som redan bokförts
 * (en verifikation raderas annars med raden).
 */
export async function valjKonto(
  supabase: SupabaseClient,
  userId: string,
  kontoHash: string,
  vald: boolean,
  rensa = false,
): Promise<{ borttagna: number; kvar: number }> {
  const { data, error } = await supabase
    .from('bank_konton')
    .update({ vald })
    .eq('user_id', userId)
    .eq('konto_hash', kontoHash)
    .select('konto_hash')
    .maybeSingle();
  if (error) throw new Error(`Kunde inte spara valet: ${error.message}`);
  if (!data) throw new Error('Kontot finns inte');
  if (vald || !rensa) return { borttagna: 0, kvar: 0 };

  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: rader, error: fel } = await supabase
      .from('transaktioner')
      .select('id')
      .eq('user_id', userId)
      .eq('kalla', 'bank')
      .eq('bank_konto_hash', kontoHash)
      .range(from, from + 999);
    if (fel) throw new Error(`Kunde inte läsa transaktionerna: ${fel.message}`);
    ids.push(...(rader ?? []).map((r) => r.id));
    if (!rader || rader.length < 1000) break;
  }

  const bokforda = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: ver } = await supabase.from('verifikationer').select('transaktion_id').in('transaktion_id', ids.slice(i, i + 200));
    for (const v of ver ?? []) if (v.transaktion_id) bokforda.add(v.transaktion_id);
  }

  const bort = ids.filter((id) => !bokforda.has(id));
  for (let i = 0; i < bort.length; i += 200) {
    const { error: fel } = await supabase.from('transaktioner').delete().in('id', bort.slice(i, i + 200));
    if (fel) throw new Error(`Kunde inte ta bort transaktionerna: ${fel.message}`);
  }
  // Råraderna från banken behövs inte när inga bokförda rader finns kvar
  if (!bokforda.size) {
    await supabase.from('bank_transaktioner').delete().eq('user_id', userId).eq('konto_hash', kontoHash);
  }
  // Väljs kontot till igen hämtas allt på nytt; bokförda rader skrivs över, inte dubbelt
  await supabase.from('bank_konton').update({ synkad_till: null }).eq('user_id', userId).eq('konto_hash', kontoHash);
  return { borttagna: bort.length, kvar: bokforda.size };
}

async function synkaKonto(
  supabase: SupabaseClient,
  userId: string,
  konto: { konto_hash: string; uid: string; synkad_till: string | null },
  dagarBakat?: number,
) {
  let fran = konto.synkad_till ?? forstaDatum();
  if (konto.synkad_till) {
    // Hämta nu går längre bakåt än morgonens synk (se synkaBank)
    const d = dagarBakat ? new Date() : new Date(`${konto.synkad_till}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (dagarBakat ?? OVERLAPP_DAGAR));
    fran = datum(d);
  }

  let transaktioner: EbTransaktion[];
  try {
    transaktioner = await hamtaTransaktioner(konto.uid, fran);
  } catch (err) {
    // Många banker lämnar bara ut 90 dagar bakåt; första gången provas det i stället
    if (konto.synkad_till || err instanceof BankSessionUtgangen) throw err;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 89);
    transaktioner = await hamtaTransaktioner(konto.uid, datum(d));
  }

  const bokforda = transaktioner.filter((t) => (t.status ?? 'BOOK') === 'BOOK' && (t.booking_date || t.value_date || t.transaction_date));
  const ids = idn(bokforda);
  const rader = bokforda.map((t, i) => rad(userId, konto.konto_hash, ids[i], t));

  for (let i = 0; i < rader.length; i += 500) {
    const { error } = await supabase.from('bank_transaktioner').upsert(rader.slice(i, i + 500));
    if (error) throw new Error(`Kunde inte spara transaktionerna: ${error.message}`);
  }

  // Samma rader i transaktioner, bredvid det AI:n läst ur underlagen
  const vanliga = rader.map(transaktionsrad);
  for (let i = 0; i < vanliga.length; i += 500) {
    const { error } = await supabase
      .from('transaktioner')
      .upsert(vanliga.slice(i, i + 500), { onConflict: 'user_id,bank_konto_hash,bank_transaktion_id' });
    if (error) throw new Error(`Kunde inte lägga in transaktionerna: ${error.message}`);
  }

  await supabase
    .from('bank_konton')
    .update({ synkad_till: datum(new Date()) })
    .eq('user_id', userId)
    .eq('konto_hash', konto.konto_hash);
  return rader.length;
}

async function antalBankrader(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from('bank_transaktioner')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return error ? null : count;
}

/**
 * Hämtar alla aktiva kopplingar för en kund. Svarar med hur många rader som
 * hämtades (överlappet räknas med), hur många av dem som var nya och hur många
 * kunden har totalt. nya och totalt är null om de inte gick att räkna.
 *
 * dagarBakat: hämta så många dagar bakåt från i dag i stället för några dagar
 * före förra hämtningen. Hämta nu använder 90 dagar, eftersom vissa banker
 * (Södra Hestra Sparbank) skickar fler uppgifter vid korta hämtningar än i den
 * långa första. Ett konto som aldrig hämtats får ändå den långa första hämtningen.
 * Obs: raderna som redan finns i den långa hämtningens format sparas då en
 * gång till, eftersom de får ett annat id — det är inte löst än.
 */
export async function synkaBank(supabase: SupabaseClient, userId: string, { dagarBakat }: { dagarBakat?: number } = {}) {
  const fore = await antalBankrader(supabase, userId);
  const { data: kopplingar, error } = await supabase
    .from('bank_kopplingar')
    .select('session_id, giltig_till')
    .eq('user_id', userId)
    .eq('status', 'aktiv');
  if (error) throw new Error(`Kunde inte läsa bankkopplingarna: ${error.message}`);

  let transaktioner = 0;
  const fel: string[] = [];
  for (const k of kopplingar ?? []) {
    try {
      if (k.giltig_till && new Date(k.giltig_till).getTime() < Date.now()) throw new BankSessionUtgangen('Bankens medgivande har gått ut');
      const session = await hamtaSession(k.session_id);
      if (session.status && session.status !== 'AUTHORIZED') throw new BankSessionUtgangen(`Sessionen är ${session.status}`);

      const { data: konton } = await supabase
        .from('bank_konton')
        .select('konto_hash, uid, synkad_till')
        .eq('session_id', k.session_id)
        .eq('vald', true);
      for (const konto of konton ?? []) {
        if (konto.uid) transaktioner += await synkaKonto(supabase, userId, konto, dagarBakat);
      }
      await supabase
        .from('bank_kopplingar')
        .update({ senast_synkad_at: new Date().toISOString(), senaste_fel: null })
        .eq('session_id', k.session_id);
    } catch (err) {
      const utgangen = err instanceof BankSessionUtgangen;
      const text = utgangen ? 'Bankens medgivande har gått ut. Koppla om banken.' : err instanceof Error ? err.message : String(err);
      fel.push(text);
      await supabase
        .from('bank_kopplingar')
        .update({ senaste_fel: text.slice(0, 500), ...(utgangen ? { status: 'utgangen' } : {}) })
        .eq('session_id', k.session_id);
    }
  }

  // Nya bankrader kan betala kundens fakturor. Ett fel här stoppar inte
  // synken och visas inte för kunden — kopplingarna räknas om nästa gång.
  // Den körs före dubblettmarkeringen, som kopplar betalningen till fakturans transaktion.
  try {
    await matchaBetalningar(supabase, userId);
  } catch (err) {
    console.error('[bank] betalningsmatchningen misslyckades för', userId, err);
  }
  try {
    await markeraDubbletter(supabase, userId);
  } catch (err) {
    fel.push(err instanceof Error ? err.message : String(err));
  }
  const totalt = await antalBankrader(supabase, userId);
  const nya = fore !== null && totalt !== null ? Math.max(0, totalt - fore) : null;
  return { transaktioner, nya, totalt, fel };
}

export async function synkaAllaBanker(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('bank_kopplingar').select('user_id').eq('status', 'aktiv');
  if (error) throw new Error(`Kunde inte läsa bankkopplingar: ${error.message}`);
  const out = { synkade: 0, fel: 0 };
  for (const user_id of new Set((data ?? []).map((d) => d.user_id))) {
    try {
      const r = await synkaBank(supabase, user_id);
      if (r.fel.length) out.fel++;
      else out.synkade++;
    } catch (err) {
      console.error('[bank] synk misslyckades för', user_id, err);
      out.fel++;
    }
  }
  return out;
}
