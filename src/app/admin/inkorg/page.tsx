'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { RAKNA_OM } from '../_nav-menu';
import type {
  AiAnteckning, InkorgFil, InkorgKategori, InkorgKonversation, InkorgMeddelande, InkorgSkickat, InkorgTrad, InkorgUtkast, MejlBilaga,
} from '@/lib/admin-types';

/**
 * Inkorgen, byggd som Gmail: mappar till vänster, listan över hela sidan, och
 * en konversation öppnas i stället för listan. Mejl och SMS ligger i samma
 * tråd, en per person, med AI:ns utkast längst ner och kunden i en panel till
 * höger. Inget går ut förrän någon trycker Skicka.
 *
 * Kortkommandon som i Gmail: c skriver nytt, / söker, j/k bläddrar mellan
 * konversationerna och u (eller Esc) går tillbaka till listan.
 */

type Mapp = InkorgKategori | 'utkast' | 'skickat';

const IKONER = {
  meny: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  penna: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  lead: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M19 8v6', 'M22 11h-6'],
  saknar: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M12 8v4', 'M12 16h.01'],
  kund: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  utkast: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  skickat: ['M22 2 11 13', 'M22 2 15 22 11 13 2 9Z'],
  tillbaka: ['M19 12H5', 'M12 19l-7-7 7-7'],
  arkiv: ['M21 8v13H3V8', 'M1 3h22v5H1Z', 'M10 12h4'],
  olast: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'm22 6-10 7L2 6'],
  last: ['M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z', 'm22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10'],
  mejl: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'm22 6-10 7L2 6'],
  sms: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z'],
  telefon: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z'],
  uppdatera: ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6'],
  vanster: ['m15 18-6-6 6-6'],
  hoger: ['m9 18 6-6-6-6'],
  sok: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'm21 21-4.3-4.3'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  minus: ['M5 12h14'],
  papperskorg: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  ladda: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  gem: ['m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48'],
  ai: ['m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z'],
  panel: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M15 3v18'],
  svara: ['M9 17l-5-5 5-5', 'M20 18v-2a4 4 0 0 0-4-4H4'],
  extern: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  tom: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z'],
} satisfies Record<string, string[]>;
type IkonNamn = keyof typeof IKONER;

function Ikon({ namn, className = 'w-5 h-5' }: { namn: IkonNamn; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {IKONER[namn].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function IkonKnapp({ ikon, titel, onClick, disabled, className = '', snurrar }: {
  ikon: IkonNamn; titel: string; onClick?: () => void; disabled?: boolean; className?: string; snurrar?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={titel} aria-label={titel}
      className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent transition ${className}`}>
      <Ikon namn={ikon} className={`w-[18px] h-[18px] ${snurrar ? 'animate-spin' : ''}`} />
    </button>
  );
}

const KATEGORIER: { id: InkorgKategori; namn: string }[] = [
  { id: 'lead', namn: 'Leads' },
  { id: 'saknar', namn: 'Saknar uppgifter' },
  { id: 'kund', namn: 'Kunder' },
];

const KATEGORI_NAMN: Record<InkorgKategori, string> = {
  lead: 'Lead',
  saknar: 'Saknar uppgifter',
  kund: 'Kund',
};

const KATEGORI_FARG: Record<InkorgKategori, string> = {
  lead: 'bg-sky-50 text-sky-700 ring-sky-200',
  saknar: 'bg-amber-50 text-amber-800 ring-amber-200',
  kund: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

function KategoriChip({ kategori }: { kategori: InkorgKategori }) {
  return (
    <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md ring-1 ring-inset ${KATEGORI_FARG[kategori]}`}>
      {KATEGORI_NAMN[kategori]}
    </span>
  );
}

const SmsChip = () => (
  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">SMS</span>
);

const AVATAR_FARGER = ['bg-sky-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600', 'bg-indigo-600', 'bg-orange-600'];

/** En färgad cirkel med första bokstaven, som i Gmail. Vi själva är den mörka med EB. */
function Avatar({ namn, vi, storlek = 'md' }: { namn: string; vi?: boolean; storlek?: 'sm' | 'md' | 'lg' }) {
  const s = storlek === 'lg' ? 'w-16 h-16 text-2xl' : storlek === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';
  if (vi) return <span className={`${s} shrink-0 rounded-full bg-slate-800 text-white font-semibold flex items-center justify-center !text-xs`}>EB</span>;
  let h = 0;
  for (const c of namn) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bokstav = (namn.match(/[a-zåäöéü0-9]/i)?.[0] ?? '?').toUpperCase();
  return (
    <span className={`${s} shrink-0 rounded-full ${AVATAR_FARGER[h % AVATAR_FARGER.length]} text-white font-medium flex items-center justify-center`}>
      {bokstav}
    </span>
  );
}

function tidKort(iso: string): string {
  const d = new Date(iso);
  const idag = new Date();
  if (d.toDateString() === idag.toDateString()) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const igar = new Date(idag); igar.setDate(idag.getDate() - 1);
  if (d.toDateString() === igar.toDateString()) return 'igår';
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', ...(d.getFullYear() !== idag.getFullYear() ? { year: 'numeric' } : {}) });
}
const tidLang = (iso: string) => new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "Sv: Re: Hej" och "Hej" är samma ämne. */
const utanSvar = (s: string) => s.replace(/^\s*((re|sv|vs|vb|fw|fwd)\s*:\s*)+/i, '').trim();
const rensaAmne = (s: string) => utanSvar(s).toLowerCase();

const radSkugga = 'hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] hover:z-10';

export default function InkorgPage() {
  const [lista, setLista] = useState<InkorgKonversation[] | null>(null);
  const [fel, setFel] = useState('');
  const [mapp, setMapp] = useState<Mapp>('lead');
  const [bara, setBara] = useState<'alla' | 'olasta' | 'utkast'>('alla');
  const [sok, setSok] = useState('');
  const [vald, setVald] = useState<string | null>(null);
  /** Var i listan den öppna konversationen låg, så Nästa fungerar även när den försvunnit ur listan. */
  const [valdPos, setValdPos] = useState(0);
  const [nytt, setNytt] = useState(false);
  const [nyttMin, setNyttMin] = useState(false);
  const [markerade, setMarkerade] = useState<Set<string>>(new Set());
  const [skickade, setSkickade] = useState<InkorgSkickat[] | null>(null);
  const [valtSkickat, setValtSkickat] = useState<string | null>(null);
  const [laddar, setLaddar] = useState(false);
  /** Menyn till vänster: smal (bara ikoner) på stor skärm, utfälld som låda på mobil. */
  const [smal, setSmal] = useState(false);
  const [meny, setMeny] = useState(false);
  const sokfalt = useRef<HTMLInputElement>(null);
  /** Konversationen öppnades med en ny rad i historiken — då går Tillbaka med webbläsarens bakåt. */
  const pushad = useRef(false);

  const ladda = useCallback(() => {
    setLaddar(true);
    return fetch('/api/admin/inkorg').then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error); else { setLista(d.konversationer); setFel(''); }
      return (d.konversationer ?? []) as InkorgKonversation[];
    }).catch(() => { setFel('Kunde inte hämta inkorgen'); return [] as InkorgKonversation[]; })
      .finally(() => setLaddar(false));
  }, []);

  const laddaSkickat = useCallback(() => {
    setLaddar(true);
    return fetch('/api/admin/inkorg?vy=skickat').then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error); else setSkickade(d.skickade);
    }).catch(() => setFel('Kunde inte hämta det skickade')).finally(() => setLaddar(false));
  }, []);

  // Hämtas först när mappen öppnas, och sedan om varje gång man går tillbaka till den
  useEffect(() => { if (mapp === 'skickat') laddaSkickat(); }, [mapp, laddaSkickat]);

  useEffect(() => {
    ladda();
    const t = setInterval(ladda, 60_000);
    return () => clearInterval(t);
  }, [ladda]);

  // Mappen och den smala menyn kommer ihåg sig mellan besöken
  useEffect(() => {
    try {
      const m = localStorage.getItem('inkorg.mapp');
      if (m && ['lead', 'saknar', 'kund', 'utkast', 'skickat'].includes(m)) setMapp(m as Mapp);
      if (localStorage.getItem('inkorg.smal') === '1') setSmal(true);
    } catch { /* inget sparat */ }
  }, []);

  const satUrl = (key: string | null, satt: 'push' | 'replace') => {
    const url = key ? `${window.location.pathname}?key=${encodeURIComponent(key)}` : window.location.pathname;
    if (satt === 'push') { window.history.pushState(null, '', url); pushad.current = true; }
    else window.history.replaceState(null, '', url);
  };

  // Webbläsarens bakåt och framåt öppnar och stänger konversationen
  useEffect(() => {
    const vidPop = () => {
      const k = new URLSearchParams(window.location.search).get('key');
      setVald(k);
      pushad.current = !!k;
    };
    window.addEventListener('popstate', vidPop);
    return () => window.removeEventListener('popstate', vidPop);
  }, []);

  const q = sok.trim().toLowerCase();
  /** Söker man letar man i alla mappar, som i Gmail. */
  const synliga = useMemo(() => (lista ?? []).filter((k) =>
    (q ? true : mapp === 'utkast' ? k.utkast > 0 : k.kategori === mapp)
    && (bara === 'alla' || (bara === 'olasta' ? k.olast : k.utkast > 0))
    && (!q || [k.namn, k.email, k.phone, k.senaste.text, k.senaste.amne].some((f) => f?.toLowerCase().includes(q)))),
  [lista, mapp, bara, q]);
  const blandat = !!q || mapp === 'utkast';

  const synligaSkickade = useMemo(() => (skickade ?? []).filter((m) =>
    !q || [m.namn, m.till, m.amne, m.text].some((f) => f?.toLowerCase().includes(q))), [skickade, q]);
  const skickat = skickade?.find((m) => m.id === valtSkickat) ?? null;

  const olasta = (id: InkorgKategori) => (lista ?? []).filter((k) => k.kategori === id && k.olast).length;
  const antalUtkast = (lista ?? []).filter((k) => k.utkast > 0).length;

  // Markeringen gäller det man ser — byts mapp, filter eller sökning börjar den om
  useEffect(() => { setMarkerade(new Set()); }, [mapp, bara, sok]);

  const markera = (key: string) => setMarkerade((m) => {
    const n = new Set(m);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const allaMarkerade = synliga.length > 0 && synliga.every((k) => markerade.has(k.key));

  const andrat = () => { ladda(); window.dispatchEvent(new Event(RAKNA_OM)); };

  /** Oläst igen eller bort ur inkorgen. Historiken rörs inte — en borttagen kommer tillbaka när något nytt händer. */
  const andra = (action: 'olast' | 'dolj', keys: string[]) => {
    if (!keys.length) return;
    const valda = new Set(keys);
    setLista((l) => (action === 'olast'
      ? l?.map((k) => (valda.has(k.key) ? { ...k, olast: true } : k))
      : l?.filter((k) => !valda.has(k.key))) ?? null);
    setMarkerade(new Set());
    fetch('/api/admin/inkorg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, keys }) })
      .then((r) => r.json()).then((d) => { if (d.error) setFel(d.error); })
      .catch(() => setFel('Kunde inte spara ändringen'))
      .finally(andrat);
  };

  const markeraLast = (key: string) => {
    setLista((l) => l?.map((k) => (k.key === key ? { ...k, olast: false } : k)) ?? null);
    fetch('/api/admin/inkorg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'last', key }) })
      .then(() => window.dispatchEvent(new Event(RAKNA_OM))).catch(() => {});
  };

  const oppna = (key: string, satt: 'push' | 'replace' = 'push') => {
    const i = synliga.findIndex((k) => k.key === key);
    if (i >= 0) setValdPos(i);
    setVald(key);
    setValtSkickat(null);
    satUrl(key, satt);
    markeraLast(key);
  };

  const tillbaka = () => {
    if (valtSkickat) { setValtSkickat(null); return; }
    if (pushad.current) { window.history.back(); return; }
    setVald(null);
    satUrl(null, 'replace');
  };

  const valjMapp = (m: Mapp) => {
    setMapp(m);
    setVald(null);
    setValtSkickat(null);
    setMeny(false);
    setSok('');
    pushad.current = false;
    if (new URLSearchParams(window.location.search).has('key')) satUrl(null, 'replace');
    try { localStorage.setItem('inkorg.mapp', m); } catch { /* sparas inte */ }
  };

  const vaxlaSmal = () => setSmal((s) => {
    try { localStorage.setItem('inkorg.smal', s ? '0' : '1'); } catch { /* sparas inte */ }
    return !s;
  });

  // ?key=… öppnar en konversation direkt, t.ex. från översikten
  const franLank = useRef(false);
  useEffect(() => {
    if (!lista || franLank.current) return;
    franLank.current = true;
    const k = new URLSearchParams(window.location.search).get('key');
    const traff = k && lista.find((x) => x.key === k || x.email === k || x.phone === k);
    if (traff) { setMapp(traff.kategori); oppna(traff.key, 'replace'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  /** Efter ett nytt mejl eller SMS: finns personen i listan öppnas tråden direkt. */
  const nyttSkickat = async (nyckel: string) => {
    setNytt(false);
    const traff = (await ladda()).find((k) => k.email?.toLowerCase() === nyckel || k.phone === nyckel);
    if (traff) { valjMapp(traff.kategori); oppna(traff.key); }
  };

  const skriv = () => { setNytt(true); setNyttMin(false); setMeny(false); };

  const pos = vald ? synliga.findIndex((k) => k.key === vald) : -1;
  const foreg = pos >= 0 ? synliga[pos - 1] : synliga[valdPos - 1];
  const nasta = pos >= 0 ? synliga[pos + 1] : synliga[valdPos];
  const iTrad = !!vald || !!skickat;

  // Kortkommandon, som i Gmail. Inte när man skriver i ett fält.
  useEffect(() => {
    const tangent = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) {
        if (e.key === 'Escape' && t === sokfalt.current) sokfalt.current?.blur();
        return;
      }
      if (e.key === 'c') { e.preventDefault(); skriv(); }
      else if (e.key === '/') { e.preventDefault(); sokfalt.current?.focus(); }
      else if ((e.key === 'u' || e.key === 'Escape') && iTrad) tillbaka();
      else if (e.key === 'j' && vald && nasta) oppna(nasta.key, 'replace');
      else if (e.key === 'k' && vald && foreg) oppna(foreg.key, 'replace');
    };
    window.addEventListener('keydown', tangent);
    return () => window.removeEventListener('keydown', tangent);
  });

  const visaText = !smal || meny;

  const mappKnapp = (id: Mapp, namn: string, ikon: IkonNamn, antal: number, titel?: string) => {
    const aktiv = mapp === id && !q;
    return (
      <button key={id} type="button" onClick={() => valjMapp(id)} title={titel ?? namn}
        className={`relative w-full flex items-center gap-4 h-9 rounded-full text-sm transition ${visaText ? 'pl-5 pr-4' : 'justify-center'} ${
          aktiv ? 'bg-sky-200/80 text-sky-950 font-semibold' : 'text-slate-700 hover:bg-slate-200/70'}`}>
        <Ikon namn={ikon} className="w-[18px] h-[18px] shrink-0" />
        {visaText && <span className="flex-1 text-left truncate">{namn}</span>}
        {antal > 0 && (visaText
          ? <span className={`text-xs tabular-nums ${aktiv || id !== 'utkast' ? 'font-bold' : 'font-semibold text-amber-700'}`}>{antal}</span>
          : <span className="absolute top-0 right-2 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] leading-4 font-semibold">{antal}</span>)}
      </button>
    );
  };

  const tradVerktyg = vald && (
    <>
      <IkonKnapp ikon="tillbaka" titel="Tillbaka till listan (u)" onClick={tillbaka} />
      <IkonKnapp ikon="arkiv" titel="Ta bort ur inkorgen. Historiken ligger kvar, och konversationen kommer tillbaka när något nytt händer."
        onClick={() => { andra('dolj', [vald]); tillbaka(); }} />
      <IkonKnapp ikon="olast" titel="Markera som oläst" onClick={() => { andra('olast', [vald]); tillbaka(); }} />
      <span className="flex-1" />
      {pos >= 0 && <span className="text-xs text-slate-500 tabular-nums mr-1 hidden sm:inline">{pos + 1} av {synliga.length}</span>}
      <IkonKnapp ikon="vanster" titel="Föregående (k)" disabled={!foreg} onClick={() => foreg && oppna(foreg.key, 'replace')} />
      <IkonKnapp ikon="hoger" titel="Nästa (j)" disabled={!nasta} onClick={() => nasta && oppna(nasta.key, 'replace')} />
    </>
  );

  return (
    <div className="h-[calc(100dvh-57px)] flex bg-slate-100 text-slate-900">
      {meny && <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" onClick={() => setMeny(false)} />}

      <nav className={`${meny ? 'fixed inset-y-0 left-0 z-50 flex w-64 bg-slate-100 shadow-xl' : 'hidden'} md:static md:z-auto md:shadow-none md:flex flex-col shrink-0 py-2 px-2 ${smal ? 'md:w-[72px]' : 'md:w-60'}`}>
        <div className={`flex items-center gap-2 h-12 mb-2 ${visaText ? 'px-1' : 'justify-center'}`}>
          <IkonKnapp ikon="meny" titel={meny ? 'Stäng menyn' : smal ? 'Visa hela menyn' : 'Gör menyn smal'}
            onClick={() => (meny ? setMeny(false) : vaxlaSmal())} />
          {visaText && <span className="text-[19px] text-slate-700 tracking-tight">Inkorg</span>}
        </div>

        <button type="button" onClick={skriv} title="Skriv ett nytt mejl eller SMS (c)"
          className={`flex items-center gap-3 h-14 mb-4 rounded-2xl bg-sky-200/80 hover:bg-sky-200 hover:shadow-md text-sky-950 font-medium transition ${visaText ? 'px-5 self-start' : 'w-14 justify-center self-center'}`}>
          <Ikon namn="penna" />
          {visaText && <span className="pr-2">Skriv</span>}
        </button>

        <div className="space-y-0.5">
          {mappKnapp('lead', 'Leads', 'lead', olasta('lead'))}
          {mappKnapp('saknar', 'Saknar uppgifter', 'saknar', olasta('saknar'))}
          {mappKnapp('kund', 'Kunder', 'kund', olasta('kund'))}
        </div>
        <div className="my-3 mx-4 h-px bg-slate-200" />
        <div className="space-y-0.5">
          {mappKnapp('utkast', 'Utkast', 'utkast', antalUtkast, 'Konversationer där AI:n skrivit ett utkast som väntar på att skickas')}
          {mappKnapp('skickat', 'Skickat', 'skickat', 0)}
        </div>

        {visaText && (
          <p className="mt-auto px-4 pb-1 text-[11px] leading-5 text-slate-400 hidden md:block">
            <Kbd>c</Kbd> skriv · <Kbd>/</Kbd> sök<br />
            <Kbd>j</Kbd> <Kbd>k</Kbd> nästa/föregående<br />
            <Kbd>u</Kbd> tillbaka till listan
          </p>
        )}
      </nav>

      <div className="flex-1 min-w-0 flex flex-col pb-2 pr-2 pl-2 md:pl-0">
        <div className="h-16 shrink-0 flex items-center gap-2">
          <IkonKnapp ikon="meny" titel="Meny" onClick={() => setMeny(true)} className="md:hidden" />
          <label className="flex-1 max-w-3xl flex items-center gap-3 h-12 px-4 rounded-full bg-slate-200/70 focus-within:bg-white focus-within:shadow-md transition">
            <Ikon namn="sok" className="w-5 h-5 text-slate-500 shrink-0" />
            <input ref={sokfalt} value={sok}
              onChange={(e) => { setSok(e.target.value); if (iTrad) tillbaka(); }}
              placeholder={mapp === 'skickat' ? 'Sök bland skickade' : 'Sök i alla konversationer'}
              className="flex-1 min-w-0 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-500 focus:outline-none" />
            {sok && <IkonKnapp ikon="x" titel="Rensa sökningen" onClick={() => setSok('')} className="-mr-2" />}
          </label>
        </div>

        <div className="relative flex-1 min-h-0 bg-white rounded-2xl flex flex-col overflow-hidden">
          {fel && <p className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100">{fel}</p>}

          {mapp === 'skickat' && skickat ? (
            <SkickatMejl m={skickat} onTillbaka={tillbaka}
              onOppna={() => { if (skickat.personKey && skickat.kategori) { valjMapp(skickat.kategori); oppna(skickat.personKey); } }} />
          ) : vald ? (
            <Trad key={vald} personKey={vald} verktyg={tradVerktyg} onAndrat={andrat} />
          ) : (
            <>
              <div className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-slate-100">
                {mapp !== 'skickat' && (
                  <label className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200/70 cursor-pointer" title="Markera alla">
                    <input type="checkbox" checked={allaMarkerade} aria-label="Markera alla"
                      onChange={() => setMarkerade(allaMarkerade ? new Set() : new Set(synliga.map((k) => k.key)))}
                      className="w-4 h-4 accent-sky-700" />
                  </label>
                )}
                <IkonKnapp ikon="uppdatera" titel="Uppdatera" snurrar={laddar} onClick={() => (mapp === 'skickat' && !q ? laddaSkickat() : ladda())} />
                {markerade.size > 0 && (
                  <>
                    <span className="w-px h-5 bg-slate-200 mx-1" />
                    <IkonKnapp ikon="arkiv" titel="Ta bort ur inkorgen. Historiken ligger kvar, och konversationen kommer tillbaka när något nytt händer."
                      onClick={() => andra('dolj', [...markerade])} />
                    <IkonKnapp ikon="olast" titel="Markera som oläst" onClick={() => andra('olast', [...markerade])} />
                    <span className="text-xs text-slate-600 ml-1">{markerade.size} markerade</span>
                  </>
                )}
                {/* Menyn syns inte på mobil, så där står mappens namn här */}
                {markerade.size === 0 && (
                  <span className="md:hidden ml-1 text-sm font-medium text-slate-800 truncate">
                    {q ? 'Sökträffar' : { lead: 'Leads', saknar: 'Saknar uppgifter', kund: 'Kunder', utkast: 'Utkast', skickat: 'Skickat' }[mapp]}
                  </span>
                )}
                <span className="flex-1" />
                {mapp !== 'skickat' && markerade.size === 0 && (
                  <div className="hidden sm:flex items-center gap-1 mr-2">
                    {(['alla', 'olasta', 'utkast'] as const).filter((b) => !(b === 'utkast' && mapp === 'utkast')).map((b) => (
                      <button key={b} type="button" onClick={() => setBara(b)}
                        className={`h-7 px-3 rounded-full text-xs border transition ${bara === b
                          ? 'bg-sky-100 border-sky-200 text-sky-900 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {{ alla: 'Alla', olasta: 'Olästa', utkast: 'Med utkast' }[b]}
                      </button>
                    ))}
                  </div>
                )}
                <span className="text-xs text-slate-500 tabular-nums px-2 whitespace-nowrap">
                  {mapp === 'skickat' && !q
                    ? skickade && `${synligaSkickade.length} skickade`
                    : lista && (q ? `${synliga.length} träffar i alla mappar` : `${synliga.length} st`)}
                </span>
              </div>

              {mapp === 'skickat' && !q ? (
                !skickade ? <Skelett /> : synligaSkickade.length === 0 ? <Tomt text="Inget skickat än." /> : (
                  <ul className="flex-1 overflow-y-auto">
                    {synligaSkickade.map((m) => (
                      <li key={m.id} tabIndex={0} onClick={() => setValtSkickat(m.id)} onKeyDown={(e) => { if (e.key === 'Enter') setValtSkickat(m.id); }}
                        className={`relative flex items-center gap-3 pl-4 pr-4 py-2 md:py-0 md:h-12 border-b border-slate-100 cursor-pointer bg-white outline-none focus-visible:bg-sky-50 ${radSkugga}`}>
                        <Avatar namn={m.namn ?? m.till} storlek="sm" />
                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center md:gap-3">
                          <div className="md:w-56 shrink-0 truncate text-sm text-slate-800">
                            <span className="text-slate-500">Till: </span>{m.namn ?? m.till}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                            {m.kanal === 'sms' ? <SmsChip /> : null}
                            {m.status === 'failed' && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">Gick inte fram</span>}
                            <span className="truncate">
                              {m.amne && <span className="text-slate-800">{m.amne}</span>}
                              <span className="text-slate-500">{m.amne ? ' – ' : ''}{m.text.replace(/\s+/g, ' ').slice(0, 200)}</span>
                            </span>
                          </div>
                        </div>
                        {m.bilagor.length > 0 && <Ikon namn="gem" className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="shrink-0 w-14 text-right text-xs text-slate-500 tabular-nums self-start md:self-center">{tidKort(m.at)}</span>
                      </li>
                    ))}
                  </ul>
                )
              ) : !lista ? <Skelett /> : synliga.length === 0 ? (
                <Tomt text={q ? `Inget matchar ”${sok.trim()}”.`
                  : mapp === 'utkast' ? 'Inga utkast väntar. Allt är skickat.'
                    : bara === 'olasta' ? 'Inget oläst här.' : bara === 'utkast' ? 'Inga utkast här.' : 'Inget här.'} />
              ) : (
                <ul className="flex-1 overflow-y-auto">
                  {synliga.map((k) => {
                    const markerad = markerade.has(k.key);
                    const amne = k.senaste.kanal === 'mejl' ? k.senaste.amne : null;
                    return (
                      <li key={k.key} tabIndex={0} onClick={() => oppna(k.key)} onKeyDown={(e) => { if (e.key === 'Enter') oppna(k.key); }}
                        className={`group relative flex items-center gap-1 md:gap-2 pl-1.5 pr-3 py-2 md:py-0 md:h-12 border-b border-slate-100 cursor-pointer outline-none transition-shadow focus-visible:bg-sky-50 ${radSkugga} ${
                          markerad ? 'bg-sky-50' : k.olast ? 'bg-white' : 'bg-slate-50/80'}`}>
                        <label onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-slate-200/70 cursor-pointer self-start md:self-center">
                          <input type="checkbox" checked={markerad} onChange={() => markera(k.key)} aria-label={`Markera ${k.namn}`}
                            className="w-4 h-4 accent-sky-700" />
                        </label>
                        <span className="hidden sm:block mr-1"><Avatar namn={k.namn} storlek="sm" /></span>
                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center md:gap-3">
                          <div className="md:w-56 xl:w-64 shrink-0 flex items-center gap-2 min-w-0">
                            <span className={`truncate text-sm ${k.olast ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{k.namn}</span>
                            {k.utkast > 0 && mapp !== 'utkast' && <span className="shrink-0 text-[11px] font-semibold px-1.5 rounded bg-amber-100 text-amber-800">Utkast</span>}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                            {blandat && <KategoriChip kategori={k.kategori} />}
                            {k.senaste.kanal === 'sms' && <SmsChip />}
                            <span className="truncate">
                              {amne && <span className={k.olast ? 'font-bold text-slate-900' : 'text-slate-800'}>{amne}</span>}
                              <span className="text-slate-500">{amne ? ' – ' : ''}{k.senaste.riktning === 'out' && 'Du: '}{k.senaste.text}</span>
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 w-16 md:w-[76px] flex justify-end self-start md:self-center pt-0.5 md:pt-0">
                          <span className={`text-xs tabular-nums md:group-hover:hidden ${k.olast ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{tidKort(k.senaste.at)}</span>
                          <span className="hidden md:group-hover:flex items-center" onClick={(e) => e.stopPropagation()}>
                            <IkonKnapp ikon="arkiv" titel="Ta bort ur inkorgen" onClick={() => andra('dolj', [k.key])} />
                            {k.olast
                              ? <IkonKnapp ikon="last" titel="Markera som läst" onClick={() => markeraLast(k.key)} />
                              : <IkonKnapp ikon="olast" titel="Markera som oläst" onClick={() => andra('olast', [k.key])} />}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {nytt && (
        <NyttMejl minimerad={nyttMin} onMinimera={() => setNyttMin(!nyttMin)}
          onSkickat={nyttSkickat} onAvbryt={() => setNytt(false)} />
      )}
    </div>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-block min-w-[18px] px-1 text-center rounded border border-slate-300 bg-white text-[10px] text-slate-600 font-sans">{children}</kbd>
);

function Skelett() {
  return (
    <ul className="flex-1 overflow-hidden animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <li key={i} className="h-12 flex items-center gap-4 px-4 border-b border-slate-100">
          <span className="w-4 h-4 rounded bg-slate-100" />
          <span className="w-8 h-8 rounded-full bg-slate-100" />
          <span className="w-44 h-3 rounded bg-slate-100" />
          <span className="flex-1 h-3 rounded bg-slate-100" />
          <span className="w-10 h-3 rounded bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}

function Tomt({ text }: { text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Ikon namn="tom" className="w-12 h-12 text-slate-300" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

function Trad({ personKey, verktyg, onAndrat }: { personKey: string; verktyg: React.ReactNode; onAndrat: () => void }) {
  const [trad, setTrad] = useState<InkorgTrad | null>(null);
  const [fel, setFel] = useState('');
  const [visaInfo, setVisaInfo] = useState(false);
  /** Meddelanden man klickat på. Det senaste är öppet från början — klickar man på det stängs det. */
  const [vaxlade, setVaxlade] = useState<Set<string>>(new Set());
  const [visaAlla, setVisaAlla] = useState(false);

  const ladda = useCallback(() => {
    fetch(`/api/admin/inkorg?key=${encodeURIComponent(personKey)}`).then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error); else setTrad(d);
    }).catch(() => setFel('Kunde inte hämta tråden'));
  }, [personKey]);
  useEffect(() => { ladda(); }, [ladda]);

  // Visa det senaste direkt, även när tråden är lång. Bara rutan rullas, inte sidan.
  const rulla = useRef<HTMLDivElement>(null);
  const sista = useRef<HTMLDivElement>(null);
  const antal = trad?.meddelanden.length ?? 0;
  useEffect(() => {
    const r = rulla.current, s = sista.current;
    if (r && s) r.scrollTop += s.getBoundingClientRect().top - r.getBoundingClientRect().top - 16;
  }, [antal]);

  const uppdatera = () => { ladda(); onAndrat(); };

  const verktygsfalt = (
    <div className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-slate-100">
      {verktyg}
      {trad && (
        <button type="button" onClick={() => setVisaInfo(!visaInfo)} title="Kunden, ärenden och anteckningar"
          className={`xl:hidden relative w-9 h-9 flex items-center justify-center rounded-full transition ${visaInfo ? 'bg-sky-100 text-sky-900' : 'text-slate-600 hover:bg-slate-200/70'}`}>
          <Ikon namn="panel" className="w-[18px] h-[18px]" />
          {trad.arenden.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />}
        </button>
      )}
    </div>
  );

  if (fel) return <>{verktygsfalt}<p className="p-6 text-sm text-red-600">{fel}</p></>;
  if (!trad) {
    return (
      <>
        {verktygsfalt}
        <div className="p-8 space-y-4 animate-pulse">
          <div className="h-6 w-2/3 rounded bg-slate-100" />
          {[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><span className="w-10 h-10 rounded-full bg-slate-100" /><span className="flex-1 h-16 rounded bg-slate-100" /></div>)}
        </div>
      </>
    );
  }

  const p = trad.person;
  const kundNamn = p.name || p.company || p.email || p.phone || p.key;
  const senasteMejlIn = [...trad.meddelanden].reverse().find((m) => m.kanal === 'mejl' && m.riktning === 'in');
  const senasteAmne = [...trad.meddelanden].reverse().find((m) => m.kanal === 'mejl' && m.amne)?.amne ?? null;
  const titel = (senasteAmne && utanSvar(senasteAmne)) || kundNamn;

  const meddelanden = trad.meddelanden;
  const sistaId = [...meddelanden].reverse().find((m) => !m.automatisk)?.id;
  const nyckel = (m: InkorgMeddelande) => `${m.kanal}-${m.id}`;
  const oppen = (m: InkorgMeddelande) => vaxlade.has(nyckel(m)) !== (m.id === sistaId);
  const vaxla = (m: InkorgMeddelande) => setVaxlade((s) => {
    const n = new Set(s);
    if (n.has(nyckel(m))) n.delete(nyckel(m)); else n.add(nyckel(m));
    return n;
  });
  // Långa trådar visar det första och de tre sista, med resten bakom en knapp
  const gomda = !visaAlla && meddelanden.length > 6 ? meddelanden.length - 4 : 0;
  const visade = gomda ? [meddelanden[0], ...meddelanden.slice(-3)] : meddelanden;

  return (
    <>
      {verktygsfalt}
      <div className="relative flex-1 min-h-0 flex">
        <div ref={rulla} className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[960px] mx-auto px-4 md:px-8 pt-5 pb-12">
            <div className="flex items-start gap-3 mb-4 pl-[52px]">
              <h1 className="text-[22px] leading-tight text-slate-900 mr-auto break-words min-w-0">{titel}</h1>
              <span className="mt-1"><KategoriChip kategori={trad.kategori} /></span>
            </div>

            {meddelanden.length === 0 && <p className="text-sm text-slate-500 pl-[52px] py-4">Inga meddelanden än.</p>}

            {visade.map((m, i) => {
              return (
                <div key={nyckel(m)} ref={m.id === sistaId && !m.automatisk ? sista : undefined}>
                  <Meddelande m={m} kundNamn={kundNamn} titel={titel} oppen={oppen(m)} onVaxla={() => vaxla(m)} />
                  {gomda > 0 && i === 0 && (
                    <button type="button" onClick={() => setVisaAlla(true)} className="group w-full flex items-center gap-3 py-2">
                      <span className="w-[52px] flex justify-center">
                        <span className="w-9 h-9 rounded-full border border-slate-300 bg-white text-sm text-slate-700 flex items-center justify-center group-hover:bg-slate-100">{gomda}</span>
                      </span>
                      <span className="text-xs text-slate-500 group-hover:text-slate-800">äldre meddelanden</span>
                      <span className="flex-1 h-px bg-slate-200" />
                    </button>
                  )}
                </div>
              );
            })}

            <div className="mt-6 space-y-4">
              {/* En ruta: AI-utkastet när det finns, annars knappar för att svara. Vill vi
                  skriva något eget slänger vi utkastet. */}
              {trad.utkast.length
                ? trad.utkast.map((u) => <Utkast key={`${u.kanal}-${u.id}`} u={u} personKey={personKey} onKlar={uppdatera} />)
                : <Skriv key={antal} email={senasteMejlIn?.adress || p.email} phone={p.phone} svarPa={senasteMejlIn?.gmailMessageId ?? null}
                    amne={senasteAmne} onKlar={uppdatera} />}
            </div>
          </div>
        </div>

        <aside className={`${visaInfo ? 'block' : 'hidden'} xl:block absolute xl:static inset-y-0 right-0 z-20 w-80 max-w-full shrink-0 bg-white border-l border-slate-100 shadow-xl xl:shadow-none overflow-y-auto`}>
          <Kundkort trad={trad} personKey={personKey} onAndrat={ladda} />
        </aside>
      </div>
    </>
  );
}

function Meddelande({ m, kundNamn, titel, oppen, onVaxla }: {
  m: InkorgMeddelande; kundNamn: string; titel: string; oppen: boolean; onVaxla: () => void;
}) {
  const [hel, setHel] = useState(false);
  if (m.automatisk) {
    return (
      <p className="py-2 pl-[52px] text-[11px] text-slate-400 border-b border-slate-100 truncate" title={m.text}>
        Automatiskt SMS · {tidLang(m.at)} · {m.text.replace(/\s+/g, ' ')}
      </p>
    );
  }
  const ut = m.riktning === 'out';
  const avsandare = ut ? 'Enkla Bokslut' : kundNamn;
  const adress = ut ? null : m.adress || null;

  if (!oppen) {
    return (
      <button type="button" onClick={onVaxla} className="w-full flex items-center gap-3 py-2.5 border-b border-slate-100 text-left hover:bg-slate-50 rounded-sm">
        <Avatar namn={avsandare} vi={ut} />
        <span className="w-36 md:w-44 shrink-0 truncate text-sm font-semibold text-slate-800">{avsandare}</span>
        {m.kanal === 'sms' && <SmsChip />}
        <span className="flex-1 min-w-0 truncate text-sm text-slate-500">{m.text.replace(/\s+/g, ' ') || '(tomt)'}</span>
        {!!(m.bilagor?.length || m.filer?.length) && <Ikon namn="gem" className="w-4 h-4 text-slate-400 shrink-0" />}
        <span className="shrink-0 text-xs text-slate-500 tabular-nums">{tidKort(m.at)}</span>
      </button>
    );
  }

  const lang = m.text.length > 1500;
  const egetAmne = m.kanal === 'mejl' && m.amne && rensaAmne(m.amne) !== rensaAmne(titel);
  return (
    <article className="flex gap-3 py-4 border-b border-slate-100">
      <Avatar namn={avsandare} vi={ut} />
      <div className="flex-1 min-w-0">
        <button type="button" onClick={onVaxla} className="w-full text-left flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-slate-900">{avsandare}</span>
              {adress && <span className="text-xs text-slate-500 break-all">&lt;{adress}&gt;</span>}
            </span>
            <span className="block text-xs text-slate-500">{ut ? `till ${kundNamn}` : 'till oss'}</span>
          </span>
          <span className="shrink-0 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            {m.kanal === 'sms' && <SmsChip />}
            {tidLang(m.at)}
          </span>
        </button>
        {m.status === 'failed' && <p className="mt-2 text-xs font-medium text-red-600">SMS:et gick inte fram.</p>}
        {egetAmne && <p className="mt-3 text-sm font-semibold text-slate-800">{m.amne}</p>}
        <div className="mt-3 text-[14px] leading-6 text-slate-800 whitespace-pre-wrap break-words">
          {lang && !hel ? `${m.text.slice(0, 1500)}…` : m.text || '(tomt)'}
        </div>
        {lang && (
          <button type="button" onClick={() => setHel(!hel)} className="mt-1 text-xs font-medium text-sky-700 hover:underline">
            {hel ? 'Visa mindre' : 'Visa hela'}
          </button>
        )}
        <Bilagor filer={m.filer ?? []} namn={m.bilagor ?? []} />
      </div>
    </article>
  );
}

const filUrl = (id: string, visa = true) => `/api/admin/underlag/${id}/ladda-ner${visa ? '?visa' : ''}`;
/** HEIC och TIFF visar inte webbläsaren, de laddas ned i stället. */
const arBild = (f: InkorgFil) => (!!f.typ?.startsWith('image/') && !/heic|heif|tiff/i.test(f.typ)) || /\.(png|jpe?g|gif|webp)$/i.test(f.namn);
const arPdf = (f: InkorgFil) => f.typ === 'application/pdf' || /\.pdf$/i.test(f.namn);
const kanVisas = (f: InkorgFil) => arBild(f) || arPdf(f) || f.typ === 'text/plain';
const storlekText = (b: number | null) => (b == null ? ''
  : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

/** Filändelsen som en färgad etikett: röd PDF, grön Excel, blå Word … */
function FilEtikett({ f, liten }: { f: InkorgFil; liten?: boolean }) {
  const ext = (f.namn.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? 'fil').toUpperCase();
  const farg = arPdf(f) ? 'bg-red-600' : arBild(f) ? 'bg-sky-600'
    : /^(XLSX?|CSV|SIE|SE|NUMBERS)$/.test(ext) ? 'bg-emerald-600'
      : /^(DOCX?|PAGES|RTF)$/.test(ext) ? 'bg-blue-600' : ext === 'ZIP' ? 'bg-amber-600' : 'bg-slate-500';
  return (
    <span className={`shrink-0 inline-flex items-center justify-center rounded font-bold text-white tracking-tight ${farg} ${liten ? 'w-8 h-5 text-[9px]' : 'min-w-[36px] px-2 h-7 text-xs'}`}>
      {ext.slice(0, 4)}
    </span>
  );
}

/**
 * Bilagorna i ett mejl, som kort under texten. De som finns sparade hos oss
 * öppnas i en förhandsvisning. Resten sparades aldrig (äldre mejl) och finns
 * bara i Gmail, så där står bara namnet.
 */
function Bilagor({ filer, namn }: { filer: InkorgFil[]; namn: string[] }) {
  const [visad, setVisad] = useState<number | null>(null);
  const sparade = new Set(filer.map((f) => f.namn.trim().toLowerCase()));
  const baraIGmail = namn.filter((n) => !sparade.has(n.trim().toLowerCase()));
  const antal = filer.length + baraIGmail.length;
  if (!antal) return null;
  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <p className="text-xs font-medium text-slate-500 mb-2">{antal} {antal === 1 ? 'bilaga' : 'bilagor'}</p>
      <div className="flex flex-wrap gap-2">
        {filer.map((f, i) => (
          <div key={f.id} className="group relative w-44 rounded-lg border border-slate-200 bg-white overflow-hidden hover:shadow-md hover:border-slate-300 transition">
            <button type="button" onClick={() => setVisad(i)} title={`Visa ${f.namn}`} className="block w-full text-left">
              <span className="block h-24 bg-slate-50 border-b border-slate-100 overflow-hidden">
                {arBild(f)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={filUrl(f.id)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center"><FilEtikett f={f} /></span>}
              </span>
              <span className="flex items-center gap-2 px-2.5 py-2">
                <FilEtikett f={f} liten />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-800">{f.namn}</span>
                  {f.storlek != null && <span className="block text-[11px] text-slate-500">{storlekText(f.storlek)}</span>}
                </span>
              </span>
            </button>
            <a href={filUrl(f.id, false)} title="Ladda ner" aria-label={`Ladda ner ${f.namn}`}
              className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-white/95 shadow flex items-center justify-center text-slate-600 hover:text-slate-900 opacity-0 group-hover:opacity-100 focus:opacity-100 transition">
              <Ikon namn="ladda" className="w-4 h-4" />
            </a>
          </div>
        ))}
        {baraIGmail.map((n, i) => (
          <span key={`${n}-${i}`} title="Filen sparades aldrig hos oss och finns bara i Gmail"
            className="inline-flex items-center gap-1.5 max-w-[260px] h-8 self-end px-3 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
            <Ikon namn="gem" className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{n}</span><span className="shrink-0 text-slate-400">· i Gmail</span>
          </span>
        ))}
      </div>
      {visad !== null && <Forhandsvisning filer={filer} start={visad} onStang={() => setVisad(null)} />}
    </div>
  );
}

const morkKnapp = 'w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition';

/** En bilaga över hela fönstret: bilder och PDF:er visas direkt, annat laddas ned. Pilarna bläddrar. */
function Forhandsvisning({ filer, start, onStang }: { filer: InkorgFil[]; start: number; onStang: () => void }) {
  const [i, setI] = useState(start);
  const f = filer[i];

  useEffect(() => {
    // Fångas före inkorgens kortkommandon, så att Esc bara stänger förhandsvisningen
    const tangent = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') onStang();
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
      else if (e.key === 'ArrowRight') setI((x) => Math.min(filer.length - 1, x + 1));
    };
    window.addEventListener('keydown', tangent, true);
    return () => window.removeEventListener('keydown', tangent, true);
  }, [filer.length, onStang]);

  const stopp = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90 backdrop-blur-sm" onClick={onStang} role="dialog" aria-label={f.namn}>
      <div className="h-14 shrink-0 flex items-center gap-3 pl-4 pr-2 text-white" onClick={stopp}>
        <FilEtikett f={f} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.namn}</span>
        {filer.length > 1 && <span className="text-xs text-white/60 tabular-nums">{i + 1} av {filer.length}</span>}
        <a href={filUrl(f.id)} target="_blank" rel="noreferrer" title="Öppna i ny flik" className={morkKnapp}><Ikon namn="extern" /></a>
        <a href={filUrl(f.id, false)} title="Ladda ner" className={morkKnapp}><Ikon namn="ladda" /></a>
        <button type="button" onClick={onStang} title="Stäng (Esc)" className={morkKnapp}><Ikon namn="x" /></button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-4 md:px-16">
        {arBild(f) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.id} src={filUrl(f.id)} alt={f.namn} onClick={stopp} className="max-w-full max-h-full object-contain rounded shadow-2xl bg-white" />
        ) : kanVisas(f) ? (
          <iframe key={f.id} src={filUrl(f.id)} title={f.namn} className="w-full h-full max-w-5xl rounded bg-white shadow-2xl" />
        ) : (
          <div onClick={stopp} className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-2xl">
            <FilEtikett f={f} />
            <p className="mt-3 text-sm font-medium text-slate-900 break-words">{f.namn}</p>
            <p className="mt-1 text-xs text-slate-500">Den här filtypen går inte att visa här.</p>
            <a href={filUrl(f.id, false)} className={`${skickaKnapp} mt-4 inline-flex items-center gap-2`}>
              <Ikon namn="ladda" className="w-4 h-4" /> Ladda ner{f.storlek != null ? ` (${storlekText(f.storlek)})` : ''}
            </a>
          </div>
        )}
        {i > 0 && (
          <button type="button" onClick={(e) => { stopp(e); setI(i - 1); }} title="Föregående (←)"
            className={`${morkKnapp} absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-white/10`}><Ikon namn="vanster" /></button>
        )}
        {i < filer.length - 1 && (
          <button type="button" onClick={(e) => { stopp(e); setI(i + 1); }} title="Nästa (→)"
            className={`${morkKnapp} absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-white/10`}><Ikon namn="hoger" /></button>
        )}
      </div>
    </div>
  );
}

/** Kunden till höger om tråden: vem det är, öppna ärenden och anteckningarna till AI:n. */
function Kundkort({ trad, personKey, onAndrat }: { trad: InkorgTrad; personKey: string; onAndrat: () => void }) {
  const p = trad.person;
  const nyckel = p.email || p.phone || p.key;
  const namn = p.name || p.company || nyckel;
  const href = `/admin/person/${encodeURIComponent(nyckel)}`;
  return (
    <div className="p-5 space-y-6">
      <div className="flex flex-col items-center text-center pt-2">
        <Avatar namn={namn} storlek="lg" />
        <Link href={href} className="mt-3 text-base font-semibold text-slate-900 hover:text-sky-700 hover:underline underline-offset-4 break-words">
          {namn}
        </Link>
        {p.company && p.company !== namn && <p className="text-sm text-slate-500">{p.company}</p>}
        <div className="mt-2"><KategoriChip kategori={trad.kategori} /></div>
      </div>

      <div className="space-y-2 text-sm">
        {p.email && (
          <p className="flex items-center gap-3 min-w-0"><Ikon namn="mejl" className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate text-slate-700" title={p.email}>{p.email}</span></p>
        )}
        {p.phone && (
          <p className="flex items-center gap-3"><Ikon namn="telefon" className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-700 tabular-nums">{p.phone}</span></p>
        )}
      </div>

      <Link href={href}
        className="flex items-center justify-center gap-2 h-9 rounded-full border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Öppna personsidan <Ikon namn="extern" className="w-4 h-4" />
      </Link>

      {trad.arenden.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Öppna ärenden</h3>
          <ul className="space-y-1.5">
            {trad.arenden.map((a) => (
              <li key={a.id} className="text-sm text-slate-800 bg-amber-50 ring-1 ring-inset ring-amber-200/70 rounded-lg px-3 py-2">
                {a.datum && <span className="block text-[11px] text-amber-800/80 tabular-nums">{a.datum}</span>}
                {a.titel}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Anteckningar personKey={personKey} anteckningar={trad.anteckningar} onAndrat={onAndrat} />
    </div>
  );
}

/** Ett skickat mejl, som i Gmail. Finns mottagaren hos oss går det att öppna hela konversationen. */
function SkickatMejl({ m, onTillbaka, onOppna }: { m: InkorgSkickat; onTillbaka: () => void; onOppna: () => void }) {
  return (
    <>
      <div className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-slate-100">
        <IkonKnapp ikon="tillbaka" titel="Tillbaka till listan (u)" onClick={onTillbaka} />
        <span className="flex-1" />
        {m.personKey && m.kategori && (
          <button type="button" onClick={onOppna}
            className="h-8 px-4 mr-1 rounded-full border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Öppna konversationen
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[960px] mx-auto px-4 md:px-8 pt-5 pb-12">
          <h1 className="text-[22px] leading-tight text-slate-900 mb-4 pl-[52px] break-words">
            {m.kanal === 'sms' ? 'SMS' : (m.amne || '(inget ämne)')}
          </h1>
          <article className="flex gap-3 py-4">
            <Avatar namn="" vi />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">Enkla Bokslut</span>
                  <span className="block text-xs text-slate-500 break-all">till {m.namn ? <>{m.namn} &lt;{m.till}&gt;</> : m.till}</span>
                </span>
                <span className="shrink-0 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                  {m.kanal === 'sms' && <SmsChip />}{tidLang(m.at)}
                </span>
              </div>
              {m.status === 'failed' && <p className="mt-2 text-xs font-medium text-red-600">SMS:et gick inte fram.</p>}
              <div className="mt-3 text-[14px] leading-6 text-slate-800 whitespace-pre-wrap break-words">{m.text || '(tomt)'}</div>
              {m.bilagor.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.bilagor.map((b) => (
                    <span key={b} className="inline-flex items-center gap-1.5 max-w-[260px] h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
                      <Ikon namn="gem" className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{b}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

const post = async (url: string, body: object, method = 'POST') => {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Något gick fel');
  return d;
};

/** Gmail tar max 25 MB per mejl, och bilagorna växer när de kodas. */
const MAX_BILAGOR_MB = 20;

/** Filer att bifoga ett mejl. De laddas upp direkt när de väljs, så Skicka skickar bara sökvägarna. */
function useBilagor() {
  const [bilagor, setBilagor] = useState<(MejlBilaga & { storlek: number })[]>([]);
  const [laddar, setLaddar] = useState(0);
  const [fel, setFel] = useState('');

  const lagg = async (filer: FileList | null) => {
    if (!filer?.length) return;
    const lista = [...filer];
    const total = [...bilagor.map((b) => b.storlek), ...lista.map((f) => f.size)].reduce((a, b) => a + b, 0);
    if (total > MAX_BILAGOR_MB * 1024 * 1024) { setFel(`Bilagorna får vara högst ${MAX_BILAGOR_MB} MB tillsammans`); return; }
    setFel(''); setLaddar((n) => n + lista.length);
    await Promise.all(lista.map(async (fil) => {
      try {
        const { path, signedUrl } = await post('/api/admin/inkorg', { action: 'bilaga-forbered', namn: fil.name });
        const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': fil.type || 'application/octet-stream' }, body: fil });
        if (!put.ok) throw new Error(`${fil.name} kunde inte laddas upp`);
        setBilagor((b) => [...b, { path, namn: fil.name, storlek: fil.size }]);
      } catch (e) {
        setFel(e instanceof Error ? e.message : `${fil.name} kunde inte laddas upp`);
      } finally {
        setLaddar((n) => n - 1);
      }
    }));
  };

  return {
    bilagor, laddar, fel, lagg,
    ta: (path: string) => setBilagor((b) => b.filter((x) => x.path !== path)),
    tom: () => setBilagor([]),
    /** Det som skickas till servern. */
    data: () => bilagor.map(({ path, namn }) => ({ path, namn })),
  };
}

function BilageKnapp({ b, disabled }: { b: ReturnType<typeof useBilagor>; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" multiple className="hidden"
        onChange={(e) => { b.lagg(e.target.files); e.target.value = ''; }} />
      <IkonKnapp ikon="gem" titel="Bifoga filer" disabled={disabled} onClick={() => input.current?.click()} />
    </>
  );
}

function BilageLista({ b }: { b: ReturnType<typeof useBilagor> }) {
  if (!b.bilagor.length && !b.laddar && !b.fel) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
      {b.bilagor.map((x) => (
        <span key={x.path} className="inline-flex items-center gap-1.5 h-8 text-xs bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-1 text-slate-700">
          <Ikon namn="gem" className="w-3.5 h-3.5 text-slate-400" />
          <span className="max-w-[200px] truncate">{x.namn}</span>
          <button type="button" onClick={() => b.ta(x.path)} title="Ta bort" className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white">
            <Ikon namn="x" className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      {b.laddar > 0 && <span className="text-xs text-slate-500">Laddar upp {b.laddar} fil{b.laddar > 1 ? 'er' : ''}…</span>}
      {b.fel && <span className="text-xs text-red-600">{b.fel}</span>}
    </div>
  );
}

const ruta = 'flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,.08)] focus-within:shadow-[0_4px_14px_rgba(0,0,0,.12)] transition-shadow';
const skickaKnapp = 'h-9 px-6 rounded-full bg-blue-600 hover:bg-blue-700 hover:shadow text-white text-sm font-semibold disabled:opacity-40 disabled:hover:shadow-none transition';

function Utkast({ u, personKey, onKlar }: { u: InkorgUtkast; personKey: string; onKlar: () => void }) {
  const [text, setText] = useState(u.text);
  const [upptagen, setUpptagen] = useState(false);
  const [skriverOm, setSkriverOm] = useState(false);
  const [fel, setFel] = useState(u.fel ?? '');
  const bilagor = useBilagor();
  const mejl = u.kanal === 'mejl';

  const kor = async (fn: () => Promise<unknown>) => {
    setUpptagen(true); setFel('');
    try { await fn(); onKlar(); } catch (e) { setFel(e instanceof Error ? e.message : 'Något gick fel'); } finally { setUpptagen(false); }
  };

  const skicka = () => kor(() => (mejl
    ? post('/api/admin/inkorg', { action: 'skicka-mejl', id: u.id, text, bilagor: bilagor.data() })
    : post('/api/admin/sms-drafts', { id: u.id, body: text })));
  const spara = () => kor(() => (mejl
    ? post('/api/admin/inkorg', { action: 'spara-mejl', id: u.id, text })
    : post('/api/admin/sms-drafts', { id: u.id, body: text }, 'PATCH')));
  const slang = () => kor(() => (mejl
    ? post('/api/admin/inkorg', { action: 'slang-mejl', id: u.id })
    : post('/api/admin/sms-drafts', { id: u.id }, 'DELETE')));

  /** Låter AI:n skriva ett nytt utkast — med anteckningarna som lagts till sedan dess. */
  const skrivOm = async () => {
    setSkriverOm(true);
    await kor(() => post('/api/admin/inkorg', { action: 'skriv-om', id: u.id, kanal: u.kanal, key: personKey }));
    setSkriverOm(false);
  };

  const kanSkicka = !upptagen && !!text.trim() && bilagor.laddar === 0;

  return (
    <div className="flex gap-3">
      <span className="hidden sm:block"><Avatar namn="" vi /></span>
      <div className={ruta}>
        <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-100">
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            <Ikon namn="ai" className="w-3.5 h-3.5" /> AI-utkast
          </span>
          {!mejl && <SmsChip />}
          <span className="text-sm text-slate-500 truncate min-w-0">
            till <span className="text-slate-800">{u.till}</span>{mejl && !u.svarPa ? ' · nytt mejl' : ''}
          </span>
          <button type="button" onClick={skrivOm} disabled={upptagen} title="Låt AI:n skriva ett nytt utkast, med anteckningarna"
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40">
            <Ikon namn="uppdatera" className={`w-4 h-4 ${skriverOm ? 'animate-spin' : ''}`} />
            {skriverOm ? 'Skriver om…' : 'Skriv om'}
          </button>
        </div>
        {mejl && u.amne && (
          <p className="px-4 py-2 text-sm border-b border-slate-100 truncate"><span className="text-slate-500">Ämne </span>{u.amne}</p>
        )}
        {skriverOm && <p className="px-4 pt-2 text-xs text-slate-500">AI:n skriver om. Med underlag kan det ta några minuter.</p>}
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && kanSkicka) skicka(); }}
          rows={Math.min(18, Math.max(5, text.split('\n').length + 1))}
          className="block w-full px-4 py-3 text-[14px] leading-6 text-slate-900 bg-transparent resize-none focus:outline-none" />
        {mejl && <BilageLista b={bilagor} />}
        {fel && <p className="px-4 pb-2 text-xs text-red-600">{fel}</p>}
        <div className="flex items-center gap-1 px-3 pb-3">
          <button type="button" onClick={skicka} disabled={!kanSkicka} className={skickaKnapp}>
            {upptagen && !skriverOm ? 'Skickar…' : 'Skicka'}
          </button>
          {mejl && <BilageKnapp b={bilagor} disabled={upptagen} />}
          {text !== u.text && (
            <button type="button" onClick={spara} disabled={upptagen} className="h-9 px-3 rounded-full text-sm text-slate-700 hover:bg-slate-100">
              Spara ändring
            </button>
          )}
          <span className="ml-2 text-[11px] text-slate-400 hidden sm:inline">
            {mejl ? 'Signaturen läggs på · Ctrl+Enter skickar' : `${text.length} tecken · Ctrl+Enter skickar`}
          </span>
          <IkonKnapp ikon="papperskorg" titel="Släng utkastet" onClick={slang} disabled={upptagen} className="ml-auto hover:text-red-600" />
        </div>
      </div>
    </div>
  );
}

/**
 * Svara i tråden: först två knappar, som i Gmail, och rutan öppnas när man
 * väljer mejl eller SMS.
 */
function Skriv({ email, phone, svarPa, amne, onKlar }: {
  email: string | null; phone: string | null; svarPa: string | null; amne: string | null; onKlar: () => void;
}) {
  const [kanal, setKanal] = useState<'mejl' | 'sms' | null>(null);
  const [text, setText] = useState('');
  const [rubrik, setRubrik] = useState('');
  const [skickar, setSkickar] = useState(false);
  const bilagor = useBilagor();
  const [fel, setFel] = useState('');

  if (!email && !phone) return null;

  if (!kanal) {
    const knapp = 'inline-flex items-center gap-2 h-10 px-5 rounded-full border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:shadow-sm transition';
    return (
      <div className="flex flex-wrap gap-2 sm:pl-[52px]">
        {email && <button type="button" onClick={() => setKanal('mejl')} className={knapp}><Ikon namn="svara" className="w-4 h-4" />{svarPa ? 'Svara' : 'Skriv mejl'}</button>}
        {phone && <button type="button" onClick={() => setKanal('sms')} className={knapp}><Ikon namn="sms" className="w-4 h-4" />Skicka SMS</button>}
      </div>
    );
  }

  const nyttMejl = kanal === 'mejl' && !svarPa;
  const kanSkicka = !skickar && !!text.trim() && !(nyttMejl && !rubrik.trim()) && !(kanal === 'mejl' && bilagor.laddar > 0);

  const skicka = async () => {
    setSkickar(true); setFel('');
    try {
      if (kanal === 'mejl') await post('/api/admin/inkorg', { action: 'nytt-mejl', till: email, amne: nyttMejl ? rubrik : amne, svarPa, text, bilagor: bilagor.data() });
      else await post('/api/admin/sms-send', { phone, body: text });
      setText(''); setRubrik(''); bilagor.tom(); onKlar();
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte skicka'); }
    finally { setSkickar(false); }
  };

  const stang = () => {
    if (text.trim() && !window.confirm('Släng det du skrivit?')) return;
    setKanal(null); setText(''); setRubrik(''); bilagor.tom(); setFel('');
  };

  return (
    <div className="flex gap-3">
      <span className="hidden sm:block"><Avatar namn="" vi /></span>
      <div className={ruta}>
        <div className="flex items-center gap-2 pl-4 pr-1 h-11 border-b border-slate-100">
          {email && phone && (
            <div className="flex p-0.5 rounded-full bg-slate-100 shrink-0">
              {(['mejl', 'sms'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKanal(k)}
                  className={`h-7 px-3 rounded-full text-xs font-medium transition ${kanal === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {k === 'mejl' ? 'Mejl' : 'SMS'}
                </button>
              ))}
            </div>
          )}
          <span className="text-sm text-slate-500 truncate min-w-0">
            till <span className="text-slate-800">{kanal === 'mejl' ? email : phone}</span>
            {kanal === 'mejl' && svarPa ? ' · svar i tråden' : ''}
          </span>
          <IkonKnapp ikon="x" titel="Stäng" onClick={stang} className="ml-auto" />
        </div>
        {nyttMejl && (
          <input value={rubrik} onChange={(e) => setRubrik(e.target.value)} placeholder="Ämne"
            className="block w-full px-4 h-10 text-sm text-slate-900 bg-transparent border-b border-slate-100 focus:outline-none placeholder:text-slate-400" />
        )}
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && kanSkicka) skicka(); }}
          placeholder={kanal === 'mejl' ? 'Skriv ditt svar…' : 'Skriv SMS:et…'}
          rows={Math.min(16, Math.max(5, text.split('\n').length + 1))}
          className="block w-full px-4 py-3 text-[14px] leading-6 text-slate-900 bg-transparent resize-none focus:outline-none placeholder:text-slate-400" />
        {kanal === 'mejl' && <BilageLista b={bilagor} />}
        {fel && <p className="px-4 pb-2 text-xs text-red-600">{fel}</p>}
        <div className="flex items-center gap-1 px-3 pb-3">
          <button type="button" onClick={skicka} disabled={!kanSkicka} className={skickaKnapp}>{skickar ? 'Skickar…' : 'Skicka'}</button>
          {kanal === 'mejl' && <BilageKnapp b={bilagor} disabled={skickar} />}
          <span className="ml-2 text-[11px] text-slate-400 hidden sm:inline">
            {kanal === 'mejl' ? 'Signaturen läggs på · Ctrl+Enter skickar' : `${text.length} tecken · Ctrl+Enter skickar`}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Ett mejl till vem som helst, även någon vi aldrig haft kontakt med, i ett
 * fönster nere till höger som i Gmail. Är personen ny läggs hen in som lead.
 * Med telefonnummer får de ett SMS om mejlet, nu och varje gång vi mejlar dem
 * framöver (mail-notice.ts).
 */
function NyttMejl({ minimerad, onMinimera, onSkickat, onAvbryt }: {
  minimerad: boolean; onMinimera: () => void; onSkickat: (nyckel: string) => void; onAvbryt: () => void;
}) {
  const [kanal, setKanal] = useState<'mejl' | 'sms'>('mejl');
  const [till, setTill] = useState('');
  const [namn, setNamn] = useState('');
  const [telefon, setTelefon] = useState('');
  const [rubrik, setRubrik] = useState('');
  const [text, setText] = useState('');
  const [skickar, setSkickar] = useState(false);
  const [fel, setFel] = useState('');
  const bilagor = useBilagor();

  const klar = kanal === 'sms'
    ? telefon.trim() && text.trim()
    : till.includes('@') && rubrik.trim() && text.trim() && !bilagor.laddar;

  const skicka = async () => {
    setSkickar(true); setFel('');
    try {
      if (kanal === 'sms') {
        // Okänt nummer blir lead i sms-send, så att svaret hamnar rätt
        const res = await fetch('/api/admin/sms-send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: telefon, body: text, namn, nyKontakt: true }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d.error) throw new Error(d.error || 'Kunde inte skicka');
        onSkickat(d.phone);
        return;
      }
      const email = till.trim().toLowerCase();
      await post('/api/admin/inkorg', { action: 'nytt-mejl', till: email, namn, telefon, amne: rubrik, text, bilagor: bilagor.data() });
      onSkickat(email);
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte skicka'); }
    finally { setSkickar(false); }
  };

  const stang = () => {
    if ((text.trim() || rubrik.trim()) && !window.confirm('Släng meddelandet?')) return;
    onAvbryt();
  };

  const falt = 'flex-1 min-w-0 h-10 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none';
  const rad = (etikett: string, input: React.ReactNode) => (
    <label className="flex items-center gap-3 px-4 border-b border-slate-100">
      <span className="w-14 shrink-0 text-sm text-slate-500">{etikett}</span>
      {input}
    </label>
  );

  return (
    <div className="fixed bottom-0 right-0 sm:right-6 z-50 w-full sm:w-[560px] bg-white rounded-t-xl shadow-[0_8px_40px_rgba(0,0,0,.28)] flex flex-col overflow-hidden">
      <div className="h-10 flex items-center gap-1 pl-4 pr-1 bg-slate-100 cursor-pointer select-none" onClick={onMinimera}>
        <span className="flex-1 truncate text-sm font-medium text-slate-800">
          {kanal === 'sms' ? 'Nytt SMS' : (rubrik.trim() || 'Nytt meddelande')}
        </span>
        <span onClick={(e) => e.stopPropagation()} className="flex">
          <IkonKnapp ikon="minus" titel={minimerad ? 'Visa' : 'Minimera'} onClick={onMinimera} className="w-8 h-8" />
          <IkonKnapp ikon="x" titel="Stäng" onClick={stang} className="w-8 h-8" />
        </span>
      </div>
      <div className={minimerad ? 'hidden' : 'flex flex-col'}>
        <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-100">
          <div className="flex p-0.5 rounded-full bg-slate-100">
            {(['mejl', 'sms'] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setKanal(k); setFel(''); }}
                className={`h-7 px-3 rounded-full text-xs font-medium transition ${kanal === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {k === 'mejl' ? 'Mejl' : 'SMS'}
              </button>
            ))}
          </div>
        </div>
        {kanal === 'sms' ? (
          <>
            {rad('Till', <input autoFocus value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="Telefonnummer" type="tel" className={falt} />)}
            {rad('Namn', <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="Frivilligt" className={falt} />)}
          </>
        ) : (
          <>
            {rad('Till', <input autoFocus value={till} onChange={(e) => setTill(e.target.value)} placeholder="Mejladress" type="email" className={falt} />)}
            {rad('Namn', <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="Frivilligt" className={falt} />)}
            {rad('Telefon', <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="Frivilligt — får ett SMS om mejlet" type="tel" className={falt} />)}
            {rad('Ämne', <input value={rubrik} onChange={(e) => setRubrik(e.target.value)} className={falt} />)}
          </>
        )}
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={kanal === 'sms' ? 'Skriv SMS:et…' : 'Skriv mejlet…'}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && klar && !skickar) skicka(); }}
          className="block w-full h-[min(320px,40vh)] px-4 py-3 text-[14px] leading-6 text-slate-900 bg-transparent resize-none focus:outline-none placeholder:text-slate-400" />
        {kanal === 'mejl' && <BilageLista b={bilagor} />}
        {fel && <p className="px-4 pb-2 text-xs text-red-600">{fel}</p>}
        <div className="flex items-center gap-1 px-3 pb-3">
          <button type="button" onClick={skicka} disabled={skickar || !klar} className={skickaKnapp}>{skickar ? 'Skickar…' : 'Skicka'}</button>
          {kanal === 'mejl' && <BilageKnapp b={bilagor} disabled={skickar} />}
          <span className="ml-2 text-[11px] text-slate-400">
            {kanal === 'mejl' ? 'Signaturen läggs på' : text ? `${text.length} tecken` : ''}
          </span>
          <IkonKnapp ikon="papperskorg" titel="Släng" onClick={stang} className="ml-auto hover:text-red-600" />
        </div>
      </div>
    </div>
  );
}

function Anteckningar({ personKey, anteckningar, onAndrat }: {
  personKey: string; anteckningar: AiAnteckning[]; onAndrat: () => void;
}) {
  const [text, setText] = useState('');
  const [omfang, setOmfang] = useState<'kund' | 'generell'>('kund');
  const [upptagen, setUpptagen] = useState(false);
  const [fel, setFel] = useState('');

  const kor = async (body: object, efter?: () => void) => {
    setUpptagen(true); setFel('');
    try { await post('/api/admin/inkorg', body); efter?.(); onAndrat(); }
    catch (e) { setFel(e instanceof Error ? e.message : 'Något gick fel'); }
    finally { setUpptagen(false); }
  };

  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Anteckningar till AI:n</h3>
      <p className="text-xs text-slate-500 mt-1 mb-3">Följer med varje gång AI:n skriver ett svar. Tryck Skriv om på utkastet efteråt för att få ett nytt.</p>
      {anteckningar.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {anteckningar.map((a) => (
            <li key={a.id} className="group flex items-start gap-2 text-sm bg-violet-50/60 ring-1 ring-inset ring-violet-200/70 rounded-lg pl-3 pr-1 py-2">
              <span className="flex-1 min-w-0">
                <span className={`block text-[10px] font-semibold tracking-wide mb-0.5 ${a.omfang === 'generell' ? 'text-slate-500' : 'text-violet-700'}`}>
                  {a.omfang === 'generell' ? 'ALLA SVAR' : 'DEN HÄR KUNDEN'}
                </span>
                <span className="text-slate-800 whitespace-pre-wrap break-words">{a.text}</span>
              </span>
              <button type="button" onClick={() => kor({ action: 'anteckning-bort', id: a.id })} disabled={upptagen} title="Ta bort"
                className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white">
                <Ikon namn="x" className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        placeholder="T.ex. Svara kortare. Nämn inte priset förrän de frågar."
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400" />
      <div className="flex p-0.5 rounded-full bg-slate-100 mt-2">
        {([['kund', 'Bara den här kunden'], ['generell', 'Alla svar']] as const).map(([v, etikett]) => (
          <button key={v} type="button" onClick={() => setOmfang(v)}
            className={`flex-1 h-7 rounded-full text-xs font-medium transition ${omfang === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {etikett}
          </button>
        ))}
      </div>
      {fel && <p className="text-xs text-red-600 mt-2">{fel}</p>}
      <button type="button" onClick={() => kor({ action: 'anteckning-ny', key: personKey, text, omfang }, () => setText(''))}
        disabled={upptagen || !text.trim()}
        className="mt-2 w-full h-9 text-sm font-semibold rounded-full bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">
        Spara anteckning
      </button>
    </section>
  );
}
