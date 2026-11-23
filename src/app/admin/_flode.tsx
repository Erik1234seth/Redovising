'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { momsText, type Momsdel, type Omvand } from '@/lib/kontering/momsdelar';
import { kr } from './_verifikationer';
import { KontoLank } from './_k1-konto';

/**
 * Flöde — konteringen sedan 2026-11-07: en modell får kundens underlag och
 * sorterar, läser ut, letar dubbletter, säger vad som saknas och konterar
 * (@/lib/kontering/omgang). Svaret skrivs till bokföringen: gröna blir
 * verifikationer direkt och gula när byrån godkänt dem.
 *
 * Sedan 2026-11-22 visas resultatet i fyra flikar i stället för körning för
 * körning:
 *   Transaktioner — klart: gröna, godkända, ändrade och de som fanns förut
 *   Granska       — det som behöver kollas, med mejlutkastet till kunden överst
 *   Övrigt        — filer som inte blev transaktioner
 *   Underlag      — alla filer, där enskilda kan köras om
 *
 * Varje transaktion och fil är ett kort som fälls ut när man klickar på det:
 * AI:ns resonemang, verifikationen och åtgärderna (anteckna och kör om,
 * redigera, radera) ligger där. Servern skickar bara det senaste svaret för
 * varje fil (`utanOmkorda`), så korten kan slås ihop över körningarna.
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
  /** transaktionId: den befintliga transaktionen raden pekar på, när den gick att slå upp. */
  dublett: { status: 'unik' | 'tveksam' | 'dublett'; ref: string; refText?: string; motivering: string; transaktionId?: string | null };
  saknas: { vad: string; varfor: string }[];
  /** Pending: kontona affären kan hamna på beroende på svaret. */
  preliminara?: { konto: string; kontonamn: string; nar: string }[];
  /** Pending-transaktionen har konterats om med ny information (@/lib/kontering/pending). */
  omkord?: { at: string; antal: number; lost: boolean };
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
  /** Jämförelse med den körningen: inte bokförd, och visas inte längre. */
  jamfor_med: string | null;
  underlag_ids: string[];
  varningar: Hoppad[];
  resultat: Resultat | null;
  fel: string | null;
  klar_at: string | null;
}

/** Modellen som kör om filer härifrån. Valet av modell togs bort ur vyn 2026-11-22. */
const MODELLVAL = { modell: 'gpt-6.2-sol', jamfor: false } as const;

const VANTANDE = new Set(['forbereder', 'skickad', 'tar-emot']);
const TID = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const SORT: Record<string, string> = { underlag: 'Underlag', kontoutdrag: 'Kontoutdrag', verifikationer: 'Redan bokfört', ovrigt: 'Övrigt', komplement: 'Komplement' };
const OMDOME: Record<string, { prick: string; text: string }> = {
  gron: { prick: 'bg-emerald-400', text: 'Klar' },
  gul: { prick: 'bg-amber-400', text: 'Granska' },
  rod: { prick: 'bg-red-500', text: 'Stopp' },
};

function filLank(id: string) {
  return `/api/admin/underlag/${id}/ladda-ner?visa`;
}

/** Transaktionen i ord, så att AI:n vet vilken i filen anteckningen gäller. */
function vilken(t: Tx): string {
  return `${t.datum ?? 'utan datum'} ${t.riktning === 'in' ? '+' : '−'}${t.belopp} ${t.valuta} ${t.motpart || t.beskrivning || ''}`.trim();
}

/** Var transaktionen står: körningens rad, filen och numret i filen. */
interface Plats { id: string; fil: string; nr: number }

/** Det som går att ändra på en transaktion i Flöde. */
interface Redigering { datum: string; beskrivning: string; motpart: string; belopp: number; konto: string; momssats: number }

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

/** Den gamla transaktionen som är samma affär: samma riktning och nästan samma belopp. */
function sammaGamla(t: Tx, gamla: Gammal[]): Gammal | null {
  return gamla.find((g) => g.riktning === t.riktning && Math.abs(Number(g.belopp) - t.belopp) <= 1) ?? null;
}

/** Kontona den gamla konteringen landade på: bokfört, byråns val, annars förslagen. */
function gamlaKonton(g: Gammal): string[] {
  if (g.bokfort.length) return g.bokfort;
  if (g.vald) return [g.vald];
  return [...new Set(g.forslag.map((f) => f.konto).filter((k): k is string => !!k))];
}

/** En transaktion ur någon körning, med det som behövs för att visa och ändra den. */
interface Post {
  nyckel: string;
  plats: Plats;
  underlagId: string;
  filnamn: string;
  /** Alla filer transaktionen bygger på: sin egen först, sedan de som kopplats dit. */
  filer: { id: string; namn: string }[];
  t: Tx;
  gammal: Gammal | null;
  /** Med i den senaste körningen: står i fet stil. */
  ny: boolean;
}

/**
 * En rad i listan: en transaktion, eller flera som kan vara samma affär.
 * En möjlig dubblett visas direkt under transaktionen den pekar på.
 */
type Rad = Post[];

interface Koppling { underlag_id: string; transaktion_id: string }

/** En transaktion som väntar på mer information (@/lib/kontering/pending). */
interface PendingInfo { fragaSkickad: string | null; utkast: boolean; provadAt: string | null; omkorningar: number }

/** Pending-transaktionerna, efter transaktionens id. */
const Pending = createContext<Record<string, PendingInfo>>({});

const DAGEN = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });
const dagar = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

/** En fil i Övrigt: sorterades bort, gav inga transaktioner eller kördes inte. */
interface OvrigFil { id: string; namn: string; typ: string; orsak: string; varning: boolean; ny?: boolean }

const arKopplad = (t: Tx) => !!t.kopplad?.startsWith('Kopplad');
/** Klar: grön, godkänd, ändrad av byrån, eller kopplad till det som redan fanns. */
const arKlar = (t: Tx) => arKopplad(t) || !!t.godkand || !!t.andrad || t.kontering?.omdome === 'gron';

/** Vad som behöver kollas, i en mening — visas på kortet i Granska. */
function fragan(t: Tx): string | null {
  if (t.fel) return t.fel;
  if (!t.kontering) return 'Inte konterad';
  if (t.dublett.status === 'dublett') return `Dubblett av ${t.dublett.refText || 'en annan rad'}`;
  const flagga = t.kontering.flaggor.find((f) => f.typ !== 'saknas');
  if (t.saknas.length) return `Saknas: ${t.saknas.map((s) => s.vad).join(', ')}`;
  if (flagga) return flagga.text;
  if (t.dublett.status === 'tveksam') return `Kanske dubblett av ${t.dublett.refText || 'en annan rad'}`;
  return null;
}

type Flik = 'transaktioner' | 'granska' | 'ovrigt' | 'underlag';

/** Granska: allt, det som väntar på mer information, eller det som byrån själv ska avgöra. */
type GranskaVy = 'alla' | 'pending' | 'avgora';

const Atgarder = createContext<{
  godkann: (plats: Plats, val: boolean) => Promise<void>;
  korOm: (text: string, underlagId: string, vilken: string) => Promise<void>;
  korOmFil: (underlagId: string) => Promise<void>;
  redigera: (plats: Plats, r: Redigering) => Promise<void>;
  radera: (plats: Plats) => Promise<void>;
} | null>(null);

export function Flode({ userId }: { userId: string }) {
  const [underlag, setUnderlag] = useState<Underlag[] | null>(null);
  const [attKora, setAttKora] = useState<string[]>([]);
  const [rader, setRader] = useState<Provrad[]>([]);
  const [kopplingar, setKopplingar] = useState<Koppling[]>([]);
  const [pending, setPending] = useState<Record<string, PendingInfo>>({});
  const [granskaVy, setGranskaVy] = useState<GranskaVy>('alla');
  const [laddfel, setLaddfel] = useState('');
  const [flik, setFlik] = useState<Flik | null>(null);
  const [sok, setSok] = useState('');
  const [period, setPeriod] = useState({ fran: '', tom: '' });
  const [valda, setValda] = useState<string[]>([]);
  const [filsok, setFilsok] = useState('');
  const [startar, setStartar] = useState(false);
  const [startfel, setStartfel] = useState('');

  const ladda = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/kontering-prov?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUnderlag(data.underlag);
      setAttKora(data.attKora ?? []);
      setRader(data.korningar);
      setKopplingar(data.kopplingar ?? []);
      setPending(data.pending ?? {});
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

  // Jämförelser bokförs inte och visas inte
  const egna = useMemo(() => rader.filter((r) => !r.jamfor_med), [rader]);

  /** Den senaste klara körningen: det som var med i den står i fet stil, som olästa mejl. Raderna kommer nyast först. */
  const senaste = useMemo(() => egna.find((r) => r.status === 'klar')?.korning ?? null, [egna]);
  const senastesUnderlag = useMemo(
    () => new Set(egna.filter((r) => r.korning === senaste).flatMap((r) => r.underlag_ids ?? [])),
    [egna, senaste],
  );

  /**
   * Transaktionerna, en gång var. En fil som kopplats till en befintlig
   * transaktion blir ingen egen rad: den listas bland transaktionens filer.
   * Gick det inte att se vart den kopplades (t.ex. en bankrad utanför Flöde)
   * står den kvar som egen rad.
   */
  const poster = useMemo<Post[]>(() => {
    const namn = new Map((underlag ?? []).map((u) => [u.id, u.file_name]));
    const alla: Post[] = [];
    for (const r of egna) for (const f of r.resultat?.filer ?? []) for (const t of f.transaktioner) {
      alla.push({
        nyckel: `${r.id}|${f.fil}|${t.nr}`,
        plats: { id: r.id, fil: f.fil, nr: t.nr },
        underlagId: f.underlagId,
        filnamn: f.namn,
        filer: [{ id: f.underlagId, namn: f.namn }],
        t,
        gammal: sammaGamla(t, f.gammalt),
        ny: r.korning === senaste,
      });
    }
    const perTx = new Map(alla.filter((p) => p.t.transaktionId).map((p) => [p.t.transaktionId!, p]));
    const laggTill = (mal: Post, id: string) => {
      if (!mal.filer.some((x) => x.id === id)) mal.filer.push({ id, namn: namn.get(id) ?? 'Fil' });
    };
    for (const k of kopplingar) {
      const mal = perTx.get(k.transaktion_id);
      if (mal) laggTill(mal, k.underlag_id);
    }
    const ut: Post[] = [];
    for (const p of alla) {
      if (arKopplad(p.t)) {
        const malId = p.t.dublett.transaktionId
          ?? kopplingar.find((k) => k.underlag_id === p.underlagId && perTx.has(k.transaktion_id)
            && Math.abs(perTx.get(k.transaktion_id)!.t.belopp - p.t.belopp) < 1)?.transaktion_id;
        const mal = malId ? perTx.get(malId) : undefined;
        if (mal && mal !== p) { laggTill(mal, p.underlagId); continue; }
      }
      ut.push(p);
    }
    return ut.sort((a, b) => (b.t.datum ?? '').localeCompare(a.t.datum ?? ''));
  }, [egna, kopplingar, underlag, senaste]);

  /**
   * Möjliga dubbletter läggs ihop med transaktionen de pekar på: den
   * befintliga transaktionen, annars raden med samma belopp i filen de pekar på.
   * Gruppen hamnar i Granska om någon i den behöver granskas.
   */
  const { klaraRader, granskaRader } = useMemo(() => {
    const perTx = new Map(poster.filter((p) => p.t.transaktionId).map((p) => [p.t.transaktionId!, p]));
    const grupp = new Map<string, Post[]>();
    const iGrupp = new Set<string>();
    for (const p of poster) {
      if (p.t.dublett.status === 'unik' || arKopplad(p.t)) continue;
      const refFil = p.t.dublett.refText?.startsWith('filen ') ? p.t.dublett.refText.slice(6) : null;
      const mal = (p.t.dublett.transaktionId ? perTx.get(p.t.dublett.transaktionId) : undefined)
        ?? (refFil ? poster.find((x) => x !== p && x.filnamn === refFil && x.t.riktning === p.t.riktning && Math.abs(x.t.belopp - p.t.belopp) < 1) : undefined);
      if (!mal || mal === p || iGrupp.has(p.nyckel)) continue;
      // Pekar målet själv på en annan, går gruppen dit
      const rot = [...grupp.entries()].find(([, g]) => g.includes(mal))?.[0] ?? mal.nyckel;
      const g = grupp.get(rot) ?? [mal];
      if (!g.includes(p)) g.push(p);
      grupp.set(rot, g);
      for (const x of g) iGrupp.add(x.nyckel);
    }
    const klaraRader: Rad[] = [];
    const granskaRader: Rad[] = [];
    for (const p of poster) {
      const g = grupp.get(p.nyckel);
      if (!g && iGrupp.has(p.nyckel)) continue;
      const rad = g ?? [p];
      (rad.every((x) => arKlar(x.t)) ? klaraRader : granskaRader).push(rad);
    }
    return { klaraRader, granskaRader };
  }, [poster]);

  const ovriga = useMemo<OvrigFil[]>(() => {
    const m = new Map<string, OvrigFil>();
    for (const r of egna) {
      for (const f of r.resultat?.filer ?? []) {
        const varning = !!f.skrivet && /^Fel|rördes inte|inget skrevs|Plocka verif/.test(f.skrivet);
        if (f.transaktioner.length && !varning) continue;
        if (!f.transaktioner.length && (f.sort === 'underlag' || f.sort === 'kontoutdrag') && !f.vad && !varning) continue;
        m.set(f.underlagId, {
          id: f.underlagId, namn: f.namn, typ: f.sort ? SORT[f.sort] ?? f.sort : 'Inget svar',
          orsak: [f.vad, varning ? f.skrivet : ''].filter(Boolean).join(' — '), varning, ny: r.korning === senaste,
        });
      }
      for (const h of r.resultat?.hoppade ?? r.varningar ?? []) {
        if (!m.has(h.underlagId)) m.set(h.underlagId, { id: h.underlagId, namn: h.namn, typ: 'Kördes inte', orsak: h.orsak, varning: h.varning });
      }
    }
    for (const u of underlag ?? []) {
      if (u.sortering === 'ovrigt' && !m.has(u.id)) m.set(u.id, { id: u.id, namn: u.file_name, typ: 'Övrigt', orsak: u.sortering_orsak ?? '', varning: false });
    }
    return [...m.values()];
  }, [egna, underlag, senaste]);

  const anteckningar = egna.flatMap((r) => r.resultat?.anteckningar ?? []);
  const kontroller = egna.flatMap((r) => r.resultat?.kontroller ?? []);
  const fel = egna.filter((r) => r.status === 'fel' && r.fel);

  const antal = (r: Rad[]) => r.reduce((n, g) => n + g.length, 0);

  // Första gången: Granska om något väntar där, annars Transaktioner
  const vald: Flik = flik ?? (granskaRader.length ? 'granska' : 'transaktioner');

  const godkann = useCallback(async (plats: Plats, godkand: boolean) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, id: plats.id, fil: plats.fil, nr: plats.nr, godkand }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }, [userId, ladda]);

  const korOm = useCallback(async (text: string, underlagId: string, vem: string) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, anteckning: text, transaktioner: [{ underlagId, vilken: vem }], ...MODELLVAL }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }, [userId, ladda]);

  /** Underlag som byrån räknat som körda utan att köra dem, med vad de hade förut — för Ångra. */
  const [hanterade, setHanterade] = useState<Record<string, string | null>>({});
  const [hanterar, setHanterar] = useState('');

  async function markeraHanterad(id: string) {
    setHanterar(id);
    setStartfel('');
    try {
      const res = await fetch('/api/admin/kontering-prov', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, hanterad: { underlagIds: [id] } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fore = (data.fore ?? []) as { id: string; flode_at: string | null }[];
      setHanterade((h) => ({ ...h, ...Object.fromEntries(fore.map((f) => [f.id, f.flode_at])) }));
      setValda((l) => l.filter((x) => x !== id));
      await ladda();
    } catch (err) {
      setStartfel(err instanceof Error ? err.message : String(err));
    } finally {
      setHanterar('');
    }
  }

  async function angraHanterad(id: string) {
    setHanterar(id);
    setStartfel('');
    try {
      const res = await fetch('/api/admin/kontering-prov', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, aterstall: [{ id, flode_at: hanterade[id] ?? null }] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHanterade((h) => Object.fromEntries(Object.entries(h).filter(([k]) => k !== id)));
      await ladda();
    } catch (err) {
      setStartfel(err instanceof Error ? err.message : String(err));
    } finally {
      setHanterar('');
    }
  }

  const korOmFiler = useCallback(async (ids: string[]) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, underlagIds: ids, ...MODELLVAL }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }, [userId, ladda]);

  const redigera = useCallback(async (plats: Plats, r: Redigering) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, id: plats.id, fil: plats.fil, nr: plats.nr, redigera: r }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }, [userId, ladda]);

  const radera = useCallback(async (plats: Plats) => {
    const res = await fetch('/api/admin/kontering-prov', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, radera: [plats] }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await ladda();
  }, [userId, ladda]);

  const atgarder = useMemo(() => ({ godkann, korOm, korOmFil: (id: string) => korOmFiler([id]), redigera, radera }), [godkann, korOm, korOmFiler, redigera, radera]);

  async function korValda() {
    setStartar(true);
    setStartfel('');
    try {
      await korOmFiler(valda);
      setValda([]);
    } catch (err) {
      setStartfel(err instanceof Error ? err.message : String(err));
    } finally {
      setStartar(false);
    }
  }

  if (laddfel && !underlag) return <p className="text-red-600 text-sm">{laddfel}</p>;
  if (!underlag) return <p className="text-slate-500 text-sm">Laddar…</p>;

  const ar = [...new Set(poster.map((p) => Number(p.t.datum?.slice(0, 4))).filter((a) => a > 2000))].sort((a, b) => b - a);
  const q = sok.trim().toLowerCase();
  const passarPost = (p: Post) => {
    if (period.fran && (!p.t.datum || p.t.datum < period.fran)) return false;
    if (period.tom && (!p.t.datum || p.t.datum > period.tom)) return false;
    if (!q) return true;
    return [p.t.beskrivning, p.t.motpart, p.filnamn, String(p.t.belopp), p.t.kontering?.konto ?? '']
      .some((x) => x?.toLowerCase().includes(q));
  };
  const passar = (r: Rad) => r.some(passarPost);
  const arPending = (r: Rad) => r.some((p) => !arKlar(p.t) && !!p.t.transaktionId && !!pending[p.t.transaktionId]);
  const pendingRader = granskaRader.filter(arPending);
  const visadeGranska = granskaRader.filter((r) => granskaVy === 'alla' || (granskaVy === 'pending') === arPending(r));
  const VYER: { id: GranskaVy; namn: string; antal: number }[] = [
    { id: 'alla', namn: 'Alla', antal: antal(granskaRader) },
    { id: 'pending', namn: 'Väntar på information', antal: antal(pendingRader) },
    { id: 'avgora', namn: 'Att avgöra', antal: antal(granskaRader) - antal(pendingRader) },
  ];

  const filer = (underlag ?? []).filter((u) => u.sortering !== 'ovrigt' && (!filsok || u.file_name.toLowerCase().includes(filsok.toLowerCase())));
  const nyaSet = new Set(attKora);

  const FLIKAR: { id: Flik; namn: string; antal: number; farg: string }[] = [
    { id: 'transaktioner', namn: 'Transaktioner', antal: antal(klaraRader), farg: 'bg-emerald-100 text-emerald-800' },
    { id: 'granska', namn: 'Granska', antal: antal(granskaRader), farg: 'bg-amber-100 text-amber-800' },
    { id: 'ovrigt', namn: 'Övrigt', antal: ovriga.length, farg: 'bg-slate-100 text-slate-600' },
    { id: 'underlag', namn: 'Underlag', antal: attKora.length, farg: 'bg-blue-100 text-blue-800' },
  ];

  const filterRad = (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök motpart, belopp eller konto"
        className="flex-1 min-w-48 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 bg-white" />
      <select
        value={periodval(ar).find((p) => p.fran === period.fran && p.tom === period.tom)?.namn ?? ''}
        onChange={(e) => {
          const p = periodval(ar).find((x) => x.namn === e.target.value);
          setPeriod(p ? { fran: p.fran, tom: p.tom } : { fran: '', tom: '' });
        }}
        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white text-slate-900"
      >
        <option value="">Alla datum</option>
        {periodval(ar).map((p) => <option key={p.namn} value={p.namn}>{p.namn}</option>)}
      </select>
    </div>
  );

  return (
    <Atgarder.Provider value={atgarder}>
     <Pending.Provider value={pending}>
      <div>
        <div className="flex gap-6 border-b border-slate-200 mb-4">
          {FLIKAR.map((f) => (
            <button key={f.id} onClick={() => setFlik(f.id)}
              className={`-mb-px py-2.5 text-sm border-b-2 transition flex items-center gap-1.5 ${vald === f.id ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {f.namn}
              {f.antal > 0 && <span className={`text-xs rounded-full px-2 py-px tabular-nums ${f.farg}`}>{f.id === 'underlag' ? `${f.antal} nya` : f.antal}</span>}
            </button>
          ))}
        </div>

        {vantar && <p className="mb-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">En körning pågår. Sidan uppdateras när den är klar.</p>}
        {fel.map((r) => <p key={r.id} className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Körningen {TID.format(new Date(r.created_at))} misslyckades: {r.fel}</p>)}
        {laddfel && <p className="mb-3 text-red-600 text-sm">{laddfel}</p>}

        {vald === 'transaktioner' && (
          <>
            {filterRad}
            <Lista rader={klaraRader.filter(passar)} tom={klaraRader.length ? 'Inget matchar sökningen.' : 'Inga klara transaktioner än.'} />
          </>
        )}

        {vald === 'granska' && (
          <>
            <OsakraMejl userId={userId} uppdaterad={rader} />
            {pendingRader.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {VYER.map((v) => (
                  <button key={v.id} onClick={() => setGranskaVy(v.id)}
                    className={`text-xs rounded-full px-3 py-1 border transition ${granskaVy === v.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}>
                    {v.namn} <span className="tabular-nums opacity-70">{v.antal}</span>
                  </button>
                ))}
              </div>
            )}
            {granskaRader.length > 0 && filterRad}
            <Lista rader={visadeGranska.filter(passar)} granska
              tom={!granskaRader.length ? 'Inget att granska.' : visadeGranska.length ? 'Inget matchar sökningen.' : granskaVy === 'pending' ? 'Inget väntar på information.' : 'Inget att avgöra.'} />
            {(kontroller.length > 0 || anteckningar.length > 0) && (
              <details className="mt-4 text-sm bg-slate-50 border border-slate-200 rounded-xl group">
                <summary className="px-4 py-2.5 font-medium text-slate-700 cursor-pointer select-none list-none flex items-center gap-2">
                  <span className="text-slate-400 transition group-open:rotate-90">▸</span>
                  Modellens anteckningar
                  <span className="text-xs font-normal text-slate-400">{kontroller.length + anteckningar.length}</span>
                </summary>
                <ul className="px-4 pb-3 pl-9 space-y-1 list-disc">
                  {kontroller.map((k, i) => <li key={`k${i}`} className="text-amber-700">{k}</li>)}
                  {anteckningar.map((a, i) => <li key={`a${i}`} className="text-slate-700">{a}</li>)}
                </ul>
              </details>
            )}
          </>
        )}

        {vald === 'ovrigt' && (
          <div className="space-y-2">
            {ovriga.map((f) => <FilKort key={f.id} fil={f} />)}
            {!ovriga.length && <Tomt text="Inga övriga filer." />}
          </div>
        )}

        {vald === 'underlag' && (
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200">
              <input value={filsok} onChange={(e) => setFilsok(e.target.value)} placeholder="Sök filnamn"
                className="flex-1 min-w-48 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 bg-white" />
              <button onClick={korValda} disabled={!valda.length || startar}
                className="border border-blue-600 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-lg disabled:opacity-40">
                {startar ? 'Skickar…' : valda.length ? `Kör om ${valda.length} valda` : 'Kör om valda'}
              </button>
              {startfel && <span className="text-sm text-red-600 basis-full">{startfel}</span>}
            </div>
            {filer.length > 0 && (() => {
              // Markerar alla som syns, alltså de som matchar sökningen
              const allaValda = filer.every((u) => valda.includes(u.id));
              const ids = new Set(filer.map((u) => u.id));
              return (
                <label className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border-b border-slate-200 cursor-pointer select-none">
                  <input type="checkbox" checked={allaValda} className="accent-blue-600"
                    onChange={() => setValda((l) => (allaValda ? l.filter((id) => !ids.has(id)) : [...new Set([...l, ...ids])]))} />
                  {allaValda ? 'Avmarkera alla' : 'Markera alla'}
                  <span className="text-xs font-normal text-slate-400">{filer.length} {filsok ? 'som matchar sökningen' : 'underlag'}</span>
                </label>
              );
            })()}
            <ul className="divide-y divide-slate-100">
              {filer.map((u) => (
                <li key={u.id}>
                  <label className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer ${valda.includes(u.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={valda.includes(u.id)} className="accent-blue-600"
                      onChange={(e) => setValda((l) => (e.target.checked ? [...l, u.id] : l.filter((id) => id !== u.id)))} />
                    <a href={filLank(u.id)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`text-blue-700 hover:underline truncate ${senastesUnderlag.has(u.id) ? 'font-bold' : ''}`}>{u.file_name}</a>
                    {u.del_av && <span className="text-slate-400 text-xs">sida</span>}
                    <span className="ml-auto flex items-center gap-3 shrink-0">
                      {u.transaktioner > 0 && <span className="text-xs text-slate-400 tabular-nums">{u.transaktioner} tx</span>}
                      {u.id in hanterade && (
                        <span className="text-xs text-slate-500">
                          Räknas som körd ·{' '}
                          <button type="button" disabled={hanterar === u.id} onClick={(e) => { e.preventDefault(); e.stopPropagation(); angraHanterad(u.id); }}
                            className="text-blue-700 hover:underline disabled:opacity-40">Ångra</button>
                        </span>
                      )}
                      {(nyttFranKunden(u) || nyaSet.has(u.id)) && (
                        <button type="button" disabled={hanterar === u.id} title="Räkna som körd utan att köra den"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markeraHanterad(u.id); }}
                          className="text-xs font-medium text-slate-600 border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 rounded-full px-2 py-px disabled:opacity-40">
                          {hanterar === u.id ? '…' : '✓ Klar'}
                        </button>
                      )}
                      {nyttFranKunden(u)
                        ? <span className="text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-px">Nytt från kunden</span>
                        : nyaSet.has(u.id)
                          ? <span className="text-xs font-medium text-blue-800 bg-blue-100 rounded-full px-2 py-px">Ny</span>
                          : <span className="text-xs text-slate-400">{TID.format(new Date(u.created_at))}</span>}
                    </span>
                  </label>
                </li>
              ))}
              {!filer.length && <li className="px-4 py-4 text-sm text-slate-500">Inga underlag.</li>}
            </ul>
          </div>
        )}
      </div>
     </Pending.Provider>
    </Atgarder.Provider>
  );
}

/** Pending-märket: att transaktionen väntar på information, och om frågan skickats till kunden. */
function PendingMarke({ info }: { info: PendingInfo }) {
  const gammal = !!info.fragaSkickad && dagar(info.fragaSkickad) >= 7;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="font-medium text-sky-800 bg-sky-100 rounded-full px-2 py-px whitespace-nowrap">Väntar på information</span>
      {info.fragaSkickad ? (
        <span className={`whitespace-nowrap ${gammal ? 'text-orange-700' : 'text-slate-600'}`}>
          ✉ Fråga skickad {DAGEN.format(new Date(info.fragaSkickad))}{gammal ? ` · ${dagar(info.fragaSkickad)} dagar utan svar` : ''}
        </span>
      ) : (
        <span className="text-slate-500 whitespace-nowrap">{info.utkast ? 'Frågan ligger som utkast, inte skickad' : 'Ingen fråga skickad'}</span>
      )}
      {info.provadAt && <span className="text-slate-400 whitespace-nowrap">Prövad igen {DAGEN.format(new Date(info.provadAt))}</span>}
    </span>
  );
}

function Tomt({ text }: { text: string }) {
  return <p className="bg-white border border-dashed border-slate-300 rounded-xl px-4 py-8 text-center text-sm text-slate-500">{text}</p>;
}

/** Korten, ett i taget utfällt. Möjliga dubbletter står ihop i en ruta. */
function Lista({ rader, granska = false, tom }: { rader: Rad[]; granska?: boolean; tom: string }) {
  const [oppen, setOppen] = useState<string | null>(null);
  if (!rader.length) return <Tomt text={tom} />;
  const kort = (p: Post) => (
    <TxKort key={p.nyckel} post={p} granska={granska && !arKlar(p.t)} oppen={oppen === p.nyckel}
      onKlick={() => setOppen((o) => (o === p.nyckel ? null : p.nyckel))} />
  );
  return (
    <div className="space-y-2">
      {rader.map((r) => r.length === 1 ? kort(r[0]) : (
        <div key={r[0].nyckel} className="rounded-xl border border-dashed border-amber-400 bg-amber-50/60 p-2 space-y-2">
          <p className="px-2 pt-0.5 text-xs font-medium text-amber-800">Möjlig dubblett — {r.length} rader som kan vara samma affär</p>
          {r.map(kort)}
        </div>
      ))}
    </div>
  );
}

function Prick({ omdome }: { omdome: string | undefined }) {
  const o = omdome ? OMDOME[omdome] : null;
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${o?.prick ?? 'bg-slate-300'}`} title={o?.text} />;
}

function Belopp({ t }: { t: Tx }) {
  return (
    <span className={`ml-auto tabular-nums font-medium whitespace-nowrap ${t.riktning === 'in' ? 'text-emerald-700' : 'text-slate-900'}`}>
      {t.riktning === 'in' ? '+' : '−'}{kr.format(t.belopp)}{t.valuta !== 'SEK' ? ` ${t.valuta}` : ''}
    </span>
  );
}

/** En transaktion: sammanfattning, och allt annat när man klickar på den. */
function TxKort({ post: p, granska, oppen, onKlick }: { post: Post; granska: boolean; oppen: boolean; onKlick: () => void }) {
  const a = useContext(Atgarder)!;
  const { t } = p;
  const k = t.kontering;
  const kopplad = arKopplad(t);
  const [sparar, setSparar] = useState(false);
  const [godkannFel, setGodkannFel] = useState('');
  const fraga = granska ? fragan(t) : null;
  const kanGodkanna = !kopplad && k?.omdome === 'gul' && !t.godkand;
  const pending = useContext(Pending);
  const vantar = granska && t.transaktionId ? pending[t.transaktionId] : undefined;

  async function godkann(val: boolean) {
    setSparar(true);
    setGodkannFel('');
    try { await a.godkann(p.plats, val); } catch (err) { setGodkannFel(err instanceof Error ? err.message : String(err)); } finally { setSparar(false); }
  }

  return (
    <div className={`bg-white border rounded-xl transition ${oppen ? 'border-blue-300 shadow-sm' : granska ? 'border-amber-300 hover:border-amber-400' : 'border-slate-200 hover:border-slate-300'}`}>
      <div role="button" tabIndex={0} onClick={onKlick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKlick(); } }}
        className="px-4 py-3 cursor-pointer select-none">
        <div className="flex items-baseline gap-3">
          <span className={`text-xs tabular-nums w-20 shrink-0 ${p.ny ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{t.datum ?? 'utan datum'}</span>
          <span className={`truncate ${p.ny ? 'font-bold text-slate-950' : 'font-normal text-slate-700'}`}>{t.motpart || t.beskrivning || '—'}</span>
          <Belopp t={t} />
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm">
          <span className="w-20 shrink-0" />
          {kopplad ? (
            <span className="text-slate-400 text-xs">Fanns redan i bokföringen</span>
          ) : (
            <>
              <Prick omdome={t.godkand || t.andrad ? 'gron' : k?.omdome} />
              <span className="text-slate-700 truncate">{k?.konto ? `${k.konto} ${k.kontonamn}` : <span className="text-red-600">Inget konto</span>}</span>
              {k && <span className="text-slate-400 text-xs whitespace-nowrap">{momsText(k.momssats, k.momsdelar, k.omvand)}</span>}
              {t.godkand && <span className="text-xs text-emerald-700">✓ Godkänd</span>}
              {t.andrad && <span className="text-xs text-emerald-700">✎ Ändrad</span>}
              {!granska && t.omkord?.lost && <span className="text-xs text-emerald-700 whitespace-nowrap">Löst med ny information</span>}
            </>
          )}
          <span className="ml-auto text-xs text-slate-400 truncate max-w-[40%]">
            {p.filnamn}{p.filer.length > 1 && <span className="ml-1 text-slate-500">+{p.filer.length - 1}</span>}
          </span>
        </div>
        {vantar && (
          <div className="flex items-center gap-3 mt-2">
            <span className="w-20 shrink-0" />
            <PendingMarke info={vantar} />
          </div>
        )}
        {(fraga || kanGodkanna) && (
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="w-20 shrink-0" />
            {fraga && <span className="text-amber-800 text-xs flex-1 line-clamp-2">{fraga}</span>}
            {/* Pending väntar på information: Godkänn finns i det utfällda kortet, bredvid Redigera */}
            {vantar && <span className="ml-auto text-xs font-medium text-sky-800 bg-sky-100 rounded-lg px-3 py-1">Pending</span>}
            {kanGodkanna && !vantar && (
              <button onClick={(e) => { e.stopPropagation(); godkann(true); }} disabled={sparar}
                className="ml-auto text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-1 disabled:opacity-40">
                {sparar ? 'Sparar…' : 'Godkänn'}
              </button>
            )}
          </div>
        )}
        {godkannFel && <p className="mt-1 text-xs text-red-600">{godkannFel}</p>}
      </div>
      {oppen && <TxDetaljer post={p} onAngra={t.godkand ? () => godkann(false) : undefined}
        onGodkann={vantar && kanGodkanna ? () => godkann(true) : undefined} sparar={sparar} />}
    </div>
  );
}

/** Det utfällda kortet: AI:ns resonemang, verifikationen och åtgärderna. */
function TxDetaljer({ post: p, onAngra, onGodkann, sparar }: { post: Post; onAngra?: () => void; onGodkann?: () => void; sparar: boolean }) {
  const a = useContext(Atgarder)!;
  const { t, gammal } = p;
  const k = t.kontering;
  const kopplad = arKopplad(t);
  const [lage, setLage] = useState<'' | 'anteckna' | 'redigera' | 'radera'>('');
  const kanRedigera = !!t.transaktionId && !kopplad && t.dublett.status !== 'dublett';
  const kanRadera = !!t.transaktionId && !kopplad;
  const gamla = gammal ? gamlaKonton(gammal) : [];
  const nyaKonton = k ? [...new Set([k.konto, ...(k.momsdelar ?? []).map((d) => d.konto)].filter((x): x is string => !!x))] : [];
  const skiljer = !!gammal && gamla.length > 0 && !!k?.konto && !nyaKonton.some((n) => gamla.includes(n));
  const flaggor = (k?.flaggor ?? []).filter((f) => f.typ !== 'saknas');

  return (
    <div className="border-t border-slate-200 px-4 py-4 space-y-4 text-sm">
      {kopplad && <p className="text-slate-600">{t.kopplad}</p>}

      {k && (
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">AI:ns resonemang</h4>
          <p className="text-slate-700 leading-relaxed">{k.motivering}</p>
          {t.antaganden && <p className="text-slate-500 mt-1.5">Antaganden: {t.antaganden}</p>}
          {k.regler.length > 0 && <p className="text-slate-500 mt-1">Kundregler: {k.regler.join(', ')}</p>}
          {t.omkord && (
            <p className="text-slate-500 mt-1">
              Konterad igen med ny information {DAGEN.format(new Date(t.omkord.at))}{t.omkord.lost ? ' — det räckte, och den bokfördes.' : ' — det räckte inte än.'}
            </p>
          )}
        </section>
      )}

      {!arKlar(t) && (t.preliminara?.length ?? 0) > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Preliminära konton</h4>
          <ul className="space-y-0.5">
            {t.preliminara!.map((pk) => (
              <li key={pk.konto} className="text-slate-700">
                <KontoLank konto={pk.konto} className="font-medium text-slate-800">{pk.konto} {pk.kontonamn}</KontoLank>
                {pk.nar && <span className="text-slate-500"> — {pk.nar}</span>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-1">Följer med när den konteras om i kväll, om kunden svarat eller nya bankrader kommit.</p>
        </section>
      )}

      {(flaggor.length > 0 || t.saknas.length > 0 || t.dublett.status !== 'unik' || t.fel) && (
        <section className="space-y-1">
          {t.fel && <p className="text-red-600">{t.fel}</p>}
          {flaggor.map((f, i) => <p key={i} className={f.allvar === 'stopp' ? 'text-red-600' : 'text-amber-700'}>{f.text}</p>)}
          {t.saknas.map((s, i) => <p key={`s${i}`} className="text-amber-700">Saknas: {s.vad} — {s.varfor}</p>)}
          {t.dublett.status !== 'unik' && (
            <p className={t.dublett.status === 'dublett' ? 'text-red-600' : 'text-amber-700'}>
              {t.dublett.status === 'dublett' ? 'Dubblett' : 'Kanske dubblett'} av {t.dublett.refText || 'okänd rad'}: {t.dublett.motivering}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Bokföring</h4>
          {k?.konto && (
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <KontoLank konto={k.konto} className="font-medium text-slate-800">{k.konto} {k.kontonamn}</KontoLank>
              <span className="text-slate-500">{momsText(k.momssats, k.momsdelar, k.omvand)}</span>
            </div>
          )}
          {t.verifikation ? (
            <>
              {t.faktura && <div className="text-xs text-slate-500 mt-1">Fakturan {t.faktura.datum}</div>}
              <Rader rader={t.verifikation} />
            </>
          ) : !kopplad && <p className="text-slate-400 text-xs">Ingen verifikation än</p>}
          {t.faktura && (
            <>
              <div className="text-xs text-slate-500 mt-2">Betalningen {t.faktura.betalning.datum}</div>
              <Rader rader={t.faktura.betalning.rader} />
            </>
          )}
        </section>
        <section className="text-slate-600 space-y-0.5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Uppgifter</h4>
          {t.beskrivning && <p>{t.beskrivning}</p>}
          {t.moms ? <p>Moms {kr.format(t.moms)}</p> : null}
          {t.kronor && t.valuta !== 'SEK' && <p>= {kr.format(t.kronor.belopp)} kr (kurs {t.kronor.kurs})</p>}
          {t.vat_nummer && <p>VAT {t.vat_nummer}</p>}
          <div className="pt-1">
            <p className="text-xs text-slate-500">{p.filer.length === 1 ? 'Underlag' : `${p.filer.length} underlag`}</p>
            <ul className="space-y-0.5">
              {p.filer.map((f) => (
                <li key={f.id}><a href={filLank(f.id)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline break-all">{f.namn}</a></li>
              ))}
            </ul>
          </div>
          {gammal && (
            <p className={skiljer ? 'text-amber-700' : 'text-slate-500'}>
              Förut: {gamla.join(', ') || 'inte konterad'}{skiljer ? ' — skiljer sig' : ''}
            </p>
          )}
          {t.anteckning && <p className="text-slate-500">Din anteckning: {t.anteckning}</p>}
        </section>
      </div>

      {lage === 'anteckna' && <Anteckna post={p} onStang={() => setLage('')} />}
      {lage === 'redigera' && <Redigera post={p} onStang={() => setLage('')} />}
      {lage === 'radera' && <Radera plats={p.plats} radera={a.radera} onStang={() => setLage('')} />}

      {!lage && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button onClick={() => setLage('anteckna')} className="border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg">Anteckna och kör om</button>
          {kanRedigera && <button onClick={() => setLage('redigera')} className="border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg">Redigera</button>}
          {onGodkann && (
            <button onClick={onGodkann} disabled={sparar}
              className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg disabled:opacity-40">
              {sparar ? 'Sparar…' : 'Godkänn'}
            </button>
          )}
          {onAngra && <button onClick={onAngra} disabled={sparar} className="text-xs text-slate-500 hover:text-slate-800 px-2 disabled:opacity-40">Ångra godkännandet</button>}
          {kanRadera && <button onClick={() => setLage('radera')} className="ml-auto text-xs font-medium text-red-600 hover:text-red-700 px-2">Radera</button>}
        </div>
      )}
    </div>
  );
}

/** En verifikations rader, debet och kredit. */
function Rader({ rader }: { rader: { konto: string; kontonamn: string; belopp: number }[] }) {
  return (
    <table className="text-xs tabular-nums text-slate-700">
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

/** Anteckning på en transaktion: skrivs in och filen körs om direkt. */
function Anteckna({ post: p, onStang }: { post: Post; onStang: () => void }) {
  const a = useContext(Atgarder)!;
  const [text, setText] = useState('');
  const [startar, setStartar] = useState(false);
  const [fel, setFel] = useState('');
  async function kor() {
    setStartar(true);
    setFel('');
    try {
      await a.korOm(text, p.underlagId, vilken(p.t));
      onStang();
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
      setStartar(false);
    }
  }
  return (
    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2}
        placeholder="Vad ska AI:n veta? T.ex. ”Det här är ett privat köp”"
        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 bg-white" />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button onClick={kor} disabled={!text.trim() || startar} className="bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-40">
          {startar ? 'Skickar…' : 'Kör om med anteckningen'}
        </button>
        <button onClick={onStang} className="text-slate-500 hover:text-slate-800">Avbryt</button>
        <span className="text-slate-400">Hela filen körs om.</span>
        {fel && <span className="text-red-600">{fel}</span>}
      </div>
    </div>
  );
}

/** Ändra datum, förklaring, motpart, belopp, konto och moms. Sparas och bokförs direkt. */
function Redigera({ post: p, onStang }: { post: Post; onStang: () => void }) {
  const a = useContext(Atgarder)!;
  const { t } = p;
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
  const satt = (falt: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [falt]: e.target.value }));
  async function spara() {
    setSparar(true);
    setFel('');
    try {
      await a.redigera(p.plats, { ...f, belopp: Number(f.belopp.replace(/\s/g, '').replace(',', '.')), momssats: Number(f.momssats) });
      onStang();
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
      setSparar(false);
    }
  }
  const falt = 'border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-900 bg-white';
  const etikett = 'flex flex-col gap-0.5 text-xs text-slate-500';
  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="grid gap-2 grid-cols-2">
        <label className={`${etikett} col-span-2`}>Förklaring<input value={f.beskrivning} onChange={satt('beskrivning')} className={falt} /></label>
        <label className={etikett}>Datum<input type="date" value={f.datum} onChange={satt('datum')} className={falt} /></label>
        <label className={etikett}>Motpart<input value={f.motpart} onChange={satt('motpart')} className={falt} /></label>
        <label className={etikett}>Belopp{t.valuta !== 'SEK' ? ` (${t.valuta})` : ''}<input inputMode="decimal" value={f.belopp} onChange={satt('belopp')} className={`${falt} tabular-nums`} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={etikett}>Konto<input inputMode="numeric" value={f.konto} onChange={satt('konto')} placeholder="5410" className={`${falt} tabular-nums`} /></label>
          <label className={etikett}>Moms
            <select value={f.momssats} onChange={satt('momssats')} className={falt}>
              {['25', '12', '6', '0'].map((s) => <option key={s} value={s}>{s} %</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button onClick={spara} disabled={sparar} className="bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-40">
          {sparar ? 'Sparar…' : 'Spara och bokför'}
        </button>
        <button onClick={onStang} className="text-slate-500 hover:text-slate-800">Avbryt</button>
        {fel && <span className="text-red-600">{fel}</span>}
      </div>
    </div>
  );
}

function Radera({ plats, radera, onStang }: { plats: Plats; radera: (p: Plats) => Promise<void>; onStang: () => void }) {
  const [raderar, setRaderar] = useState(false);
  const [fel, setFel] = useState('');
  async function kor() {
    setRaderar(true);
    setFel('');
    try { await radera(plats); } catch (err) { setFel(err instanceof Error ? err.message : String(err)); setRaderar(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs">
      <span className="text-red-800">Transaktionen och dess verifikation tas bort ur bokföringen.</span>
      <button onClick={kor} disabled={raderar} className="bg-red-600 text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-40">{raderar ? 'Raderar…' : 'Ja, radera'}</button>
      <button onClick={onStang} disabled={raderar} className="text-slate-500 hover:text-slate-800">Avbryt</button>
      {fel && <span className="text-red-600">{fel}</span>}
    </div>
  );
}

/** En fil i Övrigt: varför den hamnade här, och att öppna eller köra om den. */
function FilKort({ fil: f }: { fil: OvrigFil }) {
  const a = useContext(Atgarder)!;
  const [oppen, setOppen] = useState(false);
  const [startar, setStartar] = useState(false);
  const [fel, setFel] = useState('');
  async function korOm() {
    setStartar(true);
    setFel('');
    try { await a.korOmFil(f.id); } catch (err) { setFel(err instanceof Error ? err.message : String(err)); } finally { setStartar(false); }
  }
  return (
    <div className={`bg-white border rounded-xl ${oppen ? 'border-blue-300 shadow-sm' : f.varning ? 'border-amber-300' : 'border-slate-200 hover:border-slate-300'}`}>
      <div role="button" tabIndex={0} onClick={() => setOppen((o) => !o)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOppen((o) => !o); } }}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none text-sm">
        <span className="text-slate-400" aria-hidden>▤</span>
        <span className={`truncate ${f.ny ? 'font-bold text-slate-950' : 'font-normal text-slate-700'}`}>{f.namn}</span>
        <span className={`ml-auto text-xs rounded-full px-2 py-px whitespace-nowrap ${f.varning ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{f.typ}</span>
      </div>
      {oppen && (
        <div className="border-t border-slate-200 px-4 py-3 space-y-3 text-sm">
          <p className={f.varning ? 'text-amber-800' : 'text-slate-700'}>{f.orsak || 'Ingen förklaring.'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={filLank(f.id)} target="_blank" rel="noreferrer" className="border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg">Öppna filen</a>
            <button onClick={korOm} disabled={startar} className="border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40">
              {startar ? 'Skickar…' : 'Kör om filen'}
            </button>
            {fel && <span className="text-xs text-red-600">{fel}</span>}
          </div>
        </div>
      )}
    </div>
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
  if (!utkast && !info.antal && !skickat && !fel) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-medium text-slate-900 text-sm">Mejl till kunden</h3>
        <span className="text-xs text-slate-500 mr-auto">
          {utkast ? `Utkast till ${utkast.till}` : `${info.antal} ${info.antal === 1 ? 'fråga' : 'frågor'} att ställa`}
        </span>
        {!utkast && info.antal > 0 && (
          <button onClick={() => kor('skriver')} disabled={!!arbetar}
            className="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40">
            {arbetar === 'skriver' ? 'AI:n skriver…' : 'Skriv utkast'}
          </button>
        )}
      </div>
      {!utkast && (info.fragade > 0 || skickat) && (
        <p className="text-xs">
          {info.fragade > 0 && <span className="text-amber-700">{info.fragade === info.antal ? (info.antal === 1 ? 'Den' : 'Alla') : `${info.fragade} av dem`} har frågats om förut utan svar. </span>}
          {skickat && <span className="text-emerald-700">Mejlet skickades till {skickat}.</span>}
        </p>
      )}
      {utkast && (
        <>
          {info.nya > 0 && <p className="text-xs text-amber-700">{info.nya} nya frågor sedan utkastet skrevs. Skriv om för att få med dem.</p>}
          <input value={amne} onChange={(e) => setAmne(e.target.value)} placeholder="Ämne"
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 bg-white" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white font-sans leading-relaxed" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => kor('skickar')} disabled={!!arbetar || !text.trim()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-1.5 rounded-lg disabled:opacity-40">
              {arbetar === 'skickar' ? 'Skickar…' : 'Skicka'}
            </button>
            <button onClick={() => kor('skriver')} disabled={!!arbetar} className="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40">
              {arbetar === 'skriver' ? 'AI:n skriver…' : 'Skriv om'}
            </button>
            <button onClick={() => kor('slanger')} disabled={!!arbetar} className="ml-auto text-xs text-slate-500 hover:text-red-600 disabled:opacity-40">Släng</button>
          </div>
        </>
      )}
      {fel && <p className="text-sm text-red-600">{fel}</p>}
    </div>
  );
}
