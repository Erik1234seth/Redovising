'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { RAKNA_OM } from '../_nav-menu';
import type {
  AiAnteckning, InkorgKategori, InkorgKonversation, InkorgMeddelande, InkorgTrad, InkorgUtkast, MejlBilaga,
} from '@/lib/admin-types';

/**
 * Inkorgen: mejl och SMS i samma lista, som en vanlig inkorg.
 *
 * Till vänster konversationerna, en per person. Till höger hela tråden med
 * både mejl och SMS i tidsordning, och utkasten AI:n skrivit. Inget går ut
 * förrän någon trycker Skicka.
 */

const FLIKAR: { id: InkorgKategori; namn: string }[] = [
  { id: 'lead', namn: 'Leads' },
  { id: 'saknar', namn: 'Saknar uppgifter' },
  { id: 'kund', namn: 'Kunder' },
];

const KATEGORI_NAMN: Record<InkorgKategori, string> = {
  lead: 'Lead',
  saknar: 'Saknar uppgifter',
  kund: 'Kund',
};

function tidKort(iso: string): string {
  const d = new Date(iso);
  const idag = new Date();
  if (d.toDateString() === idag.toDateString()) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const igar = new Date(idag); igar.setDate(idag.getDate() - 1);
  if (d.toDateString() === igar.toDateString()) return 'igår';
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', ...(d.getFullYear() !== idag.getFullYear() ? { year: 'numeric' } : {}) });
}
const tidLang = (iso: string) => new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function KanalMarke({ kanal }: { kanal: 'mejl' | 'sms' }) {
  return kanal === 'mejl'
    ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">MEJL</span>
    : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">SMS</span>;
}

export default function InkorgPage() {
  const [lista, setLista] = useState<InkorgKonversation[] | null>(null);
  const [fel, setFel] = useState('');
  const [flik, setFlik] = useState<InkorgKategori>('lead');
  const [bara, setBara] = useState<'alla' | 'olasta' | 'utkast'>('alla');
  const [sok, setSok] = useState('');
  const [vald, setVald] = useState<string | null>(null);
  const [nytt, setNytt] = useState(false);
  const [markerade, setMarkerade] = useState<Set<string>>(new Set());

  const ladda = useCallback(() => fetch('/api/admin/inkorg').then((r) => r.json()).then((d) => {
    if (d.error) setFel(d.error); else setLista(d.konversationer);
    return (d.konversationer ?? []) as InkorgKonversation[];
  }).catch(() => { setFel('Kunde inte hämta inkorgen'); return [] as InkorgKonversation[]; }), []);

  /** Efter "Nytt mejl": personen finns nu i listan, så tråden öppnas direkt. */
  const nyttSkickat = async (email: string) => {
    setNytt(false);
    const traff = (await ladda()).find((k) => k.email?.toLowerCase() === email);
    if (traff) { setFlik(traff.kategori); oppna(traff.key); }
  };

  useEffect(() => {
    ladda();
    const t = setInterval(ladda, 60_000);
    return () => clearInterval(t);
  }, [ladda]);

  // ?key=… öppnar en konversation direkt, t.ex. från översikten
  const franLank = useRef(false);
  useEffect(() => {
    if (!lista || franLank.current) return;
    franLank.current = true;
    const k = new URLSearchParams(window.location.search).get('key');
    const traff = k && lista.find((x) => x.key === k || x.email === k || x.phone === k);
    if (traff) { setFlik(traff.kategori); oppna(traff.key); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  const synliga = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (lista ?? []).filter((k) =>
      k.kategori === flik
      && (bara === 'alla' || (bara === 'olasta' ? k.olast : k.utkast > 0))
      && (!q || [k.namn, k.email, k.phone, k.senaste.text].some((f) => f?.toLowerCase().includes(q))));
  }, [lista, flik, bara, sok]);

  /** Olästa per flik — det som syns som siffra bredvid fliknamnet. */
  const antal = (id: InkorgKategori) => (lista ?? []).filter((k) => k.kategori === id && k.olast).length;

  // Markeringen gäller det man ser — byts flik, filter eller sökning börjar den om
  useEffect(() => { setMarkerade(new Set()); }, [flik, bara, sok]);

  const markera = (key: string) => setMarkerade((m) => {
    const n = new Set(m);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const allaMarkerade = synliga.length > 0 && synliga.every((k) => markerade.has(k.key));

  /** Oläst igen eller bort ur inkorgen. Historiken rörs inte — en borttagen kommer tillbaka när något nytt händer. */
  const forMarkerade = (action: 'olast' | 'dolj') => {
    const keys = [...markerade];
    if (!keys.length) return;
    setLista((l) => (action === 'olast'
      ? l?.map((k) => (markerade.has(k.key) ? { ...k, olast: true } : k))
      : l?.filter((k) => !markerade.has(k.key))) ?? null);
    if (action === 'dolj' && vald && markerade.has(vald)) setVald(null);
    setMarkerade(new Set());
    fetch('/api/admin/inkorg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, keys }) })
      .then((r) => r.json()).then((d) => { if (d.error) setFel(d.error); })
      .catch(() => setFel('Kunde inte spara ändringen'))
      .finally(() => { ladda(); window.dispatchEvent(new Event(RAKNA_OM)); });
  };

  const oppna = (key: string) => {
    setVald(key);
    setNytt(false);
    setLista((l) => l?.map((k) => (k.key === key ? { ...k, olast: false } : k)) ?? null);
    fetch('/api/admin/inkorg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'last', key }) })
      .then(() => window.dispatchEvent(new Event(RAKNA_OM))).catch(() => {});
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <aside className="w-full lg:w-[400px] shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden lg:sticky lg:top-20">
        <div className="p-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-slate-900">Inkorg</h1>
            <button onClick={() => setNytt(true)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
              + Nytt mejl
            </button>
          </div>
          <div className="flex gap-1 mb-2 flex-wrap">
            {FLIKAR.map((f) => (
              <button key={f.id} onClick={() => setFlik(f.id)}
                className={`px-2.5 py-1 text-xs rounded-lg transition ${flik === f.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {f.namn}
                {antal(f.id) > 0 && <span className={`ml-1 ${flik === f.id ? 'text-white/80' : 'text-blue-700 font-semibold'}`}>{antal(f.id)}</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök"
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
            <select value={bara} onChange={(e) => setBara(e.target.value as typeof bara)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700">
              <option value="alla">Alla</option>
              <option value="olasta">Olästa</option>
              <option value="utkast">Med utkast</option>
            </select>
          </div>
        </div>

        {synliga.length > 0 && (
          <div className="px-3 py-1.5 border-b border-slate-200 flex items-center gap-3 text-xs bg-slate-50">
            <input type="checkbox" checked={allaMarkerade} aria-label="Markera alla"
              onChange={() => setMarkerade(allaMarkerade ? new Set() : new Set(synliga.map((k) => k.key)))}
              className="accent-blue-600" />
            {markerade.size === 0 ? <span className="text-slate-400">Markera för att ändra flera</span> : (
              <>
                <span className="text-slate-600">{markerade.size} markerade</span>
                <button onClick={() => forMarkerade('olast')} className="text-blue-700 hover:underline">Markera som oläst</button>
                <button onClick={() => forMarkerade('dolj')} title="Tas bort ur listan. Mejlen och historiken ligger kvar, och konversationen kommer tillbaka när något nytt händer."
                  className="text-red-600 hover:underline">Ta bort ur inkorgen</button>
              </>
            )}
          </div>
        )}

        {fel && <p className="text-red-600 text-sm p-3">{fel}</p>}
        {!lista && !fel && <p className="text-slate-500 text-sm p-3">Hämtar…</p>}
        {lista && synliga.length === 0 && <p className="text-slate-500 text-sm p-3">Inget här.</p>}

        <ul className="divide-y divide-slate-100 lg:max-h-[calc(100vh-14rem)] overflow-y-auto">
          {synliga.map((k) => (
            <li key={k.key} className="flex items-stretch">
              <label className={`flex items-start pl-3 pt-3 cursor-pointer ${vald === k.key ? 'bg-blue-50' : k.olast ? 'bg-white' : 'bg-slate-50'}`}>
                <input type="checkbox" checked={markerade.has(k.key)} onChange={() => markera(k.key)}
                  aria-label={`Markera ${k.namn}`} className="accent-blue-600" />
              </label>
              <button onClick={() => oppna(k.key)}
                className={`flex-1 min-w-0 text-left px-3 py-2.5 border-l-4 transition ${
                  vald === k.key ? 'bg-blue-50 border-l-blue-600'
                    : k.olast ? 'bg-white border-l-blue-600 hover:bg-blue-50/50'
                      : 'bg-slate-50 border-l-transparent hover:bg-slate-100'}`}>
                <span className="flex items-center gap-2">
                  {k.olast && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                  <span className={`text-sm truncate mr-auto ${k.olast ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{k.namn}</span>
                  {!k.olast && vald !== k.key && <span className="text-[10px] text-slate-400 shrink-0">Läst</span>}
                  {k.utkast > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Utkast</span>}
                  <span className="text-[11px] text-slate-400 shrink-0">{tidKort(k.senaste.at)}</span>
                </span>
                <span className="flex items-center gap-1.5 mt-0.5">
                  <KanalMarke kanal={k.senaste.kanal} />
                  <span className={`text-xs truncate ${k.olast ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {k.senaste.riktning === 'out' && 'Du: '}
                    {k.senaste.kanal === 'mejl' && k.senaste.amne ? <span className="font-medium">{k.senaste.amne} — </span> : null}
                    {k.senaste.text}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 min-w-0 w-full">
        {nytt
          ? <NyttMejl onSkickat={nyttSkickat} onAvbryt={() => setNytt(false)} />
          : vald
          ? <Trad key={vald} personKey={vald} onAndrat={ladda} />
          : <p className="text-slate-500 text-sm mt-16 text-center">Välj en konversation.</p>}
      </section>
    </div>
  );
}

function Trad({ personKey, onAndrat }: { personKey: string; onAndrat: () => void }) {
  const [trad, setTrad] = useState<InkorgTrad | null>(null);
  const [visaAnteckning, setVisaAnteckning] = useState(false);
  const [fel, setFel] = useState('');

  const ladda = useCallback(() => {
    fetch(`/api/admin/inkorg?key=${encodeURIComponent(personKey)}`).then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error); else setTrad(d);
    }).catch(() => setFel('Kunde inte hämta tråden'));
  }, [personKey]);
  useEffect(() => { ladda(); }, [ladda]);

  // Öppna längst ner, där det senaste står
  const lista = useRef<HTMLDivElement>(null);
  const antalMeddelanden = trad?.meddelanden.length ?? 0;
  useEffect(() => {
    if (lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [antalMeddelanden]);

  const uppdatera = () => { ladda(); onAndrat(); };

  if (fel) return <p className="text-red-600 text-sm">{fel}</p>;
  if (!trad) return <p className="text-slate-500 text-sm">Hämtar…</p>;
  const p = trad.person;
  const nyckel = p.email || p.phone || p.key;
  const senasteMejlIn = [...trad.meddelanden].reverse().find((m) => m.kanal === 'mejl' && m.riktning === 'in');
  const senasteAmne = [...trad.meddelanden].reverse().find((m) => m.kanal === 'mejl')?.amne ?? null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <header className="p-4 border-b border-slate-200 flex items-start gap-3 flex-wrap">
        <div className="mr-auto min-w-0">
          <h2 className="text-lg font-bold">
            <Link href={`/admin/person/${encodeURIComponent(nyckel)}`} className="text-slate-900 hover:text-blue-700 hover:underline underline-offset-4">
              {p.name || p.company || nyckel}
            </Link>
          </h2>
          <p className="text-sm text-slate-500">{[p.company && p.company !== p.name ? p.company : null, p.email, p.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <button onClick={() => setVisaAnteckning(!visaAnteckning)}
          className={`text-xs px-2 py-1 rounded-lg border transition ${visaAnteckning ? 'bg-violet-50 border-violet-300 text-violet-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
          + Anteckning{trad.anteckningar.length ? ` (${trad.anteckningar.length})` : ''}
        </button>
        <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${
          trad.kategori === 'kund' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : trad.kategori === 'saknar' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {KATEGORI_NAMN[trad.kategori]}
        </span>
      </header>

      {visaAnteckning && <Anteckningar personKey={personKey} anteckningar={trad.anteckningar} onAndrat={ladda} />}


      {trad.arenden.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-200 bg-amber-50/40">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-800 mb-1">Öppna ärenden</p>
          <ul className="space-y-0.5">
            {trad.arenden.map((a) => (
              <li key={a.id} className="text-sm text-slate-800">
                {a.datum && <span className="text-xs text-slate-500 tabular-nums mr-2">{a.datum}</span>}
                {a.titel}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={lista} className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
        {trad.meddelanden.length === 0 && <p className="text-sm text-slate-500">Inga meddelanden än.</p>}
        {trad.meddelanden.map((m) => <Bubbla key={`${m.kanal}-${m.id}`} m={m} />)}
      </div>

      <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/60 rounded-b-xl">
        {/* En ruta: AI-utkastet när det finns, annars en tom att skriva i. Vill vi
            skriva något eget slänger vi utkastet. */}
        {trad.utkast.length
          ? trad.utkast.map((u) => <Utkast key={`${u.kanal}-${u.id}`} u={u} personKey={personKey} onKlar={uppdatera} />)
          : <Skriv email={senasteMejlIn?.adress || p.email} phone={p.phone} svarPa={senasteMejlIn?.gmailMessageId ?? null}
              amne={senasteAmne} onKlar={uppdatera} />}
      </div>
    </div>
  );
}

function Bubbla({ m }: { m: InkorgMeddelande }) {
  const [hel, setHel] = useState(false);
  if (m.automatisk) {
    return (
      <p className="text-center text-[11px] text-slate-400" title={m.text}>
        Automatiskt SMS · {tidLang(m.at)} · {m.text.replace(/\s+/g, ' ').slice(0, 70)}…
      </p>
    );
  }
  const lang = m.text.length > 700;
  const ut = m.riktning === 'out';
  return (
    <div className={`flex ${ut ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl border px-3 py-2 ${ut ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-1">
          <KanalMarke kanal={m.kanal} />
          <span className="text-[11px] text-slate-500">{ut ? 'Vi' : 'Kunden'} · {tidLang(m.at)}</span>
          {m.status === 'failed' && <span className="text-[11px] text-red-600">gick inte fram</span>}
        </div>
        {m.kanal === 'mejl' && m.amne && <p className="text-xs font-semibold text-slate-700 mb-1">{m.amne}</p>}
        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{lang && !hel ? `${m.text.slice(0, 700)}…` : m.text || '(tomt)'}</p>
        {lang && <button onClick={() => setHel(!hel)} className="text-xs text-blue-700 hover:underline mt-1">{hel ? 'Visa mindre' : 'Visa hela'}</button>}
        {!!m.bilagor?.length && <p className="text-[11px] text-slate-500 mt-1">📎 {m.bilagor.join(', ')}</p>}
      </div>
    </div>
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
      <button type="button" onClick={() => input.current?.click()} disabled={disabled} title="Bifoga filer"
        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-40">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </>
  );
}

function BilageLista({ b }: { b: ReturnType<typeof useBilagor> }) {
  if (!b.bilagor.length && !b.laddar && !b.fel) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-1">
      {b.bilagor.map((x) => (
        <span key={x.path} className="inline-flex items-center gap-1 text-xs bg-slate-100 border border-slate-200 rounded-md pl-2 pr-1 py-0.5 text-slate-700">
          📎 <span className="max-w-[200px] truncate">{x.namn}</span>
          <button type="button" onClick={() => b.ta(x.path)} title="Ta bort" className="px-1 text-slate-400 hover:text-red-600">×</button>
        </span>
      ))}
      {b.laddar > 0 && <span className="text-xs text-slate-500">Laddar upp {b.laddar} fil{b.laddar > 1 ? 'er' : ''}…</span>}
      {b.fel && <span className="text-xs text-red-600">{b.fel}</span>}
    </div>
  );
}

function Utkast({ u, personKey, onKlar }: { u: InkorgUtkast; personKey: string; onKlar: () => void }) {
  const [text, setText] = useState(u.text);
  const [upptagen, setUpptagen] = useState(false);
  const [skriverOm, setSkriverOm] = useState(false);
  const [fel, setFel] = useState(u.fel ?? '');
  const bilagor = useBilagor();

  const kor = async (fn: () => Promise<unknown>) => {
    setUpptagen(true); setFel('');
    try { await fn(); onKlar(); } catch (e) { setFel(e instanceof Error ? e.message : 'Något gick fel'); } finally { setUpptagen(false); }
  };

  const skicka = () => kor(() => u.kanal === 'mejl'
    ? post('/api/admin/inkorg', { action: 'skicka-mejl', id: u.id, text, bilagor: bilagor.data() })
    : post('/api/admin/sms-drafts', { id: u.id, body: text }));
  const spara = () => kor(() => u.kanal === 'mejl'
    ? post('/api/admin/inkorg', { action: 'spara-mejl', id: u.id, text })
    : post('/api/admin/sms-drafts', { id: u.id, body: text }, 'PATCH'));
  const slang = () => kor(() => u.kanal === 'mejl'
    ? post('/api/admin/inkorg', { action: 'slang-mejl', id: u.id })
    : post('/api/admin/sms-drafts', { id: u.id }, 'DELETE'));

  /** Låter AI:n skriva ett nytt utkast — med anteckningarna som lagts till sedan dess. */
  const skrivOm = async () => {
    setSkriverOm(true);
    await kor(() => post('/api/admin/inkorg', { action: 'skriv-om', id: u.id, kanal: u.kanal, key: personKey }));
    setSkriverOm(false);
  };

  return (
    <div className="bg-white border-2 border-amber-300 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">UTKAST</span>
        <KanalMarke kanal={u.kanal} />
        <span className="text-xs text-slate-500 truncate">till {u.till}{u.kanal === 'mejl' && !u.svarPa ? ' · nytt mejl' : ''}</span>
        {skriverOm && <span className="text-xs text-slate-500">AI:n skriver om… (med underlag kan det ta några minuter)</span>}
        <button onClick={skrivOm} disabled={upptagen} title="Skriv om utkastet"
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-40">
          <svg className={`w-4 h-4 ${skriverOm ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(14, Math.max(4, text.split('\n').length + 1))}
        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
      {u.kanal === 'sms' && <p className="text-[11px] text-slate-400 mt-0.5">{text.length} tecken</p>}
      {u.kanal === 'mejl' && <BilageLista b={bilagor} />}
      {u.kanal === 'mejl' && <p className="text-[11px] text-slate-400 mt-0.5">Signaturen läggs på när mejlet skickas.</p>}
      {fel && <p className="text-xs text-red-600 mt-1">{fel}</p>}
      <div className="flex items-center gap-2 mt-2">
        <button onClick={skicka} disabled={upptagen || !text.trim() || bilagor.laddar > 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          {upptagen && !skriverOm ? 'Skickar…' : 'Skicka'}
        </button>
        {u.kanal === 'mejl' && <BilageKnapp b={bilagor} disabled={upptagen} />}
        {text !== u.text && <button onClick={spara} disabled={upptagen} className="px-3 py-2 text-sm text-slate-700 hover:text-slate-900">Spara ändring</button>}
        <button onClick={slang} disabled={upptagen} className="ml-auto px-3 py-2 text-sm text-slate-500 hover:text-red-600">Släng</button>
      </div>
    </div>
  );
}

/**
 * Ett mejl till vem som helst, även någon vi aldrig haft kontakt med. Är
 * personen ny läggs hen in som lead. Med telefonnummer får de ett SMS om
 * mejlet, nu och varje gång vi mejlar dem framöver (mail-notice.ts).
 */
function NyttMejl({ onSkickat, onAvbryt }: { onSkickat: (email: string) => void; onAvbryt: () => void }) {
  const [till, setTill] = useState('');
  const [namn, setNamn] = useState('');
  const [telefon, setTelefon] = useState('');
  const [rubrik, setRubrik] = useState('');
  const [text, setText] = useState('');
  const [skickar, setSkickar] = useState(false);
  const [fel, setFel] = useState('');
  const bilagor = useBilagor();

  const klar = till.includes('@') && rubrik.trim() && text.trim() && !bilagor.laddar;

  const skicka = async () => {
    setSkickar(true); setFel('');
    try {
      const email = till.trim().toLowerCase();
      await post('/api/admin/inkorg', { action: 'nytt-mejl', till: email, namn, telefon, amne: rubrik, text, bilagor: bilagor.data() });
      onSkickat(email);
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte skicka'); }
    finally { setSkickar(false); }
  };

  const falt = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Nytt mejl</h2>
        <button onClick={onAvbryt} className="text-sm text-slate-500 hover:underline">Avbryt</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={till} onChange={(e) => setTill(e.target.value)} placeholder="Mejladress" type="email" className={falt} />
        <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="Namn (frivilligt)" className={falt} />
        <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="Telefon (frivilligt)" type="tel" className={falt} />
      </div>
      {telefon.trim() && <p className="text-xs text-slate-500">Ett SMS om mejlet går till numret några minuter efter att mejlet skickats.</p>}
      <input value={rubrik} onChange={(e) => setRubrik(e.target.value)} placeholder="Ämne" className={falt} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Skriv mejlet…"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && klar) skicka(); }}
        rows={Math.min(16, Math.max(6, text.split('\n').length + 1))}
        className={`${falt} resize-none`} />
      <BilageLista b={bilagor} />
      <div className="flex items-center gap-2">
        <BilageKnapp b={bilagor} disabled={skickar} />
        <span className="text-[11px] text-slate-400">signaturen läggs på</span>
        {fel && <span className="text-xs text-red-600 ml-2">{fel}</span>}
        <button onClick={skicka} disabled={skickar || !klar}
          className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
          {skickar ? 'Skickar…' : 'Skicka'}
        </button>
      </div>
    </div>
  );
}

function Skriv({ email, phone, svarPa, amne, onKlar }: {
  email: string | null; phone: string | null; svarPa: string | null; amne: string | null; onKlar: () => void;
}) {
  const [kanal, setKanal] = useState<'mejl' | 'sms'>(email ? 'mejl' : 'sms');
  const [text, setText] = useState('');
  const [rubrik, setRubrik] = useState('');
  const [skickar, setSkickar] = useState(false);
  const bilagor = useBilagor();
  const [fel, setFel] = useState('');

  if (!email && !phone) return null;
  const nyttMejl = kanal === 'mejl' && !svarPa;

  const skicka = async () => {
    setSkickar(true); setFel('');
    try {
      if (kanal === 'mejl') await post('/api/admin/inkorg', { action: 'nytt-mejl', till: email, amne: nyttMejl ? rubrik : amne, svarPa, text, bilagor: bilagor.data() });
      else await post('/api/admin/sms-send', { phone, body: text });
      setText(''); setRubrik(''); bilagor.tom(); onKlar();
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte skicka'); }
    finally { setSkickar(false); }
  };

  const flik = (k: 'mejl' | 'sms', namn: string) => (
    <button type="button" onClick={() => setKanal(k)}
      className={`px-2 py-0.5 text-[11px] rounded-md ${kanal === k ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
      {namn}
    </button>
  );

  return (
    <div className="bg-white border border-slate-300 rounded-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
      {nyttMejl && (
        <input value={rubrik} onChange={(e) => setRubrik(e.target.value)} placeholder="Ämne"
          className="w-full px-3 pt-2.5 pb-1 text-sm font-medium text-slate-900 bg-transparent border-b border-slate-100 focus:outline-none" />
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !bilagor.laddar) skicka(); }}
        placeholder={kanal === 'mejl' ? `Skriv ett mejl till ${email}…` : `Skriv ett SMS till ${phone}…`}
        rows={Math.min(12, Math.max(3, text.split('\n').length + 1))}
        className="w-full px-3 py-2.5 text-sm text-slate-900 bg-transparent resize-none focus:outline-none"
      />
      {kanal === 'mejl' && <div className="px-2"><BilageLista b={bilagor} /></div>}
      <div className="flex items-center gap-1 px-2 pb-2">
        {email && flik('mejl', 'Mejl')}
        {phone && flik('sms', 'SMS')}
        {kanal === 'mejl' && <BilageKnapp b={bilagor} disabled={skickar} />}
        {kanal === 'mejl' && svarPa && <span className="text-[11px] text-slate-400 ml-1">svar i tråden · signaturen läggs på</span>}
        {kanal === 'sms' && text && <span className="text-[11px] text-slate-400 ml-1">{text.length} tecken</span>}
        {fel && <span className="text-xs text-red-600 ml-2">{fel}</span>}
        <button onClick={skicka} disabled={skickar || !text.trim() || (nyttMejl && !rubrik.trim()) || (kanal === 'mejl' && bilagor.laddar > 0)}
          className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
          {skickar ? 'Skickar…' : 'Skicka'}
        </button>
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
    <div className="px-4 py-3 border-b border-slate-200 bg-violet-50/40">
      <p className="text-sm font-semibold text-violet-900">Anteckningar till AI:n</p>
      <p className="text-xs text-violet-800/70 mb-2">Följer med varje gång AI:n skriver ett svar. Tryck ↻ på utkastet efteråt för att få ett nytt.</p>
      {anteckningar.length > 0 && (
        <ul className="space-y-1 mb-3">
          {anteckningar.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm bg-white border border-violet-200 rounded-lg px-2.5 py-1.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${a.omfang === 'generell' ? 'bg-slate-100 text-slate-600' : 'bg-violet-100 text-violet-800'}`}>
                {a.omfang === 'generell' ? 'ALLA' : 'KUNDEN'}
              </span>
              <span className="text-slate-800 whitespace-pre-wrap flex-1">{a.text}</span>
              <button onClick={() => kor({ action: 'anteckning-bort', id: a.id })} disabled={upptagen} title="Ta bort"
                className="text-slate-400 hover:text-red-600 shrink-0">✕</button>
            </li>
          ))}
        </ul>
      )}
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2}
        placeholder="T.ex. Svara kortare. Nämn inte priset förrän de frågar."
        className="w-full bg-white border border-violet-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400" />
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
          <input type="radio" checked={omfang === 'kund'} onChange={() => setOmfang('kund')} className="accent-violet-600" /> Bara den här kunden
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
          <input type="radio" checked={omfang === 'generell'} onChange={() => setOmfang('generell')} className="accent-violet-600" /> Generellt (alla svar)
        </label>
        {fel && <span className="text-xs text-red-600">{fel}</span>}
        <button onClick={() => kor({ action: 'anteckning-ny', key: personKey, text, omfang }, () => setText(''))}
          disabled={upptagen || !text.trim()}
          className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">
          Spara anteckning
        </button>
      </div>
    </div>
  );
}

