import { createClient } from '@/lib/supabase';

export type Transaktion = {
  id: string;
  haendelse_typ: string;
  datum: string;
  beskrivning: string;
  belopp: number;
  moms: number;
  ai_debit_konto: string | null;
  ai_debit_namn: string | null;
  ai_kredit_konto: string | null;
  ai_kredit_namn: string | null;
  ai_momsats: string | null;
  ai_kategori: string | null;
};

export async function hämtaTransaktioner(year: number): Promise<Transaktion[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('bokforing_transaktioner')
    .select('id, haendelse_typ, datum, beskrivning, belopp, moms, ai_debit_konto, ai_debit_namn, ai_kredit_konto, ai_kredit_namn, ai_momsats, ai_kategori')
    .eq('user_id', user.id)
    .gte('datum', `${year}-01-01`)
    .lte('datum', `${year}-12-31`)
    .order('datum', { ascending: false });

  return (data as Transaktion[]) ?? [];
}

export function filterMånad(transaktioner: Transaktion[], month: number): Transaktion[] {
  if (month === 0) return transaktioner;
  const m = String(month).padStart(2, '0');
  return transaktioner.filter(t => t.datum.slice(5, 7) === m);
}

export function netto(t: Transaktion): number {
  return t.belopp - t.moms;
}

const INTÄKT_TYPER = ['kund-betalat'];
const KOSTNAD_TYPER = ['kopt-nagot', 'skatteverket'];

export function isIntäkt(t: Transaktion): boolean {
  return INTÄKT_TYPER.includes(t.haendelse_typ) ||
    (!KOSTNAD_TYPER.includes(t.haendelse_typ) && (t.ai_kredit_konto?.startsWith('3') ?? false));
}

export function isKostnad(t: Transaktion): boolean {
  return KOSTNAD_TYPER.includes(t.haendelse_typ) ||
    (!INTÄKT_TYPER.includes(t.haendelse_typ) && /^[4567]/.test(t.ai_debit_konto ?? ''));
}

// ── Resultat ──────────────────────────────────────────────────────────────────

export type ResultatData = {
  intäkterRader: Array<{ konto: string; namn: string; belopp: number }>;
  kostnadRader: Array<{ konto: string; namn: string; belopp: number }>;
  sumIntäkter: number;
  sumKostnader: number;
  rörelseresultat: number;
};

export function beräknaResultat(transaktioner: Transaktion[]): ResultatData {
  const intMap: Record<string, { namn: string; belopp: number }> = {};
  const kostMap: Record<string, { namn: string; belopp: number }> = {};

  for (const t of transaktioner) {
    const n = netto(t);
    if (isIntäkt(t)) {
      const k = t.ai_kredit_konto ?? '3000';
      const namn = t.ai_kredit_namn ?? 'Försäljning';
      if (!intMap[k]) intMap[k] = { namn, belopp: 0 };
      intMap[k].belopp += n;
    } else if (isKostnad(t)) {
      const k = t.ai_debit_konto ?? '6000';
      const namn = t.ai_debit_namn ?? 'Övriga kostnader';
      if (!kostMap[k]) kostMap[k] = { namn, belopp: 0 };
      kostMap[k].belopp += n;
    }
  }

  const intäkterRader = Object.entries(intMap)
    .map(([konto, v]) => ({ konto, ...v }))
    .sort((a, b) => a.konto.localeCompare(b.konto));

  const kostnadRader = Object.entries(kostMap)
    .map(([konto, v]) => ({ konto, ...v }))
    .sort((a, b) => a.konto.localeCompare(b.konto));

  const sumIntäkter = intäkterRader.reduce((s, r) => s + r.belopp, 0);
  const sumKostnader = kostnadRader.reduce((s, r) => s + r.belopp, 0);

  return { intäkterRader, kostnadRader, sumIntäkter, sumKostnader, rörelseresultat: sumIntäkter - sumKostnader };
}

// ── Moms ──────────────────────────────────────────────────────────────────────

export type MomsData = {
  utgående25: { underlag: number; moms: number };
  utgående12: { underlag: number; moms: number };
  utgående6:  { underlag: number; moms: number };
  sumUtgående: number;
  ingående: number;
  netto: number;
};

export function beräknaMoms(transaktioner: Transaktion[]): MomsData {
  let u25u = 0, u25m = 0;
  let u12u = 0, u12m = 0;
  let u6u  = 0, u6m  = 0;
  let ing  = 0;

  for (const t of transaktioner) {
    if (t.haendelse_typ === 'kund-betalat') {
      const sats = t.ai_momsats ?? '';
      const n = netto(t);
      if (sats.includes('12')) { u12u += n; u12m += t.moms; }
      else if (sats.includes('6')) { u6u += n; u6m += t.moms; }
      else { u25u += n; u25m += t.moms; }
    } else if (t.haendelse_typ === 'kopt-nagot') {
      ing += t.moms;
    }
  }

  const sumUtgående = u25m + u12m + u6m;
  return {
    utgående25: { underlag: u25u, moms: u25m },
    utgående12: { underlag: u12u, moms: u12m },
    utgående6:  { underlag: u6u,  moms: u6m  },
    sumUtgående,
    ingående: ing,
    netto: sumUtgående - ing,
  };
}

// ── Kontosaldo ────────────────────────────────────────────────────────────────

export type Kontorad = {
  konto: string;
  namn: string;
  debet: number;
  kredit: number;
  saldo: number;
};

export function beräknaKontosaldo(transaktioner: Transaktion[]): Kontorad[] {
  const konton: Record<string, { namn: string; debet: number; kredit: number }> = {};

  function add(konto: string | null, namn: string | null, side: 'debet' | 'kredit', amount: number) {
    if (!konto || amount === 0) return;
    if (!konton[konto]) konton[konto] = { namn: namn ?? konto, debet: 0, kredit: 0 };
    konton[konto][side] += amount;
    if (namn && konton[konto].namn === konto) konton[konto].namn = namn;
  }

  for (const t of transaktioner) {
    const n = netto(t);

    if (isIntäkt(t)) {
      // Dr bank(belopp), Cr income(netto), Cr VAT(moms)
      add(t.ai_debit_konto, t.ai_debit_namn, 'debet', t.belopp);
      add(t.ai_kredit_konto, t.ai_kredit_namn, 'kredit', n);
      if (t.moms > 0) add('2610', 'Utgående moms', 'kredit', t.moms);
    } else if (isKostnad(t)) {
      // Dr expense(netto), Dr VAT(moms), Cr bank(belopp)
      add(t.ai_debit_konto, t.ai_debit_namn, 'debet', n);
      if (t.moms > 0) add('2641', 'Ingående moms', 'debet', t.moms);
      add(t.ai_kredit_konto, t.ai_kredit_namn, 'kredit', t.belopp);
    } else {
      // privat-pengar, ovrigt etc — post as-is
      add(t.ai_debit_konto, t.ai_debit_namn, 'debet', t.belopp);
      add(t.ai_kredit_konto, t.ai_kredit_namn, 'kredit', t.belopp);
    }
  }

  return Object.entries(konton).map(([konto, v]) => {
    const klass = konto[0];
    const debetNormal = ['1', '4', '5', '6', '7'].includes(klass);
    const saldo = debetNormal ? v.debet - v.kredit : v.kredit - v.debet;
    return { konto, namn: v.namn, debet: v.debet, kredit: v.kredit, saldo };
  }).sort((a, b) => a.konto.localeCompare(b.konto));
}

// ── NE-bilaga radvärden ───────────────────────────────────────────────────────

export type NERader = {
  R1: number;  // Nettoomsättning
  R4: number;  // Råvaror och förnödenheter
  R5: number;  // Handelsvaror
  R6: number;  // Övriga externa kostnader
  R7: number;  // Personalkostnader
  R8: number;  // Av- och nedskrivningar
  R9: number;  // Övriga rörelsekostnader
  R10: number; // Rörelseresultat
  R11: number; // Finansiella intäkter
  R12: number; // Finansiella kostnader
  R13: number; // Resultat efter finansiella poster
};

export function beräknaNE(transaktioner: Transaktion[]): NERader {
  let R1 = 0, R4 = 0, R5 = 0, R6 = 0, R7 = 0, R8 = 0, R9 = 0, R11 = 0, R12 = 0;

  for (const t of transaktioner) {
    const n = netto(t);

    if (isIntäkt(t)) {
      R1 += n;
    } else if (isKostnad(t)) {
      const k = t.ai_debit_konto ?? '';
      if (k.startsWith('4') && parseInt(k) < 4600) R4 += n;
      else if (k.startsWith('4')) R5 += n;
      else if (k.startsWith('5') || k.startsWith('6')) R6 += n;
      else if (k.startsWith('7')) R7 += n;
      else if (k.startsWith('8') && parseInt(k) < 8400) R11 -= n;
      else if (k.startsWith('8')) R12 += n;
      else R6 += n; // default unknown costs to R6
    }
  }

  const R10 = R1 - R4 - R5 - R6 - R7 - R8 - R9;
  const R13 = R10 + R11 - R12;

  return { R1, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13 };
}

export function fmtKr(v: number): string {
  return v.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr';
}
