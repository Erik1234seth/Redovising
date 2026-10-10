'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { AdminMote, Arende, InlamningKund, Person } from '@/lib/admin-types';
import type { Kalenderhandelse } from '@/lib/kalender';
import { PersonValjare, type ValdPerson } from '../_personvaljare';

/**
 * Kalendern: deadlines, planerade utskick, ärenden och möten per dag.
 *
 * En deadline har kundkort — vilka kunder den gäller, om bokföringen för
 * perioden finns och om den är inlämnad. Klicka på en dag för att se allt
 * den dagen, skapa ett ärende eller boka ett möte.
 */

const MANADER = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
const VECKODAGAR = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`;
const idag = () => new Date().toLocaleDateString('sv-SE');
const LANG = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

interface Data {
  handelser: Kalenderhandelse[];
  kundkort: Record<string, InlamningKund[]>;
  arenden: Arende[];
  moten: AdminMote[];
}

const FARG = {
  deadline: 'bg-red-50 text-red-700 border-red-200',
  klar: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  utskick: 'bg-violet-50 text-violet-700 border-violet-200',
  info: 'bg-slate-100 text-slate-600 border-slate-200',
  arende: 'bg-amber-50 text-amber-800 border-amber-200',
  mote: 'bg-sky-50 text-sky-800 border-sky-200',
};

export default function KalenderPage() {
  const nu = idag();
  const [ar, setAr] = useState(Number(nu.slice(0, 4)));
  const [manad, setManad] = useState(Number(nu.slice(5, 7)));
  const [vald, setVald] = useState(nu);
  const [data, setData] = useState<Data | null>(null);
  const [personer, setPersoner] = useState<Person[]>([]);
  const [fel, setFel] = useState('');

  // Rutnätet börjar på måndagen före den 1:a och slutar på söndagen efter månadens sista dag
  const dagar = useMemo(() => {
    const forsta = new Date(Date.UTC(ar, manad - 1, 1));
    const start = new Date(forsta);
    start.setUTCDate(1 - ((forsta.getUTCDay() + 6) % 7));
    const ut: string[] = [];
    for (let i = 0; i < 42; i++) {
      const x = new Date(start);
      x.setUTCDate(start.getUTCDate() + i);
      ut.push(x.toISOString().slice(0, 10));
      if (i % 7 === 6 && x.getUTCMonth() !== manad - 1 && i > 27) break;
    }
    return ut;
  }, [ar, manad]);

  const ladda = useCallback(() => {
    setFel('');
    fetch(`/api/admin/kalender?fran=${dagar[0]}&tom=${dagar[dagar.length - 1]}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setFel(d.error) : setData(d)))
      .catch(() => setFel('Kunde inte hämta kalendern'));
  }, [dagar]);

  useEffect(() => { ladda(); }, [ladda]);
  useEffect(() => {
    fetch('/api/admin/people').then((r) => r.json()).then((d) => setPersoner(d.people ?? [])).catch(() => {});
  }, []);

  const bläddra = (steg: number) => {
    const m = manad + steg;
    setAr(ar + Math.floor((m - 1) / 12));
    setManad(((m - 1 + 12) % 12) + 1);
  };

  const perDag = useMemo(() => {
    const map = new Map<string, { handelser: Kalenderhandelse[]; arenden: Arende[]; moten: AdminMote[] }>();
    const fa = (d: string) => {
      if (!map.has(d)) map.set(d, { handelser: [], arenden: [], moten: [] });
      return map.get(d)!;
    };
    for (const h of data?.handelser ?? []) fa(h.datum).handelser.push(h);
    for (const a of data?.arenden ?? []) if (a.datum) fa(a.datum).arenden.push(a);
    for (const m of data?.moten ?? []) fa(m.datum).moten.push(m);
    return map;
  }, [data]);

  const kortFor = (h: Kalenderhandelse) => (h.grupp ? data?.kundkort[`${h.datum}|${h.grupp}`] ?? [] : []);

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-2xl font-bold text-slate-900 mr-4">Kalender</h1>
          <button onClick={() => bläddra(-1)} className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600">‹</button>
          <span className="text-lg font-semibold text-slate-800 w-44 text-center">{MANADER[manad - 1]} {ar}</span>
          <button onClick={() => bläddra(1)} className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600">›</button>
          <button
            onClick={() => { setAr(Number(nu.slice(0, 4))); setManad(Number(nu.slice(5, 7))); setVald(nu); }}
            className="ml-2 px-3 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm text-slate-600"
          >
            Idag
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
          {([['deadline', 'Deadline'], ['utskick', 'Utskick (planerat)'], ['info', 'Info'], ['arende', 'Ärende'], ['mote', 'Möte']] as const).map(([k, t]) => (
            <span key={k} className={`px-2 py-0.5 rounded border ${FARG[k]}`}>{t}</span>
          ))}
        </div>

        {fel && <p className="text-red-600 text-sm mb-3">{fel}</p>}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {VECKODAGAR.map((v) => <div key={v} className="px-2 py-1.5 text-[11px] font-semibold text-slate-500 uppercase">{v}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {dagar.map((dag, i) => {
              const iManaden = Number(dag.slice(5, 7)) === manad;
              const info = perDag.get(dag);
              const chips: { text: string; farg: string }[] = [
                ...(info?.handelser ?? []).map((h) => {
                  const kort = kortFor(h);
                  const klara = kort.filter((k) => k.perioder[0].inlamning).length;
                  const allaKlara = h.typ === 'deadline' && kort.length > 0 && klara === kort.length;
                  return {
                    text: h.typ === 'deadline' && kort.length ? `${klara}/${kort.length} · ${h.titel}` : h.titel,
                    farg: allaKlara ? FARG.klar : FARG[h.typ],
                  };
                }),
                ...(info?.moten ?? []).map((m) => ({ text: `${m.tid ?? ''} ${m.namn ?? 'Möte'}`.trim(), farg: FARG.mote })),
                ...(info?.arenden ?? []).map((a) => ({ text: a.titel, farg: FARG.arende })),
              ];
              return (
                <button
                  key={dag}
                  onClick={() => setVald(dag)}
                  className={`min-h-[104px] text-left p-1.5 border-slate-100 transition ${i % 7 !== 6 ? 'border-r' : ''} border-b
                    ${vald === dag ? 'bg-blue-50/70 ring-2 ring-inset ring-blue-400' : 'hover:bg-slate-50'} ${iManaden ? '' : 'bg-slate-50/60'}`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-1 ${
                    dag === nu ? 'bg-blue-600 text-white font-semibold' : iManaden ? 'text-slate-700' : 'text-slate-400'}`}>
                    {Number(dag.slice(8))}
                  </span>
                  <span className="block space-y-0.5">
                    {chips.slice(0, 3).map((c, j) => (
                      <span key={j} className={`block line-clamp-2 break-words text-[10.5px] leading-tight px-1.5 py-0.5 rounded border ${c.farg}`}>{c.text}</span>
                    ))}
                    {chips.length > 3 && <span className="block text-[10.5px] text-slate-500 px-1">+{chips.length - 3} till</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="w-full xl:w-[420px] shrink-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
        <Dagpanel
          key={vald}
          dag={vald}
          info={perDag.get(vald) ?? { handelser: [], arenden: [], moten: [] }}
          kortFor={kortFor}
          personer={personer}
          laddar={!data}
          onAndrat={ladda}
        />
      </aside>
    </div>
  );
}

function Dagpanel({ dag, info, kortFor, personer, laddar, onAndrat }: {
  dag: string;
  info: { handelser: Kalenderhandelse[]; arenden: Arende[]; moten: AdminMote[] };
  kortFor: (h: Kalenderhandelse) => InlamningKund[];
  personer: Person[];
  laddar: boolean;
  onAndrat: () => void;
}) {
  const [ny, setNy] = useState<'arende' | 'mote' | null>(null);
  const deadlines = info.handelser.filter((h) => h.typ === 'deadline');
  const utskick = info.handelser.filter((h) => h.typ === 'utskick');
  const infos = info.handelser.filter((h) => h.typ === 'info');
  const tomt = !info.handelser.length && !info.arenden.length && !info.moten.length;
  const rubrik = 'text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h2 className="text-lg font-bold text-slate-900 first-letter:uppercase">{LANG.format(new Date(`${dag}T00:00:00Z`))}</h2>
      <div className="flex gap-2 mt-3 mb-4">
        <button onClick={() => setNy(ny === 'arende' ? null : 'arende')}
          className={`px-3 py-1.5 text-xs rounded-lg border transition ${ny === 'arende' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
          + Ärende
        </button>
        <button onClick={() => setNy(ny === 'mote' ? null : 'mote')}
          className={`px-3 py-1.5 text-xs rounded-lg border transition ${ny === 'mote' ? 'bg-sky-50 border-sky-300 text-sky-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
          + Boka möte
        </button>
      </div>

      {ny === 'arende' && <NyttArende dag={dag} personer={personer} onKlar={() => { setNy(null); onAndrat(); }} />}
      {ny === 'mote' && <NyttMote dag={dag} personer={personer} onKlar={() => { setNy(null); onAndrat(); }} />}

      {laddar && <p className="text-slate-500 text-sm">Hämtar…</p>}
      {!laddar && tomt && !ny && <p className="text-slate-500 text-sm">Inget den här dagen.</p>}

      {deadlines.map((h) => {
        const kort = kortFor(h);
        return (
          <section key={h.titel} className="mb-5">
            <h3 className="text-sm font-semibold text-red-700">{h.titel}</h3>
            {h.beskrivning && <p className="text-xs text-slate-500 mb-2">{h.beskrivning}</p>}
            {kort.length > 0 && (
              <ul className="space-y-1.5">
                {kort.map((k) => <Kundkort key={k.profileId} kund={k} />)}
              </ul>
            )}
            {h.grupp && kort.length === 0 && <p className="text-xs text-slate-400">Inga kunder med den här perioden.</p>}
          </section>
        );
      })}

      {info.moten.length > 0 && (
        <section className="mb-5">
          <h3 className={rubrik}>Möten</h3>
          <ul className="space-y-1.5">
            {info.moten.map((m) => (
              <li key={m.id} className={`rounded-lg border px-3 py-2 ${FARG.mote}`}>
                <p className="text-sm font-medium">
                  <span className="tabular-nums mr-2">{m.tid}</span>
                  {m.email ? <Link href={`/admin/person/${encodeURIComponent(m.email)}`} className="hover:underline">{m.namn}</Link> : m.namn}
                </p>
                {m.meddelande && <p className="text-xs opacity-80 mt-0.5">{m.meddelande}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {info.arenden.length > 0 && (
        <section className="mb-5">
          <h3 className={rubrik}>Ärenden</h3>
          <ul className="space-y-1.5">
            {info.arenden.map((a) => (
              <li key={a.id} className={`rounded-lg border px-3 py-2 ${FARG.arende}`}>
                <p className="text-sm font-medium">{a.titel}</p>
                {a.personKey && (
                  <Link href={`/admin/person/${encodeURIComponent(a.personKey)}`} className="text-xs hover:underline">
                    {a.personNamn || a.personKey}
                  </Link>
                )}
                {a.beskrivning && <p className="text-xs opacity-80 mt-0.5">{a.beskrivning}</p>}
              </li>
            ))}
          </ul>
          <Link href="/admin/arenden" className="text-xs text-blue-700 hover:underline mt-1 inline-block">Alla ärenden →</Link>
        </section>
      )}

      {utskick.length > 0 && (
        <section className="mb-5">
          <h3 className={rubrik}>Planerade utskick</h3>
          <ul className="space-y-1.5">
            {utskick.map((h) => (
              <li key={h.titel} className={`rounded-lg border px-3 py-2 ${FARG.utskick}`}>
                <p className="text-sm font-medium">{h.titel}</p>
                {h.beskrivning && <p className="text-xs opacity-80 mt-0.5">{h.beskrivning}</p>}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400 mt-1">Skickas inte automatiskt än.</p>
        </section>
      )}

      {infos.map((h) => (
        <section key={h.titel} className={`rounded-lg border px-3 py-2 mb-3 ${FARG.info}`}>
          <p className="text-sm font-medium">{h.titel}</p>
          {h.beskrivning && <p className="text-xs opacity-80 mt-0.5">{h.beskrivning}</p>}
        </section>
      ))}
    </div>
  );
}

function Kundkort({ kund }: { kund: InlamningKund }) {
  const p = kund.perioder[0];
  const harBokforing = (p.antalVerifikationer ?? 0) > 0 || (p.antalTransaktioner ?? 0) > 0;
  const nyckel = kund.email ?? kund.profileId;
  return (
    <li className={`rounded-lg border px-3 py-2 ${p.inlamning ? 'border-emerald-200 bg-emerald-50/60' : p.forsenad ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2">
        <Link href={`/admin/person/${encodeURIComponent(nyckel)}`} className="text-sm font-medium text-slate-900 hover:text-blue-700 hover:underline truncate mr-auto">
          {kund.namn}
        </Link>
        <span className="text-[11px] text-slate-500 shrink-0">{p.label}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px]">
        {harBokforing
          ? <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Underlag finns · {p.antalVerifikationer ?? 0} ver. · {p.antalTransaktioner ?? 0} trans.
          </span>
          : <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Saknar underlag</span>}
        {p.inlamning
          ? <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">Inlämnad ✓</span>
          : <Link href="/admin/inlamning" className="px-1.5 py-0.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50">Ej inlämnad · lämna in →</Link>}
      </div>
      {p.flaggor.filter((f) => f !== 'Ingen bokföring i perioden').length > 0 && (
        <p className="text-[11px] text-red-600 mt-1">{p.flaggor.filter((f) => f !== 'Ingen bokföring i perioden').join(' · ')}</p>
      )}
    </li>
  );
}

const input = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500';

function NyttArende({ dag, personer, onKlar }: { dag: string; personer: Person[]; onKlar: () => void }) {
  const [titel, setTitel] = useState('');
  const [person, setPerson] = useState<ValdPerson | null>(null);
  const [beskrivning, setBeskrivning] = useState('');
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(false);

  return (
    <form
      className="space-y-2 mb-5 p-3 rounded-lg bg-amber-50/50 border border-amber-200"
      onSubmit={async (e) => {
        e.preventDefault();
        setSparar(true);
        const res = await fetch('/api/admin/arenden', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titel, beskrivning, datum: dag, personKey: person?.personKey, personNamn: person?.personNamn }),
        }).catch(() => null);
        setSparar(false);
        if (!res?.ok) { setFel((await res?.json().catch(() => null))?.error || 'Kunde inte spara'); return; }
        onKlar();
      }}
    >
      <input autoFocus value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Vad ska göras?" className={input} />
      <PersonValjare personer={personer} valt={person} onVal={setPerson} />
      <textarea value={beskrivning} onChange={(e) => setBeskrivning(e.target.value)} placeholder="Anteckning (valfritt)" rows={2} className={input} />
      {fel && <p className="text-xs text-red-600">{fel}</p>}
      <button type="submit" disabled={sparar || !titel.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        {sparar ? 'Sparar…' : 'Spara ärende'}
      </button>
    </form>
  );
}

function NyttMote({ dag, personer, onKlar }: { dag: string; personer: Person[]; onKlar: () => void }) {
  const [person, setPerson] = useState<ValdPerson | null>(null);
  const [tid, setTid] = useState('10:00');
  const [meddelande, setMeddelande] = useState('');
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(false);

  const vald = person ? personer.find((p) => p.email === person.personKey || p.phone === person.personKey || p.key === person.personKey) : null;

  return (
    <form
      className="space-y-2 mb-5 p-3 rounded-lg bg-sky-50/50 border border-sky-200"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!vald?.email) { setFel('Välj en kund som har mejladress'); return; }
        setSparar(true);
        const res = await fetch('/api/admin/kalender', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mote', namn: vald.name || vald.company || vald.email, email: vald.email,
            telefon: vald.phone, datum: dag, tid, meddelande,
          }),
        }).catch(() => null);
        setSparar(false);
        if (!res?.ok) { setFel((await res?.json().catch(() => null))?.error || 'Kunde inte boka'); return; }
        onKlar();
      }}
    >
      <PersonValjare personer={personer} valt={person} onVal={setPerson} />
      <input type="time" value={tid} onChange={(e) => setTid(e.target.value)} className={`${input} w-32`} />
      <textarea value={meddelande} onChange={(e) => setMeddelande(e.target.value)} placeholder="Vad gäller mötet? (valfritt)" rows={2} className={input} />
      {vald?.phone && <p className="text-[11px] text-slate-500">Kunden får en SMS-påminnelse samma dag, som vid vanliga bokningar.</p>}
      {fel && <p className="text-xs text-red-600">{fel}</p>}
      <button type="submit" disabled={sparar || !person} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        {sparar ? 'Bokar…' : 'Boka möte'}
      </button>
    </form>
  );
}
