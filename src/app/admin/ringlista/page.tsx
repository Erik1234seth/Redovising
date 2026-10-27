'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Ringlistan: firmorna som ska ringas upp, en rad per firma.
 *
 * Mejl och anteckning sparas när man lämnar fältet. "Skicka info" skickar
 * infomejlet och välkomst-SMS:et och lägger in personen som lead — sedan tar
 * inkorgen över.
 */

type Status = 'ej_ringd' | 'ringd' | 'ej_intresserad';
// "Info skickad" är ingen status utan läses från info_skickad_at — de har också status Ringd
type Filter = Status | 'info_skickad' | 'alla';

interface Rad {
  id: string;
  namn: string;
  bransch: string | null;
  email: string | null;
  telefon: string | null;
  postnr: string | null;
  ort: string | null;
  registrerad: string | null;
  anteckning: string | null;
  status: Status;
  info_skickad_at: string | null;
  updated_at: string | null;
}

const STATUS_NAMN: Record<Status, string> = {
  ej_ringd: 'Ej ringd',
  ringd: 'Ringd',
  ej_intresserad: 'Ej intresserad',
};

const STATUS_FARG: Record<Status, string> = {
  ej_ringd: 'bg-slate-100 text-slate-700',
  ringd: 'bg-amber-100 text-amber-800',
  ej_intresserad: 'bg-red-50 text-red-700',
};

const PER_SIDA = 50;

type Sortering = 'standard' | 'namn' | 'bransch' | 'postnr' | 'ort' | 'telefon' | 'registrerad' | 'status' | 'andrad' | 'info_skickad';

const SORTERING_NAMN: Record<Sortering, string> = {
  standard: 'Som utskriften',
  namn: 'Namn',
  bransch: 'Bransch',
  postnr: 'Postnummer',
  ort: 'Ort',
  telefon: 'Telefon',
  registrerad: 'Registrerad',
  status: 'Status',
  andrad: 'Senast ändrad',
  info_skickad: 'Info skickad',
};

const sv = new Intl.Collator('sv');

const traffar = (r: Rad, f: Filter) => f === 'alla' || (f === 'info_skickad' ? !!r.info_skickad_at : r.status === f);

/** Värdet en rad sorteras på. Tomma fält hamnar alltid sist. */
function sorteringsvarde(r: Rad, s: Sortering): string | null {
  switch (s) {
    case 'namn': return r.namn;
    case 'bransch': return r.bransch;
    case 'postnr': return r.postnr?.replace(/\D/g, '') || null;
    case 'ort': return r.ort;
    case 'telefon': return r.telefon?.replace(/\D/g, '') || null;
    case 'registrerad': return r.registrerad;
    case 'status': return String((['ej_ringd', 'ringd', 'ej_intresserad'] as Status[]).indexOf(r.status));
    case 'andrad': return r.updated_at;
    case 'info_skickad': return r.info_skickad_at;
    default: return null;
  }
}

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/admin/ringlista', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error(d.error || 'Något gick fel');
  return d;
}

export default function RinglistaPage() {
  const [rader, setRader] = useState<Rad[] | null>(null);
  const [fel, setFel] = useState('');
  const [sok, setSok] = useState('');
  const [filter, setFilter] = useState<Filter>('ej_ringd');
  const [sortering, setSortering] = useState<Sortering>('standard');
  const [fallande, setFallande] = useState(false);
  const [antal, setAntal] = useState(PER_SIDA);

  const ladda = useCallback(() => {
    fetch('/api/admin/ringlista').then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error); else setRader(d.rader);
    }).catch(() => setFel('Kunde inte hämta listan'));
  }, []);
  useEffect(() => { ladda(); }, [ladda]);
  useEffect(() => { setAntal(PER_SIDA); }, [sok, filter, sortering, fallande]);

  const synliga = useMemo(() => {
    const q = sok.trim().toLowerCase();
    const urval = (rader ?? []).filter((r) =>
      traffar(r, filter)
      && (!q || [r.namn, r.email, r.telefon, r.postnr, r.ort, r.bransch, r.anteckning].some((f) => f?.toLowerCase().includes(q))));
    if (sortering === 'standard') return fallande ? urval.reverse() : urval;
    // Sorteringen är stabil, så lika värden behåller utskriftens ordning
    return urval.sort((a, b) => {
      const va = sorteringsvarde(a, sortering), vb = sorteringsvarde(b, sortering);
      if (!va || !vb) return (va ? 0 : 1) - (vb ? 0 : 1);
      const j = sortering === 'telefon' || sortering === 'postnr' ? Number(va) - Number(vb) : sv.compare(va, vb);
      return fallande ? -j : j;
    });
  }, [rader, sok, filter, sortering, fallande]);

  const raknare = (f: Filter) => (rader ?? []).filter((r) => traffar(r, f)).length;
  const andra = (id: string, andring: Partial<Rad>) => setRader((l) => l?.map((r) => (r.id === id ? { ...r, ...andring } : r)) ?? null);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-900">Ringlista</h1>
          {rader && <p className="text-xs text-slate-500">{rader.length} firmor · {raknare('info_skickad')} har fått info</p>}
        </div>
        <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök namn, ort, telefon…"
          className="w-full sm:w-64 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="flex gap-1 mb-4 flex-wrap items-center">
        {(['ej_ringd', 'ringd', 'info_skickad', 'ej_intresserad', 'alla'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-2.5 py-1 text-xs rounded-lg transition ${filter === s ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {s === 'alla' ? 'Alla' : s === 'info_skickad' ? 'Info skickad' : STATUS_NAMN[s]}
            {s !== 'alla' && rader && <span className={`ml-1 ${filter === s ? 'text-white/80' : 'text-slate-400'}`}>{raknare(s)}</span>}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          Sortera
          <select value={sortering} onChange={(e) => setSortering(e.target.value as Sortering)}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500">
            {(Object.keys(SORTERING_NAMN) as Sortering[]).map((s) => <option key={s} value={s}>{SORTERING_NAMN[s]}</option>)}
          </select>
        </label>
        <button onClick={() => setFallande((f) => !f)} title={fallande ? 'Fallande — klicka för stigande' : 'Stigande — klicka för fallande'}
          className="px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
          {fallande ? '↓' : '↑'}
        </button>
      </div>

      {fel && <p className="text-red-600 text-sm mb-3">{fel}</p>}
      {!rader && !fel && <p className="text-slate-500 text-sm">Hämtar…</p>}
      {rader && synliga.length === 0 && <p className="text-slate-500 text-sm">Inget här.</p>}

      <ul className="space-y-2">
        {synliga.slice(0, antal).map((r) => <Kort key={r.id} r={r} onAndrat={(a) => andra(r.id, a)} />)}
      </ul>

      {synliga.length > antal && (
        <button onClick={() => setAntal((a) => a + PER_SIDA)}
          className="mt-4 w-full py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-lg">
          Visa fler ({synliga.length - antal} kvar)
        </button>
      )}
    </div>
  );
}

function Kort({ r, onAndrat }: { r: Rad; onAndrat: (a: Partial<Rad>) => void }) {
  const [email, setEmail] = useState(r.email ?? '');
  const [anteckning, setAnteckning] = useState(r.anteckning ?? '');
  const [sparat, setSparat] = useState('');
  const [fel, setFel] = useState('');
  const [skickar, setSkickar] = useState(false);

  const spara = async (andring: Partial<Rad>) => {
    setFel('');
    try {
      await post({ action: 'spara', id: r.id, ...andring });
      onAndrat(andring);
      setSparat('Sparat');
      setTimeout(() => setSparat(''), 1500);
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte spara'); }
  };

  const skickaInfo = async () => {
    setSkickar(true); setFel('');
    try {
      // Mejl och anteckning som inte hunnit sparas följer med
      if (email.trim() !== (r.email ?? '') || anteckning.trim() !== (r.anteckning ?? '')) {
        await post({ action: 'spara', id: r.id, email, anteckning });
        onAndrat({ email: email.trim().toLowerCase() || null, anteckning: anteckning.trim() || null });
      }
      const d = await post({ action: 'skicka-info', id: r.id });
      onAndrat({ status: 'ringd', info_skickad_at: new Date().toISOString() });
      setSparat(d.sms ? 'Mejl och SMS skickat' : d.smsFel ? `Mejlet skickat, SMS:et misslyckades: ${d.smsFel}` : 'Mejlet skickat');
    } catch (e) { setFel(e instanceof Error ? e.message : 'Kunde inte skicka'); }
    finally { setSkickar(false); }
  };

  const skickad = !!r.info_skickad_at;

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="mr-auto min-w-0">
          <p className="font-semibold text-slate-900">{r.namn}</p>
          <p className="text-xs text-slate-500">
            {[[r.postnr, r.ort].filter(Boolean).join(' '), r.bransch, r.registrerad && `reg. ${r.registrerad}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {r.telefon && (
          <a href={`tel:${r.telefon}`} className="text-sm font-medium text-blue-700 hover:underline tabular-nums">{r.telefon}</a>
        )}
        <select value={r.status} onChange={(e) => spara({ status: e.target.value as Status })}
          className={`text-xs font-medium rounded-lg px-2 py-1 border-0 ${STATUS_FARG[r.status]}`}>
          {(Object.keys(STATUS_NAMN) as Status[]).map((s) => <option key={s} value={s}>{STATUS_NAMN[s]}</option>)}
        </select>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[16rem_1fr]">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Mejladress"
          onBlur={() => { if (email.trim() !== (r.email ?? '')) spara({ email: email.trim().toLowerCase() || null }); }}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
        <textarea value={anteckning} onChange={(e) => setAnteckning(e.target.value)} placeholder="Anteckning"
          onBlur={() => { if (anteckning.trim() !== (r.anteckning ?? '')) spara({ anteckning: anteckning.trim() || null }); }}
          rows={Math.min(6, Math.max(1, anteckning.split('\n').length))}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 resize-none focus:outline-none focus:border-blue-500" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {skickad ? (
          <span className="text-xs text-emerald-700">
            Info skickad {new Date(r.info_skickad_at!).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} · finns under Leads i inkorgen
          </span>
        ) : (
          <button onClick={skickaInfo} disabled={skickar || !email.includes('@')}
            title={email.includes('@') ? 'Skickar infomejlet och ett SMS, och lägger in personen som lead' : 'Lägg in en mejladress först'}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40">
            {skickar ? 'Skickar…' : 'Skicka info'}
          </button>
        )}
        {sparat && <span className="text-xs text-emerald-700">{sparat}</span>}
        {fel && <span className="text-xs text-red-600">{fel}</span>}
      </div>
    </li>
  );
}
