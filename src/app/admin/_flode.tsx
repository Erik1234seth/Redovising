'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { momsText, type Momsdel, type Omvand } from '@/lib/kontering/momsdelar';
import { kr } from './_verifikationer';
import { KontoLank } from './_k1-konto';

/**
 * Flöde — konteringen sedan 2026-11-07: en modell (GPT-6.1 Sol eller Claude
 * Opus 5.5) får alla valda underlag i ett anrop och sorterar, läser ut, letar
 * dubbletter, säger vad som saknas och konterar (@/lib/kontering/omgang).
 *
 * Med "båda" körs samma underlag också med den andra modellen som jämförelse.
 * Jämförelsen bokförs inte; dess "Förut" visar huvudmodellens kontering, och
 * byrån kan bokföra jämförelsen i stället.
 *
 * Svaret skrivs till bokföringen: transaktionerna och konteringarna ersätts,
 * gröna blir verifikationer direkt och gula när byrån godkänt dem här
 * eller valt konto i Kontering. Resultatet visas rad för rad, med det som fanns
 * förut bredvid.
 */

interface Underlag {
  id: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
  sortering: string | null;
  sortering_orsak: string | null;
  del_av: string | null;
  transaktioner: number;
  flode_at: string | null;
  /** Kunden har mejlat om filen, eller skickat en sida till den. */
  kund_svar_at: string | null;
}

/** Kunden har skickat något nytt om filen sedan den lästes i Flöde. */
const nyttFranKunden = (u: Underlag) => !!u.kund_svar_at && (!u.flode_at || u.kund_svar_at > u.flode_at);

interface Flagga { typ: string; allvar: 'stopp' | 'granskning'; text: string }

interface Tx {
  nr: number;
  datum: string | null;
  beskrivning: string;
  motpart: string;
  belopp: number;
  moms: number;
  valuta: string;
  riktning: 'in' | 'ut';
  vat_nummer: string;
  anteckning: string;
  uppgifter: Record<string, unknown>;
  kronor: { belopp: number; moms: number | null; kurs: number } | null;
  dublett: { status: 'unik' | 'tveksam' | 'dublett'; ref: string; refText?: string; motivering: string };
  saknas: { vad: string; varfor: string }[];
  antaganden: string;
  kontering: {
    konto: string | null;
    kontonamn: string;
    momssats: number | null;
    momsdelar: Momsdel[] | null;
    omvand: Omvand | null;
    motivering: string;
    regler: string[];
    flaggor: Flagga[];
    omdome: 'gron' | 'gul' | 'rod';
    sakerhet: 'hog' | 'medel' | 'lag';
    momshantering: string;
  } | null;
  verifikation: { konto: string; kontonamn: string; belopp: number }[] | null;
  /** Faktureringsmetoden: fakturans datum och betalningen som egen verifikation. */
  faktura?: { datum: string; betalning: { datum: string; rader: { konto: string; kontonamn: string; belopp: number }[] } } | null;
  fel: string | null;
  godkand?: { at: string } | null;
  /** Byrån har ändrat transaktionen här och bokfört den med sitt val. */
  andrad?: { at: string } | null;
  transaktionId?: string;
  /** Samma affär som något som redan fanns: filen kopplades dit i stället för att bli en egen transaktion. */
  kopplad?: string;
}

interface Gammal {
  id: string;
  datum: string | null;
  belopp: number;
  valuta: string | null;
  riktning: 'in' | 'ut';
  motpart: string | null;
  beskrivning: string | null;
  dublett: boolean;
  forslag: { modell: string; konto: string | null; momssats: number | null; omdome: string }[];
  vald: string | null;
  bokfort: string[];
}

interface Fil {
  fil: string;
  underlagId: string;
  namn: string;
  sort: string | null;
  vad: string;
  delAv: string;
  transaktioner: Tx[];
  gammalt: Gammal[];
  skrivet?: string;
}

interface Hoppad { underlagId: string; namn: string; orsak: string; varning: boolean }

interface Resultat {
  filer: Fil[];
  anteckningar: string[];
  kontroller: string[];
  hoppade: Hoppad[];
}

interface Provrad {
  id: string;
  created_at: string;
  korning: string;
  del: number;
  delar: number;
  status: 'forbereder' | 'skickad' | 'tar-emot' | 'klar' | 'fel';
  modell: string;
  /** Jämförelse med den körningen: inte bokförd. */
  jamfor_med: string | null;
  underlag_ids: string[];
  varningar: Hoppad[];
  resultat: Resultat | null;
  /** OpenAI: cachen ingår i input_tokens. Claude: cachen står för sig, och tänkandet heter thinking_tokens. */
  usage: {
    input_tokens?: number; output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number; thinking_tokens?: number };
    cache_read_input_tokens?: number; cache_creation_input_tokens?: number;
  } | null;
  kostnad_usd: number | null;
  uppskattade_tokens: number | null;
  fel: string | null;
  klar_at: string | null;
}

/** Ungefärlig kurs för att visa kostnaden i kronor. */
const USD_SEK = 9.88;
/** Kronor per underlag, ungefär — visas innan körningen startar. Claude körs i batch till halva priset. */
const KR_PER_UNDERLAG: Record<string, number> = { 'gpt-6.1-sol': 0.25, 'claude-opus-5-5': 0.15 };

/** Vad Kör Flöde kör med: modellen som bokför, och om den andra körs som jämförelse. */
const VAL = {
  gpt: { modell: 'gpt-6.1-sol', jamfor: false, text: 'GPT-6.1 Sol' },
  claude: { modell: 'claude-opus-5-5', jamfor: false, text: 'Claude Opus 5.5' },
  'gpt+claude': { modell: 'gpt-6.1-sol', jamfor: true, text: 'Båda — GPT bokför, Claude jämförs' },
  'claude+gpt': { modell: 'claude-opus-5-5', jamfor: true, text: 'Båda — Claude bokför, GPT jämförs' },
} as const;
type Val = keyof typeof VAL;
const VAL_NYCKEL = 'flode-modell';
const prisFor = (v: Val, antal: number) => {
  const andra = VAL[v].modell === 'gpt-6.1-sol' ? 'claude-opus-5-5' : 'gpt-6.1-sol';
  return Math.max(1, Math.round(antal * (KR_PER_UNDERLAG[VAL[v].modell] + (VAL[v].jamfor ? KR_PER_UNDERLAG[andra] : 0))));
};
type Godkann = (radId: string, fil: string, nr: number, godkand: boolean) => Promise<void>;

const VANTANDE = new Set(['forbereder', 'skickad', 'tar-emot']);

const TID = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const SORT: Record<string, string> = { underlag: 'Underlag', kontoutdrag: 'Kontoutdrag', verifikationer: 'Redan bokfört', ovrigt: 'Övrigt' };
const SAKERHET: Record<string, string> = { hog: 'hög', medel: 'medel', lag: 'låg' };
const OMDOME: Record<string, { prick: string; text: string }> = {
  gron: { prick: 'bg-emerald-400', text: 'Grön' },
  gul: { prick: 'bg-amber-400', text: 'Granska' },
  rod: { prick: 'bg-red-500', text: 'Stopp' },
};
const MODELL: Record<string, string> = { 'gpt-6.1-sol': 'Sol', 'claude-opus-5-5': 'Opus', 'gpt-6-astra': 'Astra', 'gpt-5.5': 'GPT-5.5' };
const MODELLNAMN: Record<string, string> = { 'gpt-6.1-sol': 'GPT-6.1 Sol', 'claude-opus-5-5': 'Claude Opus 5.5' };

/** Körningen är en jämförelse: inget är bokfört, så inget kan godkännas. */
const ArJamforelse = createContext(false);

/** Tokens i ett anrop, oavsett leverantör: allt in, varav cachat, ut och varav tänkande. */
function tokenrad(u: NonNullable<Provrad['usage']>): string {
  const claude = u.cache_read_input_tokens !== undefined || u.cache_creation_input_tokens !== undefined;
  const cachat = claude ? (u.cache_read_input_tokens ?? 0) : (u.input_tokens_details?.cached_tokens ?? 0);
  const inn = (u.input_tokens ?? 0) + (claude ? cachat + (u.cache_creation_input_tokens ?? 0) : 0);
  const tank = u.output_tokens_details?.thinking_tokens ?? u.output_tokens_details?.reasoning_tokens ?? 0;
  const sv = (n: number) => n.toLocaleString('sv-SE');
  return `${sv(inn)} in (${sv(cachat)} cachade) · ${sv(u.output_tokens ?? 0)} ut, varav ${sv(tank)} tänkande`;
}

function filLank(id: string) {
  return `/api/admin/underlag/${id}/ladda-ner?visa`;
}

/** Transaktionen i ord, så att AI:n vet vilken i filen anteckningen gäller. */
function vilken(t: Tx): string {
  return `${t.datum ?? 'utan datum'} ${t.riktning === 'in' ? '+' : '−'}${t.belopp} ${t.valuta} ${t.motpart || t.beskrivning || ''}`.trim();
}

/** Var transaktionen står: körningens rad, filen och numret i filen. */
interface Plats { id: string; fil: string; nr: number }

/** `radera` finns när transaktionen är en egen transaktion i bokföringen, som går att radera. */
interface Markerad { underlagId: string; vilken: string; radera?: Plats }

/**
 * Byråns anteckningar: en transaktion kan markeras, och en anteckning på en
 * eller flera körs om med anteckningen som kontext (POST anteckning).
 */
/**
 * Filtret i Flöde: bara transaktioner som inte är gröna (gula, röda och de utan
 * kontering), och bara de med datum i perioden. Med en period visas inte
 * transaktioner utan datum.
 */
interface Filter { baraOsakra: boolean; fran: string; tom: string }
const INGET_FILTER: Filter = { baraOsakra: false, fran: '', tom: '' };
const FilterCtx = createContext<Filter>(INGET_FILTER);
const arOsaker = (t: Tx) => !t.kontering || t.kontering.omdome !== 'gron';
const filterAktivt = (f: Filter) => f.baraOsakra || !!f.fran || !!f.tom;
function visas(t: Tx, f: Filter): boolean {
  if (f.baraOsakra && !arOsaker(t)) return false;
  if ((f.fran || f.tom) && !t.datum) return false;
  if (f.fran && t.datum! < f.fran) return false;
  if (f.tom && t.datum! > f.tom) return false;
  return true;
}

/** Perioderna att välja bland: kvartal och helår för åren som finns bland transaktionerna, nyast först. */
function periodval(ar: number[]): { namn: string; fran: string; tom: string }[] {
  return ar.flatMap((a) => [
    ...[4, 3, 2, 1].map((q) => ({
      namn: `Q${q} ${a}`,
      fran: `${a}-${String(q * 3 - 2).padStart(2, '0')}-01`,
      tom: `${a}-${String(q * 3).padStart(2, '0')}-${q === 1 || q === 4 ? '31' : '30'}`,
    })),
    { namn: `Helår ${a}`, fran: `${a}-01-01`, tom: `${a}-12-31` },
  ]);
}

/** Det som går att ändra på en transaktion i Flöde. */
interface Redigering { datum: string; beskrivning: string; motpart: string; belopp: number; konto: string; momssats: number }

const Anteckningar = createContext<{
  markerade: Map<string, Markerad>;
  markera: (nyckel: string, m: Markerad | null) => void;
  korOm: (text: string, tx: Markerad[]) => Promise<void>;
  redigera: (plats: Plats, r: Redigering) => Promise<void>;
  radera: (plats: Plats) => Promise<void>;
} | null>(null);

/** Den gamla transaktionen som är samma affär: samma riktning och nästan samma belopp. */
function sammaGamla(t: Tx, gamla: Gammal[]): Gammal | null {
  const belopp = t.belopp;
  return gamla.find((g) => g.riktning === t.riktning && Math.abs(Number(g.belopp) - belopp) <= 1) ?? null;
}

/** Kontona den gamla konteringen landade på: bokfört, byråns val, annars förslagen. */
function gamlaKonton(g: Gammal): string[] {
  if (g.bokfort.length) return g.bokfort;
  if (g.vald) return [g.vald];
  return [...new Set(g.forslag.map((f) => f.konto).filter((k): k is string => !!k))];
}

export function Flode({ userId }: { userId: string }) {
  const [underlag, setUnderlag] = useState<Underlag[] | null>(null);
  const [attKora, setAttKora] = useState<string[]>([]);
  const [allaAttKora, setAllaAttKora] = useState<string[]>([]);
  // Kör om alla ersätter allt Flöde bokfört, även det som godkänts — kräver ett andra klick
  const [korOmAllaBekrafta, setKorOmAllaBekrafta] = useState(false);
  const [rader, setRader] = useState<Provrad[]>([]);
  const [laddfel, setLaddfel] = useState('');
  const [valda, setValda] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [baraUnderlag, setBaraUnderlag] = useState(true);
  const [baraOsakra, setBaraOsakra] = useState(false);
  const [period, setPeriod] = useState({ fran: '', tom: '' });
  const [egenPeriod, setEgenPeriod] = useState(false);
  const [startar, setStartar] = useState(false);
  const [startfel, setStartfel] = useState('');
  const [markerade, setMarkerade] = useState<Map<string, Markerad>>(new Map());
  const [anteckning, setAnteckning] = useState('');
  const [korOmFel, setKorOmFel] = useState('');
  const [korOmStartar, setKorOmStartar] = useState(false);
  const [raderaBekrafta, setRaderaBekrafta] = useState(false);
  const [raderar, setRaderar] = useState(false);
  const [raderaFel, setRaderaFel] = useState('');
  const [val, setValState] = useState<Val>('gpt');
  useEffect(() => {
    try { const v = localStorage.getItem(VAL_NYCKEL); if (v && v in VAL) setValState(v as Val); } catch { /* utan lagring: GPT */ }
  }, []);
  const setVal = (v: Val) => {
    setValState(v);
    try { localStorage.setItem(VAL_NYCKEL, v); } catch { /* bara för den här gången */ }
  };
  const modellval = { modell: VAL[val].modell, jamfor: VAL[val].jamfor };

  const ladda = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/kontering-prov?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUnderlag(data.underlag);
      setAttKora(data.attKora ?? []);
      setAllaAttKora(data.allaAttKora ?? []);
      setRader(data.korningar);
      setLaddfel('');
    } catch (err) {
      setLaddfel(err instanceof Error ? err.message : String(err));
    }
  }, [userId]);

  useEffect(() => { ladda(); }, [ladda]);

  // Så länge något väntar frågar sidan efter svaret
  const vantar = rader.some((r) => VANTANDE.has(r.status));
  useEffect(() => {
    if (!vantar) return;
    const t = setInterval(ladda, 15000);
    return () => clearInterval(t);
  }, [vantar, ladda]);

  const synliga = useMemo(() => (underlag ?? []).filter((u) => {
    if (baraUnderlag && u.sortering === 'ovrigt') return false;
    if (!query) return true;
    return u.file_name.toLowerCase().includes(query.toLowerCase());
  }), [underlag, query, baraUnderlag]);

  const korningar = useMemo(() => {
    const m = new Map<string, Provrad[]>();
    for (const r of rader) m.set(r.korning, [...(m.get(r.korning) ?? []), r]);
    const alla = [...m.values()].map((d) => d.sort((a, b) => a.del - b.del));
    // En jämförelse visas direkt efter sin huvudkörning
    const ut: Provrad[][] = [];
    for (const d of alla) {
      if (d[0].jamfor_med && m.has(d[0].jamfor_med)) continue;
      ut.push(d, ...alla.filter((j) => j[0].jamfor_med === d[0].korning));
    }
    return ut;
  }, [rader]);

  /** Kör Flöde (nya) tar allt som inte körts, Kör om alla (alla) allt som går att köra; annars de valda. */
  async function starta(vad: 'nya' | 'alla' | 'valda') {
    setStartar(true);
    setStartfel('');
    setKorOmAllaBekrafta(false);
    try {
      const res = await fetch('/api/admin/kontering-prov', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vad === 'valda' ? { userId, underlagIds: valda, ...modellval } : { userId, [vad]: true, ...modellval }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setValda([]);
      await ladda();
    } catch (err) {
      setStartfel(err instanceof Error ? err.message : String(err));
    } finally {
      setStartar(false);
    }
  }

  const markera = useCallback((nyckel: string, m: Markerad | null) => setMarkerade((gamla) => {
    const nya = new Map(gamla);
    if (m) nya.set(nyckel, m); else nya.delete(nyckel);
    return nya;
  }), []);

  /** Sparar anteckningen på transaktionerna och kör om deras filer. Felet kastas till den som frågade. */
  const korOm = useCallback(async (text: string, tx: Markerad[]) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, anteckning: text, transaktioner: tx, ...modellval }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }, [userId, ladda, modellval.modell, modellval.jamfor]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Ändrar transaktionen och bokför den med byråns val. Felet kastas till formuläret. */
  const redigera = useCallback(async (plats: Plats, r: Redigering) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, id: plats.id, fil: plats.fil, nr: plats.nr, redigera: r }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }, [userId, ladda]);

  /** Raderar en transaktion ur bokföringen. Felet kastas till knappen. */
  const radera = useCallback(async (plats: Plats) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, radera: [plats] }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    markera(platsNyckel(plats), null);
    await ladda();
  }, [userId, ladda, markera]);

  const anteckningar = useMemo(() => ({ markerade, markera, korOm, redigera, radera }), [markerade, markera, korOm, redigera, radera]);

  async function korOmMarkerade() {
    setKorOmStartar(true);
    setKorOmFel('');
    try {
      await korOm(anteckning, [...markerade.values()]);
      setMarkerade(new Map());
      setAnteckning('');
    } catch (err) {
      setKorOmFel(err instanceof Error ? err.message : String(err));
    } finally {
      setKorOmStartar(false);
    }
  }

  /** Raderar de markerade transaktionerna ur bokföringen. Markerade som inte går att radera står kvar. */
  async function raderaMarkerade() {
    const att = [...markerade.entries()].filter(([, m]) => m.radera);
    setRaderar(true);
    setRaderaFel('');
    try {
      const res = await fetch('/api/admin/kontering-prov', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, radera: att.map(([, m]) => m.radera) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMarkerade((gamla) => {
        const kvar = new Map(gamla);
        for (const [nyckel] of att) kvar.delete(nyckel);
        return kvar;
      });
      setRaderaBekrafta(false);
      await ladda();
    } catch (err) {
      setRaderaFel(err instanceof Error ? err.message : String(err));
    } finally {
      setRaderar(false);
    }
  }

  /** Godkänn en gul kontering, eller ångra. Felet visas vid raden. */
  const godkann: Godkann = async (radId, fil, nr, godkand) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, id: radId, fil, nr, godkand }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  };

  /** Bokför en jämförelse i stället för huvudkörningen. */
  async function anvand(korning: string) {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, anvand: korning }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }

  async function taBort(korning: string) {
    await fetch(`/api/admin/kontering-prov?userId=${encodeURIComponent(userId)}&korning=${korning}`, { method: 'DELETE' });
    await ladda();
  }

  if (laddfel && !underlag) return <p className="text-red-600 text-sm">{laddfel}</p>;
  if (!underlag) return <p className="text-slate-500 text-sm">Laddar…</p>;

  const filter: Filter = { baraOsakra, fran: period.fran, tom: period.tom };
  const allaTx = rader.flatMap((r) => r.resultat?.filer ?? []).flatMap((f) => f.transaktioner);
  const arMedTx = [...new Set(allaTx.map((t) => Number(t.datum?.slice(0, 4))).filter((a) => a > 2000))].sort((a, b) => b - a);

  const allaValda = synliga.length > 0 && synliga.every((u) => valda.includes(u.id));
  const nyaSet = new Set(attKora);
  const filerMarkerade = new Set([...markerade.values()].map((m) => m.underlagId)).size;
  const raderbara = [...markerade.values()].filter((m) => m.radera).length;

  return (
    <Anteckningar.Provider value={anteckningar}>
    <div className="space-y-6">
      <div className="text-sm text-slate-600 max-w-3xl">
        Kör Flöde skickar allt som inte körts — och filer kunden skickat något nytt om — till modellen du väljer, som sorterar, läser ut, letar dubbletter mot det bokförda, säger vad som saknas och konterar.
        GPT svarar på några minuter. Claude körs i batch till halva priset och kan ta längre tid. Med Båda körs den andra modellen som jämförelse: den bokförs inte, men visar sin kontering med den bokförda bredvid, och du kan välja den i stället.
        Övriga filer och filer med inlästa verifikationer (SIE, Plocka verif) tas inte med. Gröna bokförs direkt, gula när du godkänt dem eller valt konto i Kontering. Körs en fil om ersätts det Flöde bokfört från den.
        Det som saknas frågas efter i kl 18-mejlet.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={val}
          onChange={(e) => setVal(e.target.value as Val)}
          className="border border-slate-300 rounded px-2 py-2 text-sm text-slate-900 bg-white"
          title="Modellen som kör Flöde"
        >
          {(Object.keys(VAL) as Val[]).map((v) => <option key={v} value={v}>{VAL[v].text}</option>)}
        </select>
        <button
          onClick={() => starta('nya')}
          disabled={!attKora.length || startar}
          className="bg-blue-600 text-white font-medium px-4 py-2 rounded disabled:opacity-40"
        >
          {startar ? 'Förbereder och skickar…' : attKora.length ? `Kör Flöde · ${attKora.length} underlag` : 'Inget nytt att köra'}
        </button>
        {attKora.length > 0 && !startar && <span className="text-sm text-slate-500">ca {prisFor(val, attKora.length)} kr</span>}
        {allaAttKora.length > 0 && !startar && (korOmAllaBekrafta ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-700">
              Kör om alla {allaAttKora.length} underlag, ca {prisFor(val, allaAttKora.length)} kr? Det Flöde bokfört från dem ersätts, även det du godkänt.
            </span>
            <button onClick={() => starta('alla')} className="bg-blue-600 text-white font-medium px-3 py-1.5 rounded">Ja, kör om alla</button>
            <button onClick={() => setKorOmAllaBekrafta(false)} className="border border-slate-300 text-slate-700 px-3 py-1.5 rounded">Avbryt</button>
          </span>
        ) : (
          <button
            onClick={() => setKorOmAllaBekrafta(true)}
            className="border border-blue-600 text-blue-700 text-sm font-medium px-3 py-2 rounded"
          >
            Kör om alla · {allaAttKora.length} underlag
          </button>
        ))}
        {startfel && <span className="text-sm text-red-600">{startfel}</span>}
      </div>

      <OsakraMejl userId={userId} uppdaterad={rader} />

      <details className="bg-white border border-slate-200 rounded-lg">
        <summary className="px-4 py-3 text-sm font-semibold text-slate-800 cursor-pointer select-none">Välj själv — kör om enskilda filer</summary>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-y border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm">Välj underlag</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök filnamn"
            className="border border-slate-300 rounded px-2 py-1 text-sm w-48 text-slate-900 bg-white"
          />
          <label className="text-sm text-slate-600 flex items-center gap-1.5">
            <input type="checkbox" checked={baraUnderlag} onChange={(e) => setBaraUnderlag(e.target.checked)} className="accent-blue-600" />
            Dölj övriga filer
          </label>
          <span className="ml-auto text-sm text-slate-600">
            {valda.length} valda{valda.length ? ` · ca ${prisFor(val, valda.length)} kr` : ''}
          </span>
          <button
            onClick={() => starta('valda')}
            disabled={!valda.length || startar}
            className="border border-blue-600 text-blue-700 text-sm font-medium px-3 py-1.5 rounded disabled:opacity-40"
          >
            {startar ? 'Förbereder och skickar…' : `Kör ${valda.length || ''} valda`.replace('  ', ' ')}
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="px-4 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allaValda}
                    onChange={(e) => setValda(e.target.checked ? [...new Set([...valda, ...synliga.map((u) => u.id)])] : valda.filter((id) => !synliga.some((u) => u.id === id)))}
                    className="accent-blue-600"
                  />
                </th>
                <th className="text-left font-semibold px-2 py-2">Fil</th>
                <th className="text-left font-semibold px-2 py-2">Inkom</th>
                <th className="text-left font-semibold px-2 py-2">Sortering</th>
                <th className="text-right font-semibold px-4 py-2">Transaktioner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {synliga.map((u) => (
                <tr key={u.id} className={valda.includes(u.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-1.5">
                    <input
                      type="checkbox"
                      checked={valda.includes(u.id)}
                      onChange={(e) => setValda((l) => (e.target.checked ? [...l, u.id] : l.filter((id) => id !== u.id)))}
                      className="accent-blue-600"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <a href={filLank(u.id)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{u.file_name}</a>
                    {u.del_av && <span className="text-slate-400 text-xs"> · sida i annat underlag</span>}
                    {nyttFranKunden(u) && (
                      <span className="ml-2 text-xs font-medium text-amber-800 bg-amber-100 rounded px-1.5 py-0.5" title="Kunden har mejlat om filen eller skickat en sida till den sedan den lästes — kör om den">
                        Nytt från kunden {TID.format(new Date(u.kund_svar_at!))}
                      </span>
                    )}
                    {nyaSet.has(u.id) && !nyttFranKunden(u) && <span className="ml-2 text-xs text-blue-700">Inte körd</span>}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{TID.format(new Date(u.created_at))}</td>
                  <td className="px-2 py-1.5 text-slate-600">{u.sortering === 'ovrigt' ? `Övrigt${u.sortering_orsak ? ` — ${u.sortering_orsak}` : ''}` : u.sortering === 'underlag' ? 'Underlag' : '—'}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-600">{u.transaktioner || ''}</td>
                </tr>
              ))}
              {!synliga.length && <tr><td colSpan={5} className="px-4 py-4 text-slate-500">Inga underlag.</td></tr>}
            </tbody>
          </table>
        </div>
      </details>

      {laddfel && <p className="text-red-600 text-sm">{laddfel}</p>}
      {korningar.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-1.5">
            Period
            <select
              value={egenPeriod ? 'egen' : periodval(arMedTx).find((p) => p.fran === period.fran && p.tom === period.tom)?.namn ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setEgenPeriod(v === 'egen');
                if (v === 'egen') return;
                const p = periodval(arMedTx).find((x) => x.namn === v);
                setPeriod(p ? { fran: p.fran, tom: p.tom } : { fran: '', tom: '' });
              }}
              className="border border-slate-300 rounded px-2 py-1 bg-white"
            >
              <option value="">Alla datum</option>
              {periodval(arMedTx).map((p) => <option key={p.namn} value={p.namn}>{p.namn}</option>)}
              <option value="egen">Eget intervall…</option>
            </select>
          </label>
          {egenPeriod && (
            <span className="flex items-center gap-1.5">
              <input type="date" value={period.fran} onChange={(e) => setPeriod((p) => ({ ...p, fran: e.target.value }))} className="border border-slate-300 rounded px-2 py-0.5" />
              –
              <input type="date" value={period.tom} onChange={(e) => setPeriod((p) => ({ ...p, tom: e.target.value }))} className="border border-slate-300 rounded px-2 py-0.5" />
            </span>
          )}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={baraOsakra} onChange={(e) => setBaraOsakra(e.target.checked)} className="accent-blue-600" />
            Visa bara gula och röda
          </label>
          {filterAktivt(filter) && (
            <span className="text-slate-500">
              {allaTx.filter((t) => visas(t, filter)).length} av {allaTx.length} transaktioner
            </span>
          )}
        </div>
      )}
      <FilterCtx.Provider value={filter}>
        {korningar.map((delar) => (
          <Korning key={delar[0].korning} delar={delar} onTaBort={() => taBort(delar[0].korning)} onGodkann={godkann} onAnvand={() => anvand(delar[0].korning)} />
        ))}
      </FilterCtx.Provider>

      {markerade.size > 0 && (
        <div className="sticky bottom-0 z-10 bg-white border border-blue-300 rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-slate-800">{markerade.size} {markerade.size === 1 ? 'transaktion markerad' : 'transaktioner markerade'}</span>
            <span className="text-slate-500">{filerMarkerade} {filerMarkerade === 1 ? 'fil' : 'filer'} körs om med {VAL[val].text} · ca {prisFor(val, filerMarkerade)} kr</span>
            <button onClick={() => { setMarkerade(new Map()); setRaderaBekrafta(false); }} className="ml-auto text-slate-500 hover:text-slate-800">Avmarkera alla</button>
          </div>
          <textarea
            value={anteckning}
            onChange={(e) => setAnteckning(e.target.value)}
            rows={2}
            placeholder="Anteckning till AI:n, t.ex. ”Det här är privata köp” eller ”Bilen är en lätt lastbil”"
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={korOmMarkerade}
              disabled={!anteckning.trim() || korOmStartar}
              className="bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded disabled:opacity-40"
            >
              {korOmStartar ? 'Förbereder och skickar…' : `Kör om ${markerade.size} med anteckningen`}
            </button>
            {korOmFel && <span className="text-sm text-red-600">{korOmFel}</span>}
            <span className="ml-auto flex flex-wrap items-center gap-3 text-sm">
              {raderaBekrafta ? (
                <>
                  <span className="text-slate-500 text-xs">Transaktionerna och deras verifikationer tas bort. Körs filen om kommer de tillbaka.</span>
                  <button onClick={raderaMarkerade} disabled={raderar} className="bg-red-600 text-white font-medium px-3 py-1.5 rounded disabled:opacity-40">
                    {raderar ? 'Raderar…' : `Ja, radera ${raderbara}`}
                  </button>
                  <button onClick={() => setRaderaBekrafta(false)} disabled={raderar} className="text-slate-500 hover:text-slate-800">Avbryt</button>
                </>
              ) : (
                <button onClick={() => setRaderaBekrafta(true)} disabled={!raderbara}
                  title={raderbara < markerade.size ? 'Jämförelser och rader som kopplats till något som redan fanns är inga egna transaktioner och raderas inte' : undefined}
                  className="text-red-600 hover:text-red-700 font-medium disabled:opacity-40">
                  {raderbara === markerade.size ? `Radera ${raderbara}` : `Radera ${raderbara} av ${markerade.size}`}
                </button>
              )}
              {raderaFel && <span className="text-red-600">{raderaFel}</span>}
            </span>
          </div>
        </div>
      )}
    </div>
    </Anteckningar.Provider>
  );
}

interface OsakraUtkast { id: string; till: string; amne: string; text: string }

/**
 * Ett samlat mejl till kunden om de gula konteringarna som inte är godkända
 * (/api/admin/osakra-mejl). AI:n skriver det; det går ut först när man trycker
 * Skicka. Texten och ämnet går att ändra innan.
 */
function OsakraMejl({ userId, uppdaterad }: { userId: string; uppdaterad: unknown }) {
  const [info, setInfo] = useState<{ antal: number; nya: number; fragade: number; utkast: OsakraUtkast | null } | null>(null);
  const [text, setText] = useState('');
  const [amne, setAmne] = useState('');
  const [arbetar, setArbetar] = useState<'' | 'skriver' | 'skickar' | 'slanger'>('');
  const [fel, setFel] = useState('');
  const [skickat, setSkickat] = useState('');

  // Texten fylls bara i när ett nytt utkast visas, så att det man skrivit inte skrivs över när listan laddas om
  const visatId = useRef<string | null>(null);
  const visa = useCallback((u: OsakraUtkast | null) => {
    if ((u?.id ?? null) === visatId.current) return;
    visatId.current = u?.id ?? null;
    setText(u?.text ?? '');
    setAmne(u?.amne ?? '');
  }, []);

  const ladda = useCallback(async () => {
    try {
      const d = await (await fetch(`/api/admin/osakra-mejl?userId=${encodeURIComponent(userId)}`)).json();
      if (d.error) throw new Error(d.error);
      setInfo(d);
      visa(d.utkast);
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
    }
  }, [userId, visa]);
  useEffect(() => { ladda(); }, [ladda, uppdaterad]);

  async function kor(steg: 'skriver' | 'skickar' | 'slanger') {
    setArbetar(steg);
    setFel('');
    try {
      if (steg === 'skriver') {
        const d = await (await fetch('/api/admin/osakra-mejl', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
        })).json();
        if (d.error) throw new Error(d.error);
        setSkickat('');
      } else {
        const utkast = info?.utkast;
        if (!utkast) return;
        const d = await (await fetch('/api/admin/inkorg', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(steg === 'skickar' ? { action: 'skicka-mejl', id: utkast.id, text, amne } : { action: 'slang-mejl', id: utkast.id }),
        })).json();
        if (d.error) throw new Error(d.error);
        if (steg === 'skickar') setSkickat(utkast.till);
      }
      await ladda();
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
    } finally {
      setArbetar('');
    }
  }

  if (!info) return null;
  const utkast = info.utkast;

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 space-y-3 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-slate-800 text-sm mr-auto">Mejl om osäkra</h3>
        {!utkast && (
          <button onClick={() => kor('skriver')} disabled={!info.antal || !!arbetar}
            className="border border-blue-600 text-blue-700 text-sm font-medium px-3 py-1.5 rounded disabled:opacity-40">
            {arbetar === 'skriver' ? 'AI:n skriver…' : info.antal ? `Skriv mejl om osäkra · ${info.antal}` : 'Inga osäkra att fråga om'}
          </button>
        )}
      </div>
      {!utkast && (
        <p className="text-xs text-slate-500">
          Gula konteringar som inte är godkända. AI:n samlar frågorna så att kunden får så få frågor som möjligt. Inget skickas förrän du trycker Skicka.
          {info.fragade > 0 && <span className="text-amber-700"> {info.fragade === info.antal ? (info.antal === 1 ? 'Den' : 'Alla') : `${info.fragade} av dem`} har varit med i ett mejl förut utan att bli lösta — mejlet frågar igen.</span>}
          {skickat && <span className="text-emerald-700"> Mejlet skickades till {skickat}.</span>}
        </p>
      )}
      {utkast && (
        <>
          <p className="text-xs text-slate-500">
            Till {utkast.till}. Läs igenom och ändra om du vill — mejlet går iväg först när du trycker Skicka.
            {info.nya > 0 && <span className="text-amber-700"> {info.nya} osäkra har tillkommit sedan mejlet skrevs — skriv om för att få med dem.</span>}
          </p>
          <input value={amne} onChange={(e) => setAmne(e.target.value)} placeholder="Ämne"
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-900 bg-white" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-900 bg-white font-sans" />
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => kor('skickar')} disabled={!!arbetar || !text.trim()}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded disabled:opacity-40">
              {arbetar === 'skickar' ? 'Skickar…' : 'Skicka'}
            </button>
            <button onClick={() => kor('skriver')} disabled={!!arbetar} className="text-sm text-blue-700 hover:underline disabled:opacity-40">
              {arbetar === 'skriver' ? 'AI:n skriver…' : 'Skriv om'}
            </button>
            <button onClick={() => kor('slanger')} disabled={!!arbetar} className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-40">
              Släng
            </button>
          </div>
        </>
      )}
      {fel && <p className="text-sm text-red-600">{fel}</p>}
    </div>
  );
}

function Korning({ delar, onTaBort, onGodkann, onAnvand }: { delar: Provrad[]; onTaBort: () => void; onGodkann: Godkann; onAnvand: () => Promise<void> }) {
  const [bekrafta, setBekrafta] = useState(false);
  const [anvander, setAnvander] = useState(false);
  const [anvandFel, setAnvandFel] = useState('');
  const forsta = delar[0];
  const jamforelse = !!forsta.jamfor_med;
  async function bokfor() {
    setAnvander(true);
    setAnvandFel('');
    try { await onAnvand(); } catch (err) { setAnvandFel(err instanceof Error ? err.message : String(err)); } finally { setAnvander(false); }
  }
  const klara = delar.filter((d) => d.status === 'klar' || d.status === 'fel').length;
  const usd = delar.reduce((s, d) => s + (Number(d.kostnad_usd) || 0), 0);
  const underlag = delar.reduce((s, d) => s + d.underlag_ids.length, 0);
  const tx = delar.flatMap((d) => d.resultat?.filer ?? []).flatMap((f) => f.transaktioner);
  const kopplade = tx.filter((t) => t.kopplad?.startsWith('Kopplad')).length;
  const egna = tx.filter((t) => !t.kopplad?.startsWith('Kopplad'));
  const grona = egna.filter((t) => t.kontering?.omdome === 'gron').length;
  const godkanda = egna.filter((t) => t.godkand).length;
  const minuter = delar.every((d) => d.klar_at)
    ? Math.round((Math.max(...delar.map((d) => new Date(d.klar_at!).getTime())) - new Date(forsta.created_at).getTime()) / 60000)
    : null;
  // En färdig körning utan något som passar filtret visas inte
  const filter = useContext(FilterCtx);
  if (filterAktivt(filter) && klara === delar.length && delar.every((d) => d.status === 'klar') && !tx.some((t) => visas(t, filter))) return null;

  return (
    <div className={`bg-white border rounded-lg ${jamforelse ? 'border-violet-300 ml-6' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-b border-slate-200 text-sm">
        <h3 className="font-semibold text-slate-800">{jamforelse ? 'Jämförelse' : 'Körning'} {TID.format(new Date(forsta.created_at))}</h3>
        <span className="text-xs font-medium text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">{MODELLNAMN[forsta.modell] ?? forsta.modell}</span>
        {jamforelse && <span className="text-xs text-violet-700">Inte bokförd — Förut visar det som bokfördes</span>}
        <span className="text-slate-600">{underlag} underlag{delar.length > 1 ? ` i ${delar.length} anrop` : ''}</span>
        {klara < delar.length
          ? <span className="text-blue-700">Väntar på svar ({klara} av {delar.length} klara){forsta.modell === 'claude-opus-5-5' ? ' — Claude körs i batch och kan ta en stund' : ''}{jamforelse ? '. En jämförelse tas emot när huvudkörningen är klar' : ''} — sidan frågar var 15:e sekund</span>
          : <span className="text-slate-600">{egna.length} transaktioner · {grona} gröna{godkanda ? ` · ${godkanda} ${godkanda === 1 ? 'godkänd' : 'godkända'}` : ''} · {egna.length - grona - godkanda} till Granska{kopplade ? ` · ${kopplade} kopplade till det som fanns` : ''}{minuter !== null ? ` · ${minuter} min` : ''}</span>}
        {usd > 0 && <span className="text-slate-600">{kr.format(usd * USD_SEK)} ({usd.toFixed(2)} USD)</span>}
        {jamforelse && klara === delar.length && delar.some((d) => d.status === 'klar') && (
          <button onClick={bokfor} disabled={anvander} className="text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded px-2 py-1 disabled:opacity-40"
            title="Ersätter det huvudkörningen bokförde för de här underlagen">
            {anvander ? 'Bokför…' : 'Bokför den här i stället'}
          </button>
        )}
        {anvandFel && <span className="text-xs text-red-600">{anvandFel}</span>}
        <span className="ml-auto">
          {bekrafta ? (
            <>
              <span className="text-slate-500 text-xs mr-3">Det bokförda ligger kvar.</span>
              <button onClick={onTaBort} className="text-red-600 text-sm font-medium mr-3">Ja, ta bort ur listan</button>
              <button onClick={() => setBekrafta(false)} className="text-slate-500 text-sm">Avbryt</button>
            </>
          ) : (
            <button onClick={() => setBekrafta(true)} className="text-slate-500 hover:text-red-600 text-sm">Ta bort ur listan</button>
          )}
        </span>
      </div>
      <ArJamforelse.Provider value={jamforelse}>
        <div className="divide-y divide-slate-200">
          {delar.map((d) => <Del key={d.id} rad={d} visaNummer={delar.length > 1} onGodkann={(fil, nr, val) => onGodkann(d.id, fil, nr, val)} />)}
        </div>
      </ArJamforelse.Provider>
    </div>
  );
}

function Del({ rad: d, visaNummer, onGodkann }: { rad: Provrad; visaNummer: boolean; onGodkann: (fil: string, nr: number, val: boolean) => Promise<void> }) {
  const r = d.resultat;
  const hoppade = r?.hoppade ?? d.varningar ?? [];
  const tokens = d.usage ? tokenrad(d.usage) : '';
  return (
    <div className="px-4 py-3 space-y-3">
      {(visaNummer || tokens) && (
        <div className="text-xs text-slate-500">
          {visaNummer && <span className="font-semibold text-slate-700 mr-2">Anrop {d.del} av {d.delar}</span>}
          {tokens}
          {d.uppskattade_tokens ? ` · uppskattat ${d.uppskattade_tokens.toLocaleString('sv-SE')} in` : ''}
        </div>
      )}
      {VANTANDE.has(d.status) && <p className="text-sm text-blue-700">{d.status === 'forbereder' ? 'Förbereder…' : d.status === 'tar-emot' ? 'Tar emot svaret…' : 'Skickad — modellen arbetar.'}</p>}
      {d.status === 'fel' && <p className="text-sm text-red-600">{d.fel}</p>}

      {hoppade.length > 0 && (
        <div className="text-sm">
          <div className="font-medium text-slate-700">Skickades inte</div>
          <ul className="mt-1 space-y-0.5">
            {hoppade.map((h) => (
              <li key={h.underlagId} className={h.varning ? 'text-amber-700' : 'text-slate-500'}>
                {h.varning ? '⚠ ' : ''}<a href={filLank(h.underlagId)} target="_blank" rel="noreferrer" className="hover:underline">{h.namn}</a> — {h.orsak}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r && r.kontroller.length > 0 && (
        <div className="text-sm">
          <div className="font-medium text-slate-700">Kontroller av svaret</div>
          <ul className="mt-1 space-y-0.5 text-amber-700">{r.kontroller.map((k, i) => <li key={i}>⚠ {k}</li>)}</ul>
        </div>
      )}
      {r && r.anteckningar.length > 0 && (
        <div className="text-sm">
          <div className="font-medium text-slate-700">Modellens anteckningar</div>
          <ul className="mt-1 space-y-0.5 text-slate-700 list-disc pl-5">{r.anteckningar.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {r?.filer.map((f) => <FilVy key={f.fil} radId={d.id} fil={f} onGodkann={(nr, val) => onGodkann(f.fil, nr, val)} />)}
    </div>
  );
}

function FilVy({ radId, fil: f, onGodkann }: { radId: string; fil: Fil; onGodkann: (nr: number, val: boolean) => Promise<void> }) {
  const filter = useContext(FilterCtx);
  // Gamla transaktioner som ingen ny motsvarar visas sist
  const matchade = new Set(f.transaktioner.map((t) => sammaGamla(t, f.gammalt)?.id).filter(Boolean));
  const overblivna = f.gammalt.filter((g) => !matchade.has(g.id) && !g.dublett);
  // Med filtret visas bara transaktionerna som passar; en fil utan svar visas ändå
  const visade = f.transaktioner.filter((t) => visas(t, filter));
  if (filterAktivt(filter) && !visade.length && f.sort) return null;
  return (
    <div className="border border-slate-200 rounded">
      <div className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 bg-slate-50 border-b border-slate-200 text-sm">
        <span className="font-semibold text-slate-700">{f.fil}</span>
        <a href={filLank(f.underlagId)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{f.namn}</a>
        <span className="text-slate-600">{f.sort ? SORT[f.sort] ?? f.sort : <span className="text-red-600">Inget svar</span>}{f.vad ? ` — ${f.vad}` : ''}</span>
        {f.delAv && <span className="text-slate-600">Sida i {f.delAv}</span>}
        {!f.transaktioner.length && f.gammalt.length > 0 && (
          <span className="text-amber-700 text-xs">Förut: {f.gammalt.length} transaktioner ur filen</span>
        )}
      </div>
      {f.skrivet && (
        <div className={`px-3 py-1.5 text-xs border-b border-slate-100 ${/^Fel|rördes inte|inget skrevs|Plocka verif/.test(f.skrivet) ? 'text-amber-800 bg-amber-50' : 'text-slate-600'}`}>
          {f.skrivet}
        </div>
      )}
      {visade.length > 0 && (
        <div className="divide-y divide-slate-100">
          {visade.map((t) => <TxVy key={t.nr} plats={{ id: radId, fil: f.fil, nr: t.nr }} underlagId={f.underlagId} t={t} gammal={sammaGamla(t, f.gammalt)} onGodkann={(val) => onGodkann(t.nr, val)} />)}
        </div>
      )}
      {overblivna.length > 0 && (
        <div className="px-3 py-2 text-xs text-amber-700 border-t border-slate-100">
          Förut fanns också: {overblivna.map((g) => `${g.datum ?? '—'} ${g.riktning === 'in' ? '+' : '−'}${kr.format(g.belopp)} ${g.motpart ?? ''} → ${gamlaKonton(g).join('/') || 'okonterad'}`).join(' · ')}
        </div>
      )}
    </div>
  );
}

/** En verifikations rader, debet och kredit. */
function Rader({ rader }: { rader: { konto: string; kontonamn: string; belopp: number }[] }) {
  return (
    <table className="mt-1 tabular-nums">
      <tbody>
        {rader.map((r, i) => (
          <tr key={i}>
            <td className="pr-3">{r.konto}</td>
            <td className="pr-3">{r.kontonamn}</td>
            <td className="pr-3 text-right">{r.belopp > 0 ? kr.format(r.belopp) : ''}</td>
            <td className="text-right">{r.belopp < 0 ? kr.format(-r.belopp) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const platsNyckel = (p: Plats) => `${p.id}|${p.fil}|${p.nr}`;

/** Kryssrutan som markerar transaktionen för en gemensam anteckning, eller för att radera den. */
function Markera({ plats, underlagId, t }: { plats: Plats; underlagId: string; t: Tx }) {
  const a = useContext(Anteckningar);
  const jamforelse = useContext(ArJamforelse);
  if (!a) return null;
  const nyckel = platsNyckel(plats);
  // Bara egna transaktioner i bokföringen går att radera — inte en jämförelse eller en kopplad rad
  const radera = t.transaktionId && !jamforelse && !t.kopplad?.startsWith('Kopplad') ? plats : undefined;
  return (
    <input
      type="checkbox"
      title="Markera för att köra om med en anteckning, eller för att radera"
      checked={a.markerade.has(nyckel)}
      onChange={(e) => a.markera(nyckel, e.target.checked ? { underlagId, vilken: vilken(t), radera } : null)}
      className="accent-blue-600 self-center"
    />
  );
}

/** Anteckning på en transaktion: skrivs in och körs om direkt. */
function Anteckna({ underlagId, t }: { underlagId: string; t: Tx }) {
  const a = useContext(Anteckningar);
  const [oppen, setOppen] = useState(false);
  const [text, setText] = useState('');
  const [startar, setStartar] = useState(false);
  const [fel, setFel] = useState('');
  if (!a) return null;
  if (!oppen) return <button onClick={() => setOppen(true)} className="text-xs text-blue-700 hover:underline">Anteckning och kör om</button>;
  async function kor() {
    setStartar(true);
    setFel('');
    try {
      await a!.korOm(text, [{ underlagId, vilken: vilken(t) }]);
      setOppen(false);
      setText('');
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
    } finally {
      setStartar(false);
    }
  }
  return (
    <div className="space-y-1.5 basis-full">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Vad ska AI:n veta om transaktionen?"
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-900 bg-white"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button onClick={kor} disabled={!text.trim() || startar} className="bg-blue-600 text-white font-medium px-2.5 py-1 rounded disabled:opacity-40">
          {startar ? 'Förbereder och skickar…' : 'Kör om med anteckningen'}
        </button>
        <button onClick={() => setOppen(false)} className="text-slate-500 hover:text-slate-800">Avbryt</button>
        <span className="text-slate-400">Hela filen körs om. Anteckningen följer med i senare körningar också.</span>
        {fel && <span className="text-red-600">{fel}</span>}
      </div>
    </div>
  );
}

/** Ändra datum, förklaring, motpart, belopp, konto och moms. Sparas och bokförs direkt. */
function Redigera({ plats, t, onStang }: { plats: Plats; t: Tx; onStang: () => void }) {
  const a = useContext(Anteckningar);
  const k = t.kontering;
  const [f, setF] = useState({
    datum: t.datum ?? '',
    beskrivning: t.beskrivning,
    motpart: t.motpart,
    belopp: String(t.belopp).replace('.', ','),
    konto: k?.konto ?? '',
    momssats: String(Number(k?.momssats ?? k?.momsdelar?.[0]?.momssats ?? 0) || 0),
  });
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState('');
  if (!a) return null;
  const satt = (falt: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [falt]: e.target.value }));
  async function spara() {
    setSparar(true);
    setFel('');
    try {
      await a!.redigera(plats, { ...f, belopp: Number(f.belopp.replace(/\s/g, '').replace(',', '.')), momssats: Number(f.momssats) });
      onStang();
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
    } finally {
      setSparar(false);
    }
  }
  const falt = 'border border-slate-300 rounded px-2 py-1 text-sm text-slate-900 bg-white';
  const etikett = 'flex flex-col gap-0.5 text-xs text-slate-500';
  return (
    <div className="basis-full space-y-2 rounded border border-blue-200 bg-blue-50/40 p-2">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
        <label className={etikett}>Datum<input type="date" value={f.datum} onChange={satt('datum')} className={falt} /></label>
        <label className={`${etikett} col-span-2`}>Förklaring<input value={f.beskrivning} onChange={satt('beskrivning')} className={falt} /></label>
        <label className={etikett}>Motpart<input value={f.motpart} onChange={satt('motpart')} className={falt} /></label>
        <label className={etikett}>Belopp{t.valuta !== 'SEK' ? ` (${t.valuta})` : ''}<input inputMode="decimal" value={f.belopp} onChange={satt('belopp')} className={`${falt} tabular-nums`} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={etikett}>Konto<input inputMode="numeric" value={f.konto} onChange={satt('konto')} placeholder="t.ex. 5410" className={`${falt} tabular-nums`} /></label>
          <label className={etikett}>Moms
            <select value={f.momssats} onChange={satt('momssats')} className={falt}>
              {['25', '12', '6', '0'].map((s) => <option key={s} value={s}>{s} %</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button onClick={spara} disabled={sparar} className="bg-blue-600 text-white font-medium px-2.5 py-1 rounded disabled:opacity-40">
          {sparar ? 'Sparar…' : 'Spara och bokför'}
        </button>
        <button onClick={onStang} className="text-slate-500 hover:text-slate-800">Avbryt</button>
        <span className="text-slate-400">Bokförs direkt. Körs filen om ersätts ändringen.</span>
        {fel && <span className="text-red-600">{fel}</span>}
      </div>
    </div>
  );
}

function TxVy({ plats, underlagId, t, gammal, onGodkann }:{ plats: Plats; underlagId: string; t: Tx; gammal: Gammal | null; onGodkann: (val: boolean) => Promise<void> }) {
  const jamforelse = useContext(ArJamforelse);
  const a = useContext(Anteckningar);
  const [sparar, setSparar] = useState(false);
  const [godkannFel, setGodkannFel] = useState('');
  const [redigerar, setRedigerar] = useState(false);
  // Bara egna transaktioner i bokföringen går att ändra — inte en jämförelse eller en dubblett
  const kanRedigera = !!a && !jamforelse && !!t.transaktionId && t.dublett.status !== 'dublett';
  // Som kryssrutan: inte en jämförelse eller en rad som kopplats till något som redan fanns
  const kanRadera = !!a && !jamforelse && !!t.transaktionId && !t.kopplad?.startsWith('Kopplad');
  const [raderaFraga, setRaderaFraga] = useState(false);
  const [raderar, setRaderar] = useState(false);
  const [raderaFel, setRaderaFel] = useState('');
  async function raderaDen() {
    setRaderar(true);
    setRaderaFel('');
    try {
      await a!.radera(plats);
    } catch (err) {
      setRaderaFel(err instanceof Error ? err.message : String(err));
      setRaderar(false);
    }
  }
  async function satt(val: boolean) {
    setSparar(true);
    setGodkannFel('');
    try { await onGodkann(val); } catch (err) { setGodkannFel(err instanceof Error ? err.message : String(err)); } finally { setSparar(false); }
  }
  // Kopplad till det som redan fanns: ingen egen transaktion, inget att granska
  if (t.kopplad?.startsWith('Kopplad')) {
    return (
      <div className="px-3 py-2 text-sm flex flex-wrap items-baseline gap-x-2 text-slate-500">
        <Markera plats={plats} underlagId={underlagId} t={t} />
        <span className="tabular-nums">{t.datum ?? 'utan datum'}</span>
        <span>{t.beskrivning || '—'}</span>
        {t.motpart && <span>· {t.motpart}</span>}
        <span className="tabular-nums">{t.riktning === 'in' ? '+' : '−'}{kr.format(t.belopp)}{t.valuta !== 'SEK' ? ` ${t.valuta}` : ''}</span>
        <span className="text-xs basis-full">{t.kopplad}</span>
        <Anteckna underlagId={underlagId} t={t} />
      </div>
    );
  }
  const k = t.kontering;
  const o = k ? OMDOME[k.omdome] : null;
  const gamla = gammal ? gamlaKonton(gammal) : [];
  const nyaKonton = k ? [...new Set([k.konto, ...(k.momsdelar ?? []).map((d) => d.konto)].filter((x): x is string => !!x))] : [];
  const skiljer = gammal && gamla.length > 0 && k?.konto && !nyaKonton.some((n) => gamla.includes(n));

  return (
    <div className={`px-3 py-2.5 text-sm grid gap-x-6 gap-y-2 md:grid-cols-[1fr_1fr] ${skiljer ? 'bg-amber-50' : ''}`}>
      {/* Vänster: transaktionen och den nya konteringen */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Markera plats={plats} underlagId={underlagId} t={t} />
          <span className="text-slate-500 tabular-nums">{t.datum ?? <span className="text-blue-700">utan datum</span>}</span>
          <span className="text-slate-900 font-medium">{t.beskrivning || '—'}</span>
          {t.motpart && <span className="text-slate-500">· {t.motpart}</span>}
          <span className={`ml-auto tabular-nums font-medium ${t.riktning === 'in' ? 'text-emerald-700' : 'text-slate-800'}`}>
            {t.riktning === 'in' ? '+' : '−'}{kr.format(t.belopp)}{t.valuta !== 'SEK' ? ` ${t.valuta}` : ''}
            {t.kronor && t.valuta !== 'SEK' && <span className="text-slate-500 font-normal"> = {kr.format(t.kronor.belopp)} kr</span>}
            {t.moms ? <span className="block text-right text-slate-400 text-[11px] font-normal">moms {kr.format(t.moms)}</span> : null}
          </span>
        </div>
        {k ? (
          <div>
            <div className="flex flex-wrap items-center gap-x-2">
              {o && <span className={`inline-block w-2 h-2 rounded-full ${o.prick}`} title={o.text} />}
              {k.konto ? (
                <KontoLank konto={k.konto} className="font-semibold text-slate-800">{k.konto} {k.kontonamn}</KontoLank>
              ) : <span className="font-semibold text-red-600">Inget konto</span>}
              <span className="text-slate-600">{momsText(k.momssats, k.momsdelar, k.omvand)}</span>
              {[...new Set((k.momsdelar ?? []).map((d) => d.konto).filter((x): x is string => !!x && x !== k.konto))].map((konto) => (
                <KontoLank key={konto} konto={konto} className="text-slate-700 text-xs">{konto}</KontoLank>
              ))}
              <span className="text-slate-500 text-xs">säkerhet {SAKERHET[k.sakerhet] ?? k.sakerhet}</span>
              {o && !t.godkand && !t.andrad && <span className={`text-xs ${k.omdome === 'gron' ? 'text-emerald-700' : k.omdome === 'rod' ? 'text-red-600' : 'text-amber-700'}`}>{o.text}</span>}
              {t.godkand && <span className="text-xs text-emerald-700 font-medium" title="Bokförd som verifikation när den godkändes">✓ Godkänd av byrån</span>}
              {t.andrad && <span className="text-xs text-emerald-700 font-medium" title="Ändrad och bokförd med byråns val">✎ Ändrad av byrån</span>}
              {k.omdome === 'gul' && !t.godkand && !jamforelse && (
                <button onClick={() => satt(true)} disabled={sparar} className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded px-2 py-0.5 disabled:opacity-40">
                  {sparar ? 'Sparar…' : 'Godkänn'}
                </button>
              )}
              {t.godkand && (
                <button onClick={() => satt(false)} disabled={sparar} className="text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40">Ångra</button>
              )}
              {godkannFel && <span className="text-xs text-red-600">{godkannFel}</span>}
            </div>
            <p className="text-slate-600 mt-0.5">{k.motivering}</p>
            {k.regler.length > 0 && <p className="text-slate-500 text-xs mt-0.5">Kundregler: {k.regler.join(', ')}</p>}
            {k.flaggor.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {/* Det som saknas står i en egen rad nedan */}
                {k.flaggor.filter((f) => f.typ !== 'saknas').map((f, i) => <li key={i} className={`text-xs ${f.allvar === 'stopp' ? 'text-red-600' : 'text-amber-700'}`}>{f.text}</li>)}
              </ul>
            )}
          </div>
        ) : null}
        {t.fel && <p className="text-red-600 text-xs">{t.fel}</p>}
        {t.dublett.status !== 'unik' && (
          <p className={`text-xs ${t.dublett.status === 'dublett' ? 'text-red-600' : 'text-amber-700'}`}>
            {t.dublett.status === 'dublett' ? 'Dubblett' : 'Kanske dubblett'} av {t.dublett.refText || 'okänd rad'}: {t.dublett.motivering}
          </p>
        )}
        {t.saknas.length > 0 && (
          <div className="text-xs text-amber-700">
            Saknas: {t.saknas.map((s) => `${s.vad} (${s.varfor})`).join(' · ')}
          </div>
        )}
        {t.antaganden && <p className="text-xs text-slate-500">Antaganden: {t.antaganden}</p>}
        {t.anteckning && <p className="text-xs text-slate-500">Anteckning: {t.anteckning}</p>}
        {redigerar ? <Redigera plats={plats} t={t} onStang={() => setRedigerar(false)} /> : (
          <div className="flex flex-wrap items-center gap-x-4">
            {kanRedigera && <button onClick={() => setRedigerar(true)} className="text-xs text-blue-700 hover:underline">Redigera</button>}
            {kanRadera && (raderaFraga ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-slate-700">Radera ur bokföringen?</span>
                <button onClick={raderaDen} disabled={raderar} className="bg-red-600 text-white font-medium px-2 py-0.5 rounded disabled:opacity-40">{raderar ? 'Raderar…' : 'Ja, radera'}</button>
                <button onClick={() => { setRaderaFraga(false); setRaderaFel(''); }} disabled={raderar} className="text-slate-500 hover:text-slate-800">Avbryt</button>
                {raderaFel && <span className="text-red-600">{raderaFel}</span>}
              </span>
            ) : (
              <button onClick={() => setRaderaFraga(true)} className="text-xs text-red-600 hover:underline">Radera</button>
            ))}
            <Anteckna underlagId={underlagId} t={t} />
          </div>
        )}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Verifikation och uppgifter</summary>
          {t.verifikation && (
            <>
              {t.faktura && <div className="mt-1 font-medium">Fakturan {t.faktura.datum} (faktureringsmetoden)</div>}
              <Rader rader={t.verifikation} />
            </>
          )}
          {t.faktura && (
            <>
              <div className="mt-1 font-medium">Betalningen {t.faktura.betalning.datum}</div>
              <Rader rader={t.faktura.betalning.rader} />
            </>
          )}
          {t.vat_nummer && <div className="mt-1">VAT: {t.vat_nummer}</div>}
          {Object.keys(t.uppgifter ?? {}).length > 0 && <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(t.uppgifter, null, 1)}</pre>}
        </details>
      </div>

      {/* Höger: hur samma affär konterades förut */}
      <div className="text-xs text-slate-600 min-w-0 md:border-l md:border-slate-200 md:pl-4">
        {gammal ? (
          <>
            <div className="font-medium text-slate-700 mb-0.5">
              Förut{skiljer && <span className="ml-2 text-amber-700 font-semibold">Skiljer sig</span>}
            </div>
            <div>{gammal.datum ?? '—'} · {gammal.motpart ?? gammal.beskrivning ?? '—'} · {gammal.riktning === 'in' ? '+' : '−'}{kr.format(gammal.belopp)}{gammal.valuta && gammal.valuta !== 'SEK' ? ` ${gammal.valuta}` : ''}</div>
            {gammal.dublett && <div className="text-slate-500">Markerad som dubblett</div>}
            {gammal.bokfort.length > 0 && <div>Bokförd på {gammal.bokfort.join(', ')}</div>}
            {gammal.vald && <div>Byrån valde {gammal.vald}</div>}
            {gammal.forslag.map((f, i) => (
              <div key={i}>{MODELL[f.modell] ?? f.modell}: {f.konto ?? '—'}{f.momssats !== null ? ` ${f.momssats} %` : ''} <span className="text-slate-400">({OMDOME[f.omdome]?.text ?? f.omdome})</span></div>
            ))}
            {!gammal.bokfort.length && !gammal.vald && !gammal.forslag.length && <div className="text-slate-400">Inte konterad</div>}
          </>
        ) : (
          <div className="text-slate-400">Ingen motsvarande transaktion förut</div>
        )}
      </div>
    </div>
  );
}
