import type { SupabaseClient } from '@supabase/supabase-js';
import { MANADER_EFTER_FORFALLO, SKATTEVERKET_MANADER, DAGAR_FORE_FAKTURADATUM, matcha, type Beslut, type Koppling, type MatchBankrad, type MatchFaktura } from './matcha';

/**
 * Kör matchningen för en kund och sparar resultatet i betalningskopplingar.
 *
 * Kopplingar med status 'auto' räknas om från början varje gång, så en ny
 * bankrad eller en ändrad faktura slår igenom. Byråns beslut ('bekraftad' och
 * 'avvisad') står kvar och styr matchningen: en avvisad koppling föreslås inte
 * igen, och en bekräftad räknas som betald.
 *
 * Två sorters fakturor matchas i samma körning, så att en bankrad bara kan
 * betala en av dem:
 *   A  kundens egna fakturor (fakturor)            → faktura_id
 *   B  inskickade leverantörsfakturor (transaktioner, riktning ut) → transaktion_id
 *   C  inskickade kundfakturor från andra system (transaktioner, riktning in)
 */

interface FakturaRad {
  id: string;
  faktura_nr: string;
  kund_namn: string | null;
  faktura_datum: string;
  forfallo_datum: string | null;
  belopp_inkl_moms: number;
  husavdrag: { avdrag?: number; att_betala?: number } | null;
  valuta: string | null;
  status: string;
}

interface BankRad {
  konto_hash: string;
  transaktion_id: string;
  bokforingsdag: string;
  belopp_ore: number;
  text: string | null;
  motpart: string | null;
}

interface TransaktionRad {
  id: string;
  datum: string | null;
  belopp: number;
  valuta: string | null;
  riktning: 'in' | 'ut';
  motpart: string | null;
  uppgifter: Record<string, unknown> | null;
  kalla: string;
}

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const datumUr = (v: unknown) => (typeof v === 'string' && DATUM.test(v.trim()) ? v.trim() : undefined);
const textUr = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() || undefined : undefined);

/**
 * En inskickad faktura som AI:n läst ut. Fakturadatumet ur underlaget, annars
 * transaktionens datum; förfallodagen ur underlaget, annars fakturadatumet
 * (då slutar fönstret en månad efter fakturadatumet). Null utan datum eller
 * belopp — då finns inget att matcha mot.
 */
function franTransaktion(t: TransaktionRad): MatchFaktura | null {
  const u = t.uppgifter ?? {};
  const fakturadatum = datumUr(u.fakturadatum) ?? datumUr(t.datum);
  const belopp = Number(t.belopp);
  if (!fakturadatum || !(belopp > 0)) return null;
  const forfallo = datumUr(u.forfallodatum);
  return {
    id: t.id,
    nr: textUr(u.fakturanummer) ?? '',
    ocr: textUr(u.ocr),
    motpart: t.motpart ?? '',
    fakturadatum,
    forfallodatum: forfallo && forfallo >= fakturadatum ? forfallo : fakturadatum,
    betaldatum: datumUr(u.betaldatum),
    belopp,
    valuta: t.valuta || 'SEK',
    avdrag: 0,
    riktning: t.riktning === 'in' ? 'in' : 'ut',
  };
}

function tillMatchFaktura(f: FakturaRad): MatchFaktura {
  const avdrag = Number(f.husavdrag?.avdrag ?? 0);
  const attBetala = f.husavdrag?.att_betala != null ? Number(f.husavdrag.att_betala) : Number(f.belopp_inkl_moms);
  return {
    id: f.id,
    nr: f.faktura_nr ?? '',
    motpart: f.kund_namn ?? '',
    fakturadatum: f.faktura_datum,
    forfallodatum: f.forfallo_datum ?? f.faktura_datum,
    belopp: attBetala,
    valuta: f.valuta || 'SEK',
    avdrag: avdrag > 0 ? avdrag : 0,
    riktning: 'in',
  };
}

async function allaSidor<T>(hamta: (fran: number, till: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const ut: T[] = [];
  for (let fran = 0; ; fran += 1000) {
    const { data, error } = await hamta(fran, fran + 999);
    if (error) throw new Error(error.message);
    ut.push(...(data ?? []));
    if ((data ?? []).length < 1000) return ut;
  }
}

/** Valutakurserna som kan behövas, som en uppslagsfunktion: närmast föregående bankdag. */
async function kurser(supabase: SupabaseClient, valutor: string[], fran: string, till: string) {
  const perValuta = new Map<string, { datum: string; sek: number }[]>();
  if (valutor.length) {
    const rader = await allaSidor<{ valuta: string; datum: string; sek: number }>((a, b) =>
      supabase.from('valutakurser').select('valuta, datum, sek').in('valuta', valutor).gte('datum', fran).lte('datum', till).order('datum').range(a, b));
    for (const r of rader) {
      const lista = perValuta.get(r.valuta) ?? [];
      lista.push({ datum: r.datum, sek: Number(r.sek) });
      perValuta.set(r.valuta, lista);
    }
  }
  return (valuta: string, datum: string) => {
    const lista = perValuta.get(valuta.toUpperCase());
    if (!lista) return null;
    let basta: { datum: string; sek: number } | null = null;
    for (const r of lista) {
      if (r.datum > datum) break;
      basta = r;
    }
    // Samma gräns som valutakurs(): högst en vecka gammal
    if (!basta || Date.parse(datum) - Date.parse(basta.datum) > 7 * 86_400_000) return null;
    return basta.sek;
  };
}

export async function matchaBetalningar(supabase: SupabaseClient, userId: string): Promise<{ kopplingar: number }> {
  const egna = (await allaSidor<FakturaRad>((a, b) =>
    supabase.from('fakturor')
      .select('id, faktura_nr, kund_namn, faktura_datum, forfallo_datum, belopp_inkl_moms, husavdrag, valuta, status')
      .eq('user_id', userId).eq('dokumenttyp', 'faktura').order('id').range(a, b)))
    .filter((f) => f.faktura_datum)
    .map(tillMatchFaktura);
  const egnaIdn = new Set(egna.map((f) => f.id));

  // Inskickade fakturor (B och C): transaktioner som AI:n läst ur kundens underlag
  const inskickade = (await allaSidor<TransaktionRad>((a, b) =>
    supabase.from('transaktioner')
      .select('id, datum, belopp, valuta, riktning, motpart, uppgifter, kalla')
      .eq('user_id', userId).is('dublett_av', null).not('kalla', 'in', '(bank,woocommerce)')
      .ilike('uppgifter->>dokumenttyp', '%faktura%')
      .order('id').range(a, b)))
    .map(franTransaktion)
    .filter((f): f is MatchFaktura => !!f);
  const fakturor = [...egna, ...inskickade];

  const { data: beslutRader, error: beslutFel } = await supabase
    .from('betalningskopplingar')
    .select('faktura_id, transaktion_id, konto_hash, bank_transaktion_id, del, belopp, status')
    .eq('user_id', userId).in('status', ['bekraftad', 'avvisad']);
  if (beslutFel) throw new Error(`Kunde inte läsa betalningskopplingarna: ${beslutFel.message}`);
  const beslut: Beslut[] = (beslutRader ?? []).map((r) => ({
    fakturaId: r.faktura_id ?? r.transaktion_id, kontoHash: r.konto_hash, bankId: r.bank_transaktion_id, del: r.del, belopp: Number(r.belopp), status: r.status,
  }));

  let kopplingar: Koppling[] = [];
  if (fakturor.length) {
    const fran = fakturor.reduce((m, f) => (f.fakturadatum < m ? f.fakturadatum : m), fakturor[0].fakturadatum);
    const senast = fakturor.reduce((m, f) => (f.forfallodatum > m ? f.forfallodatum : m), fakturor[0].forfallodatum);
    const franDag = new Date(`${fran}T00:00:00Z`);
    franDag.setUTCDate(franDag.getUTCDate() - DAGAR_FORE_FAKTURADATUM);
    const tillDag = new Date(`${senast}T00:00:00Z`);
    tillDag.setUTCMonth(tillDag.getUTCMonth() + Math.max(MANADER_EFTER_FORFALLO, SKATTEVERKET_MANADER) + 1);

    const bank: MatchBankrad[] = (await allaSidor<BankRad>((a, b) =>
      supabase.from('bank_transaktioner')
        .select('konto_hash, transaktion_id, bokforingsdag, belopp_ore, text, motpart')
        .eq('user_id', userId).gte('bokforingsdag', ISO(franDag)).lte('bokforingsdag', ISO(tillDag))
        .order('bokforingsdag').order('transaktion_id').range(a, b)))
      .map((r) => ({
        kontoHash: r.konto_hash,
        id: r.transaktion_id,
        datum: r.bokforingsdag,
        belopp: r.belopp_ore / 100,
        text: [r.text, r.motpart].filter(Boolean).join(' '),
      }));

    const valutor = [...new Set(fakturor.map((f) => f.valuta.toUpperCase()).filter((v) => v !== 'SEK'))];
    const kursFor = await kurser(supabase, valutor, ISO(new Date(franDag.getTime() - 7 * 86_400_000)), ISO(tillDag));
    kopplingar = matcha(fakturor, bank, beslut, kursFor);
  }

  // Byråns beslut står kvar; allt automatiskt ersätts
  const { error: delFel } = await supabase.from('betalningskopplingar')
    .delete().eq('user_id', userId).eq('status', 'auto');
  if (delFel) throw new Error(`Kunde inte rensa betalningskopplingarna: ${delFel.message}`);

  const beslutade = new Set(beslut.map((b) => `${b.fakturaId}|${b.kontoHash}|${b.bankId}|${b.del}`));
  const nya = kopplingar
    .filter((k) => !beslutade.has(`${k.fakturaId}|${k.kontoHash}|${k.bankId}|${k.del}`))
    .map((k) => ({
      user_id: userId,
      faktura_id: egnaIdn.has(k.fakturaId) ? k.fakturaId : null,
      transaktion_id: egnaIdn.has(k.fakturaId) ? null : k.fakturaId,
      konto_hash: k.kontoHash,
      bank_transaktion_id: k.bankId,
      bank_datum: k.bankDatum,
      bank_belopp: k.bankBelopp,
      belopp: k.belopp,
      del: k.del,
      typ: k.typ,
      grund: k.grund,
      sakerhet: k.sakerhet,
      avvikelse: k.avvikelse,
      kommentar: k.kommentar,
      status: 'auto',
    }));
  for (let i = 0; i < nya.length; i += 500) {
    const { error } = await supabase.from('betalningskopplingar').insert(nya.slice(i, i + 500));
    if (error) throw new Error(`Kunde inte spara betalningskopplingarna: ${error.message}`);
  }
  return { kopplingar: nya.length };
}
