'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AdminMote, Arende, Person } from '@/lib/admin-types';
import { PersonValjare, type ValdPerson } from '../_personvaljare';

/**
 * Ärenden: allt vi ska göra senare, och de bokade mötena.
 *
 * Mail- och SMS-AI:n lägger in ärenden själva när ett meddelande kräver att vi
 * gör något senare. De behöver inte godkännas, men allt går att ändra: klicka
 * på ett ärende för att redigera det.
 */

const idag = () => new Date().toLocaleDateString('sv-SE');
const DAG = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const datum = (d: string) => DAG.format(new Date(`${d}T00:00:00Z`));

type Post =
  | { slag: 'arende'; datum: string | null; arende: Arende }
  | { slag: 'mote'; datum: string; mote: AdminMote };

const personLank = (key: string) => `/admin/person/${encodeURIComponent(key)}`;

export default function ArendenPage() {
  const [arenden, setArenden] = useState<Arende[] | null>(null);
  const [moten, setMoten] = useState<AdminMote[]>([]);
  const [personer, setPersoner] = useState<Person[]>([]);
  const [fel, setFel] = useState('');
  const [ny, setNy] = useState(false);
  const [redigerar, setRedigerar] = useState<string | null>(null);
  const [visaKlara, setVisaKlara] = useState(false);

  useEffect(() => {
    fetch('/api/admin/arenden').then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error);
      else { setArenden(d.arenden); setMoten(d.moten); }
    }).catch(() => setFel('Kunde inte hämta ärendena'));
    fetch('/api/admin/people').then((r) => r.json()).then((d) => setPersoner(d.people ?? [])).catch(() => {});
  }, []);

  const spara = async (metod: 'POST' | 'PATCH', data: Partial<Arende> & { id?: string }) => {
    setFel('');
    const res = await fetch('/api/admin/arenden', {
      method: metod, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { setFel(d?.error || 'Kunde inte spara'); return false; }
    const a: Arende = d.arende;
    setArenden((lista) => metod === 'POST' ? [a, ...(lista ?? [])] : (lista ?? []).map((x) => (x.id === a.id ? a : x)));
    return true;
  };

  const taBort = async (id: string) => {
    const res = await fetch(`/api/admin/arenden?id=${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { setFel('Kunde inte ta bort'); return; }
    setArenden((lista) => (lista ?? []).filter((x) => x.id !== id));
    setRedigerar(null);
  };

  const grupper = useMemo(() => {
    const d = idag();
    const poster: Post[] = [
      ...(arenden ?? []).filter((a) => a.status === 'oppen').map((a): Post => ({ slag: 'arende', datum: a.datum, arende: a })),
      ...moten.filter((m) => m.datum >= d).map((m): Post => ({ slag: 'mote', datum: m.datum, mote: m })),
    ].sort((a, b) => (a.datum ?? '9999').localeCompare(b.datum ?? '9999')
      || (a.slag === 'mote' ? a.mote.tid ?? '' : '').localeCompare(b.slag === 'mote' ? b.mote.tid ?? '' : ''));
    return [
      { id: 'forsenade', rubrik: 'Försenade', poster: poster.filter((p) => p.datum && p.datum < d), rod: true },
      { id: 'idag', rubrik: 'Idag', poster: poster.filter((p) => p.datum === d) },
      { id: 'kommande', rubrik: 'Kommande', poster: poster.filter((p) => p.datum && p.datum > d) },
      { id: 'utan', rubrik: 'Utan datum', poster: poster.filter((p) => !p.datum) },
    ].filter((g) => g.poster.length);
  }, [arenden, moten]);

  const klara = (arenden ?? []).filter((a) => a.status === 'klar');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mr-auto">Ärenden</h1>
        <button
          onClick={() => { setNy(true); setRedigerar(null); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
        >
          + Nytt ärende
        </button>
      </div>

      {fel && <p className="text-red-600 text-sm mb-4">{fel}</p>}

      {ny && (
        <div className="mb-6">
          <Formular
            personer={personer}
            onSpara={async (data) => { if (await spara('POST', data)) setNy(false); }}
            onAvbryt={() => setNy(false)}
          />
        </div>
      )}

      {!arenden && !fel && <p className="text-slate-500 text-sm">Hämtar…</p>}
      {arenden && grupper.length === 0 && !ny && (
        <p className="text-slate-500 text-sm">Inga öppna ärenden och inga kommande möten.</p>
      )}

      {grupper.map((g) => (
        <section key={g.id} className="mb-6">
          <h2 className={`text-[11px] font-semibold uppercase tracking-widest mb-2 ${g.rod ? 'text-red-600' : 'text-slate-500'}`}>
            {g.rubrik} <span className="text-slate-400 font-normal">{g.poster.length}</span>
          </h2>
          <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {g.poster.map((p) => p.slag === 'mote'
              ? <MoteRad key={`m-${p.mote.id}`} mote={p.mote} />
              : redigerar === p.arende.id
                ? (
                  <li key={p.arende.id} className="p-3">
                    <Formular
                      arende={p.arende}
                      personer={personer}
                      onSpara={async (data) => { if (await spara('PATCH', { ...data, id: p.arende.id })) setRedigerar(null); }}
                      onAvbryt={() => setRedigerar(null)}
                      onTaBort={() => taBort(p.arende.id)}
                    />
                  </li>
                )
                : (
                  <ArendeRad
                    key={p.arende.id}
                    arende={p.arende}
                    forsenad={!!g.rod}
                    onKlar={() => spara('PATCH', { id: p.arende.id, status: 'klar' })}
                    onRedigera={() => { setRedigerar(p.arende.id); setNy(false); }}
                  />
                ))}
          </ul>
        </section>
      ))}

      {klara.length > 0 && (
        <section>
          <button onClick={() => setVisaKlara(!visaKlara)} className="text-xs text-slate-500 hover:text-slate-800 mb-2">
            {visaKlara ? '▾' : '▸'} Klara senaste 30 dagarna ({klara.length})
          </button>
          {visaKlara && (
            <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {klara.map((a) => (
                <ArendeRad key={a.id} arende={a} forsenad={false}
                  onKlar={() => spara('PATCH', { id: a.id, status: 'oppen' })}
                  onRedigera={() => {}} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function KallaMarke({ kalla }: { kalla: Arende['kalla'] }) {
  if (kalla === 'manuell') return null;
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
      AI · {kalla === 'mejl' ? 'mejl' : 'SMS'}
    </span>
  );
}

function ArendeRad({ arende, forsenad, onKlar, onRedigera }: {
  arende: Arende; forsenad: boolean; onKlar: () => void; onRedigera: () => void;
}) {
  const klar = arende.status === 'klar';
  return (
    <li className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer" onClick={onRedigera}>
      <input
        type="checkbox"
        checked={klar}
        onClick={(e) => e.stopPropagation()}
        onChange={onKlar}
        title={klar ? 'Öppna igen' : 'Markera som klart'}
        className="mt-1 w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${klar ? 'line-through text-slate-400' : 'text-slate-900'}`}>{arende.titel}</span>
          <KallaMarke kalla={arende.kalla} />
        </div>
        {arende.beskrivning && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{arende.beskrivning}</p>}
      </div>
      <div className="text-right shrink-0">
        {arende.datum && <p className={`text-xs ${forsenad ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{datum(arende.datum)}</p>}
        {arende.personKey && (
          <Link href={personLank(arende.personKey)} onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-700 hover:underline">
            {arende.personNamn || arende.personKey}
          </Link>
        )}
      </div>
    </li>
  );
}

function MoteRad({ mote }: { mote: AdminMote }) {
  const key = mote.email || mote.telefon;
  return (
    <li className="flex items-start gap-3 px-4 py-3 bg-sky-50/50">
      <span className="mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 shrink-0">MÖTE</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">
          {mote.tid && <span className="tabular-nums mr-2">{mote.tid}</span>}
          {key
            ? <Link href={personLank(key)} className="hover:text-blue-700 hover:underline">{mote.namn || key}</Link>
            : mote.namn || 'Okänd'}
        </p>
        {mote.meddelande && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{mote.meddelande}</p>}
      </div>
      <p className="text-xs text-slate-500 shrink-0">{datum(mote.datum)}</p>
    </li>
  );
}

function Formular({ arende, personer, onSpara, onAvbryt, onTaBort }: {
  arende?: Arende;
  personer: Person[];
  onSpara: (data: Partial<Arende>) => Promise<void>;
  onAvbryt: () => void;
  onTaBort?: () => void;
}) {
  const [titel, setTitel] = useState(arende?.titel ?? '');
  const [beskrivning, setBeskrivning] = useState(arende?.beskrivning ?? '');
  const [dag, setDag] = useState(arende?.datum ?? idag());
  const [person, setPerson] = useState<ValdPerson | null>(
    arende?.personKey ? { personKey: arende.personKey, personNamn: arende.personNamn } : null);
  const [sparar, setSparar] = useState(false);

  const input = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500';

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!titel.trim()) return;
        setSparar(true);
        await onSpara({ titel, beskrivning, datum: dag || null, personKey: person?.personKey ?? null, personNamn: person?.personNamn ?? null });
        setSparar(false);
      }}
      onClick={(e) => e.stopPropagation()}
      className="bg-white border border-blue-200 rounded-xl p-4 space-y-3 shadow-sm"
    >
      <input autoFocus value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Vad ska göras?" className={`${input} font-medium`} />
      <div className="grid sm:grid-cols-[180px_1fr] gap-3">
        <input type="date" value={dag ?? ''} onChange={(e) => setDag(e.target.value)} className={input} />
        <PersonValjare personer={personer} valt={person} onVal={setPerson} />
      </div>
      <textarea value={beskrivning} onChange={(e) => setBeskrivning(e.target.value)} placeholder="Anteckning (valfritt)" rows={3} className={input} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={sparar || !titel.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
          {sparar ? 'Sparar…' : 'Spara'}
        </button>
        <button type="button" onClick={onAvbryt} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">Avbryt</button>
        {onTaBort && (
          <button type="button" onClick={onTaBort} className="ml-auto px-3 py-2 text-sm text-red-600 hover:text-red-700">Ta bort</button>
        )}
      </div>
    </form>
  );
}
