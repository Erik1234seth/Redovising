import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { markeraDubbletter } from '../transaktioner/dubbletter';
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
 * Transaktionens id. Bankens referens när den finns; annars ett hash av
 * innehållet plus löpnummer, så två likadana köp samma dag blir två rader.
 * Hämtningen börjar alltid vid ett dygnsskifte, så löpnumret blir detsamma
 * varje gång samma dag hämtas.
 */
function idn(transaktioner: EbTransaktion[]): string[] {
  const antal = new Map<string, number>();
  return transaktioner.map((t) => {
    const ref = t.entry_reference || t.transaction_id;
    if (ref) return `ref:${ref}`;
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

/** Sparar en ny session och dess konton. En äldre koppling mot samma bank ersätts. */
export async function sparaSession(
  supabase: SupabaseClient,
  userId: string,
  aspsp: { name: string; country: string },
  session: EbSession,
) {
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
  if (konton.length) {
    // synkad_till lämnas orörd, så ett omkopplat konto fortsätter där det var
    const { error: kontoFel } = await supabase.from('bank_konton').upsert(konton);
    if (kontoFel) throw new Error(`Kunde inte spara bankkontona: ${kontoFel.message}`);
  }

  const gamlaIdn = (gamla ?? []).map((g) => g.session_id);
  if (gamlaIdn.length) await supabase.from('bank_kopplingar').delete().in('session_id', gamlaIdn);
}

async function synkaKonto(supabase: SupabaseClient, userId: string, konto: { konto_hash: string; uid: string; synkad_till: string | null }) {
  let fran = konto.synkad_till ?? forstaDatum();
  if (konto.synkad_till) {
    const d = new Date(`${konto.synkad_till}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - OVERLAPP_DAGAR);
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

/** Hämtar alla aktiva kopplingar för en kund. Svarar med antal transaktioner. */
export async function synkaBank(supabase: SupabaseClient, userId: string) {
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
        .eq('session_id', k.session_id);
      for (const konto of konton ?? []) {
        if (konto.uid) transaktioner += await synkaKonto(supabase, userId, konto);
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

  try {
    await markeraDubbletter(supabase, userId);
  } catch (err) {
    fel.push(err instanceof Error ? err.message : String(err));
  }
  return { transaktioner, fel };
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
