'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  InkorgKategori, InkorgKonversation, InkorgMeddelande, InkorgTrad, InkorgUtkast, MomsPeriod, Redovisningsmetod,
} from '@/lib/admin-types';

/**
 * Inkorgen: mejl och SMS i samma lista, som en vanlig inkorg.
 *
 * Till vänster konversationerna, en per person. Till höger hela tråden med
 * både mejl och SMS i tidsordning, och utkasten AI:n skrivit. Inget går ut
 * förrän någon trycker Skicka.
 */

const FLIKAR: { id: InkorgKategori | 'alla'; namn: string }[] = [
  { id: 'alla', namn: 'Alla' },
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
  const [flik, setFlik] = useState<InkorgKategori | 'alla'>('alla');
  const [bara, setBara] = useState<'alla' | 'olasta' | 'utkast'>('alla');
  const [sok, setSok] = useState('');
  const [vald, setVald] = useState<string | null>(null);

  const ladda = useCallback(() => {
    fetch('/api/admin/inkorg').then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error); else setLista(d.konversationer);
    }).catch(() => setFel('Kunde inte hämta inkorgen'));
  }, []);

  useEffect(() => {
    ladda();
    const t = setInterval(ladda, 60_000);
    return () => clearInterval(t);
  }, [ladda]);

  const synliga = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (lista ?? []).filter((k) =>
      (flik === 'alla' || k.kategori === flik)
      && (bara === 'alla' || (bara === 'olasta' ? k.olast : k.utkast > 0))
      && (!q || [k.namn, k.email, k.phone, k.senaste.text].some((f) => f?.toLowerCase().includes(q))));
  }, [lista, flik, bara, sok]);

  const antal = (id: InkorgKategori | 'alla') => (lista ?? []).filter((k) => (id === 'alla' || k.kategori === id) && (k.olast || k.utkast > 0)).length;

  const oppna = (key: string) => {
    setVald(key);
    setLista((l) => l?.map((k) => (k.key === key ? { ...k, olast: false } : k)) ?? null);
    fetch('/api/admin/inkorg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'last', key }) }).catch(() => {});
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <aside className="w-full lg:w-[400px] shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden lg:sticky lg:top-20">
        <div className="p-3 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Inkorg</h1>
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

        {fel && <p className="text-red-600 text-sm p-3">{fel}</p>}
        {!lista && !fel && <p className="text-slate-500 text-sm p-3">Hämtar…</p>}
        {lista && synliga.length === 0 && <p className="text-slate-500 text-sm p-3">Inget här.</p>}

        <ul className="divide-y divide-slate-100 lg:max-h-[calc(100vh-14rem)] overflow-y-auto">
          {synliga.map((k) => (
            <li key={k.key}>
              <button onClick={() => oppna(k.key)}
                className={`w-full text-left px-3 py-2.5 transition ${vald === k.key ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <span className="flex items-center gap-2">
                  {k.olast && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                  <span className={`text-sm truncate mr-auto ${k.olast ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{k.namn}</span>
                  {k.utkast > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Utkast</span>}
                  <span className="text-[11px] text-slate-400 shrink-0">{tidKort(k.senaste.at)}</span>
                </span>
                <span className="flex items-center gap-1.5 mt-0.5">
                  <KanalMarke kanal={k.senaste.kanal} />
                  <span className={`text-xs truncate ${k.olast ? 'text-slate-700' : 'text-slate-500'}`}>
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
        {vald
          ? <Trad key={vald} personKey={vald} onAndrat={ladda} />
          : <p className="text-slate-500 text-sm mt-16 text-center">Välj en konversation.</p>}
      </section>
    </div>
  );
}

function Trad({ personKey, onAndrat }: { personKey: string; onAndrat: () => void }) {
  const [trad, setTrad] = useState<InkorgTrad | null>(null);
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
        <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${
          trad.kategori === 'kund' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : trad.kategori === 'saknar' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {KATEGORI_NAMN[trad.kategori]}
        </span>
      </header>

      {trad.uppgifter && p.profileId && (
        <Ombudsuppgifter profileId={p.profileId} uppgifter={trad.uppgifter} onSparat={uppdatera} />
      )}

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
        {trad.utkast.map((u) => <Utkast key={`${u.kanal}-${u.id}`} u={u} onKlar={uppdatera} />)}
        <Skriv personKey={personKey} email={p.email} phone={p.phone} svarPa={senasteMejlIn?.gmailMessageId ?? null}
          amne={senasteAmne} onKlar={uppdatera} />
      </div>
    </div>
  );
}

function Bubbla({ m }: { m: InkorgMeddelande }) {
  const [hel, setHel] = useState(false);
  if (m.automatisk) {
    return (
      <p className="text-center text-[11px] text-slate-400" title={m.text}>
        Automatiskt SMS · {tidLang(m.at)} · {m.text.replace(/s+/g, ' ').slice(0, 70)}…
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

function Utkast({ u, onKlar }: { u: InkorgUtkast; onKlar: () => void }) {
  const [text, setText] = useState(u.text);
  const [upptagen, setUpptagen] = useState(false);
  const [fel, setFel] = useState(u.fel ?? '');

  const kor = async (fn: () => Promise<unknown>) => {
    setUpptagen(true); setFel('');
    try { await fn(); onKlar(); } catch (e) { setFel(e instanceof Error ? e.message : 'Något gick fel'); } finally { setUpptagen(false); }
  };

  const skicka = () => kor(() => u.kanal === 'mejl'
    ? post('/api/admin/inkorg', { action: 'skicka-mejl', id: u.id, text })
    : post('/api/admin/sms-drafts', { id: u.id, body: text }));
  const spara = () => kor(() => u.kanal === 'mejl'
    ? post('/api/admin/inkorg', { action: 'spara-mejl', id: u.id, text })
    : post('/api/admin/sms-drafts', { id: u.id, body: text }, 'PATCH'));
  const slang = () => kor(() => u.kanal === 'mejl'
    ? post('/api/admin/inkorg', { action: 'slang-mejl', id: u.id })
    : post('/api/admin/sms-drafts', { id: u.id }, 'DELETE'));

  return (
    <div className="bg-white border-2 border-amber-300 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">UTKAST</span>
        <KanalMarke kanal={u.kanal} />
        <span className="text-xs text-slate-500 truncate">till {u.till}{u.kanal === 'mejl' && !u.svarPa ? ' · nytt mejl' : ''}</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(14, Math.max(4, text.split('\n').length + 1))}
        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
      {u.kanal === 'sms' && <p className="text-[11px] text-slate-400 mt-0.5">{text.length} tecken</p>}
      {u.kanal === 'mejl' && <p className="text-[11px] text-slate-400 mt-0.5">Signaturen läggs på när mejlet skickas.</p>}
      {fel && <p className="text-xs text-red-600 mt-1">{fel}</p>}
      <div className="flex items-center gap-2 mt-2">
        <button onClick={skicka} disabled={upptagen || !text.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          {upptagen ? 'Skickar…' : 'Skicka'}
        </button>
        {text !== u.text && <button onClick={spara} disabled={upptagen} className="px-3 py-2 text-sm text-slate-700 hover:text-slate-900">Spara ändring</button>}
        <button onClick={slang} disabled={upptagen} className="ml-auto px-3 py-2 text-sm text-slate-500 hover:text-red-600">Släng</button>
      </div>
    </div>
  );
}

function Skriv({ personKey, email, phone, svarPa, amne, onKlar }: {
  personKey: string; email: string | null; phone: string | null; svarPa: string | null; amne: string | null; onKlar: () => void;
}) {
  const [kanal, setKanal] = useState<'mejl' | 'sms'>(email ? 'mejl' : 'sms');
  const [oppen, setOppen] = useState(false);
  const [text, setText] = useState('');
  const [rubrik, setRubrik] = useState(amne ? (amne.startsWith('Re:') ? amne : `Re: ${amne}`) : '');
  const [upptagen, setUpptagen] = useState<'' | 'ai' | 'skicka'>('');
  const [fel, setFel] = useState('');

  const ai = async (k: 'mejl' | 'sms') => {
    setUpptagen('ai'); setFel('');
    try { await post('/api/admin/inkorg', { action: 'ai-utkast', key: personKey, kanal: k }); onKlar(); }
    catch (e) { setFel(e instanceof Error ? e.message : 'AI:n kunde inte skriva'); }
    finally { setUpptagen(''); }
  };

  const skicka = async () => {
    setUpptagen('skicka'); setFel('');
    try {
      if (kanal === 'mejl') await post('/api/admin/inkorg', { action: 'nytt-mejl', till: email, amne: svarPa ? undefined : rubrik, svarPa, text });
      else await post('/api/admin/sms-send', { phone, body: text });
      setText(''); setOppen(false); onKlar();
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte skicka'); }
    finally { setUpptagen(''); }
  };

  const knapp = 'px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50';

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setOppen(!oppen)} className={knapp}>{oppen ? 'Stäng' : 'Skriv själv'}</button>
        {email && <button onClick={() => ai('mejl')} disabled={!!upptagen} className={knapp}>✨ AI-utkast mejl</button>}
        {phone && <button onClick={() => ai('sms')} disabled={!!upptagen} className={knapp}>✨ AI-utkast SMS</button>}
        {upptagen === 'ai' && <span className="text-xs text-slate-500">AI:n skriver… (kan ta en halvminut)</span>}
      </div>
      {fel && <p className="text-xs text-red-600 mt-2">{fel}</p>}
      {oppen && (
        <div className="mt-3 bg-white border border-slate-300 rounded-xl p-3 space-y-2">
          <div className="flex gap-1">
            {email && <button onClick={() => setKanal('mejl')} className={`px-2.5 py-1 text-xs rounded-lg ${kanal === 'mejl' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Mejl</button>}
            {phone && <button onClick={() => setKanal('sms')} className={`px-2.5 py-1 text-xs rounded-lg ${kanal === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>SMS</button>}
            <span className="text-xs text-slate-500 self-center ml-2">till {kanal === 'mejl' ? email : phone}{kanal === 'mejl' && svarPa ? ' · svar i tråden' : ''}</span>
          </div>
          {kanal === 'mejl' && !svarPa && (
            <input value={rubrik} onChange={(e) => setRubrik(e.target.value)} placeholder="Ämne"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
          )}
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          <button onClick={skicka} disabled={!!upptagen || !text.trim() || (kanal === 'mejl' && !svarPa && !rubrik.trim())}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {upptagen === 'skicka' ? 'Skickar…' : 'Skicka'}
          </button>
        </div>
      )}
    </div>
  );
}

const MOMS: { v: MomsPeriod; t: string }[] = [
  { v: 'månadsvis', t: 'Månadsvis' }, { v: 'kvartalsvis', t: 'Kvartalsvis' }, { v: 'helår', t: 'Årsvis' }, { v: 'ingen-moms', t: 'Ingen moms' },
];

function Ombudsuppgifter({ profileId, uppgifter, onSparat }: {
  profileId: string;
  uppgifter: NonNullable<InkorgTrad['uppgifter']>;
  onSparat: () => void;
}) {
  const [moms, setMoms] = useState<MomsPeriod | ''>(uppgifter.momsPeriod ?? '');
  const [startAr, setStartAr] = useState(uppgifter.startAr ? String(uppgifter.startAr) : '');
  const [metod, setMetod] = useState<Redovisningsmetod | ''>(uppgifter.redovisningsmetod ?? '');
  const [upptagen, setUpptagen] = useState(false);
  const [fel, setFel] = useState('');

  const spara = async (klart?: boolean) => {
    setUpptagen(true); setFel('');
    try {
      await post('/api/admin/inkorg', {
        action: 'ombud', profileId, momsPeriod: moms, startAr, redovisningsmetod: metod,
        ...(klart !== undefined ? { klart } : {}),
      });
      onSparat();
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte spara'); } finally { setUpptagen(false); }
  };

  if (uppgifter.ombudKlart) {
    return (
      <div className="px-4 py-2 border-b border-slate-200 text-xs text-slate-500 flex items-center gap-2">
        <span className="text-emerald-700">✓ Ombud klart {new Date(uppgifter.ombudKlart).toLocaleDateString('sv-SE')}</span>
        <span>· {MOMS.find((m) => m.v === uppgifter.momsPeriod)?.t ?? 'momsperiod saknas'} · startår {uppgifter.startAr ?? '–'} · {uppgifter.redovisningsmetod ?? 'metod saknas'}</span>
        <button onClick={() => spara(false)} disabled={upptagen} className="ml-auto text-slate-400 hover:text-red-600">Ångra</button>
      </div>
    );
  }

  const falt = 'bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900';
  return (
    <div className="px-4 py-3 border-b border-slate-200 bg-amber-50/50">
      <p className="text-sm font-semibold text-amber-900 mb-1">Uppgifter från Skatteverket</p>
      <p className="text-xs text-amber-800/80 mb-2">När kunden lagt in oss som deklarationsombud: fyll i det vi hämtat och tryck Ombud klart. Då flyttas kunden till Kunder.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={moms} onChange={(e) => setMoms(e.target.value as MomsPeriod)} className={falt}>
          <option value="">Momsperiod…</option>
          {MOMS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
        </select>
        <input value={startAr} onChange={(e) => setStartAr(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Startår" className={`${falt} w-24`} />
        <select value={metod} onChange={(e) => setMetod(e.target.value as Redovisningsmetod)} className={falt}>
          <option value="">Bokföringsmetod…</option>
          <option value="faktureringsmetoden">Faktureringsmetoden</option>
          <option value="kontantmetoden">Kontantmetoden</option>
        </select>
        <button onClick={() => spara()} disabled={upptagen} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Spara</button>
        <button onClick={() => spara(true)} disabled={upptagen || !moms || !startAr || !metod}
          title={!moms || !startAr || !metod ? 'Fyll i alla tre först' : ''}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
          Ombud klart ✓
        </button>
      </div>
      {fel && <p className="text-xs text-red-600 mt-1">{fel}</p>}
    </div>
  );
}
