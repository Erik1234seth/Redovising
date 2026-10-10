'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MomsFil } from '../_momsfil';
import { NeBilaga } from '../_ne';
import type { AdminVerifikation, BokslutData, InlamningKund, InlamningPeriod, Person } from '@/lib/admin-types';
import type { DeklTyp } from '@/lib/deadlines';

/**
 * Inlämning: allt som ska lämnas till Skatteverket just nu, på en sida.
 *
 * Listan till vänster är kunderna med en deadline i aktuell period, grupperade
 * på deadline. Klick på en kund visar filen till höger — utan att lämna
 * sidan, så att man kan beta av kund för kund. "Inlämnad" gör raden grön.
 */

const DAG = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const datum = (d: string) => DAG.format(new Date(`${d}T00:00:00Z`));
const tid = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

interface Rad { kund: InlamningKund; period: InlamningPeriod }
const radId = (r: Rad) => `${r.kund.profileId}|${r.period.period}`;

export default function InlamningPage() {
  const [typ, setTyp] = useState<DeklTyp>('moms');
  const [kunder, setKunder] = useState<InlamningKund[] | null>(null);
  const [saknar, setSaknar] = useState<{ profileId: string; namn: string; email: string | null }[]>([]);
  const [fel, setFel] = useState('');
  const [valt, setValt] = useState<string | null>(null);

  const ladda = useCallback(() => {
    setKunder(null);
    setFel('');
    fetch(`/api/admin/inlamning?typ=${typ}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setFel(d.error); return; }
        setKunder(d.kunder);
        setSaknar(d.saknarMomsperiod ?? []);
      })
      .catch(() => setFel('Kunde inte hämta listan'));
  }, [typ]);

  useEffect(() => { ladda(); setValt(null); }, [ladda]);

  /** En rad per kund och period, grupperade på deadline. Inlämnade sist i varje grupp. */
  const grupper = useMemo(() => {
    const rader: Rad[] = (kunder ?? []).flatMap((kund) => kund.perioder.map((period) => ({ kund, period })));
    const per = new Map<string, Rad[]>();
    for (const r of rader) per.set(r.period.deadline, [...(per.get(r.period.deadline) ?? []), r]);
    return [...per.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([deadline, lista]) => ({
        deadline,
        rader: lista.sort((a, b) => Number(!!a.period.inlamning) - Number(!!b.period.inlamning) || a.kund.namn.localeCompare(b.kund.namn, 'sv')),
      }));
  }, [kunder]);

  const vald = grupper.flatMap((g) => g.rader).find((r) => radId(r) === valt) ?? null;

  /** Uppdaterar en period lokalt, så att listan blir grön direkt utan att läsas om. */
  const andra = (r: Rad, inlamning: InlamningPeriod['inlamning']) => {
    setKunder((ks) => ks?.map((k) => k.profileId !== r.kund.profileId ? k : {
      ...k,
      perioder: k.perioder.map((p) => p.period === r.period.period ? { ...p, inlamning } : p),
    }) ?? null);
  };

  const flik = (t: DeklTyp, text: string) => (
    <button
      onClick={() => setTyp(t)}
      className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition ${typ === t ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:text-slate-900 border border-transparent'}`}
    >
      {text}
    </button>
  );

  const antalKvar = grupper.flatMap((g) => g.rader).filter((r) => !r.period.inlamning).length;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <h1 className="text-xl font-bold text-slate-900 mb-3">Inlämning</h1>
        <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 mb-4">
          {flik('moms', 'Momsdeklaration')}
          {flik('ne', 'NE-bilaga')}
        </div>

        {fel && <p className="text-red-600 text-sm">{fel}</p>}
        {!kunder && !fel && <p className="text-slate-500 text-sm">Hämtar…</p>}

        {kunder && (
          <p className="text-slate-500 text-xs mb-3">
            {antalKvar === 0 ? 'Inget kvar att lämna in just nu.' : `${antalKvar} kvar att lämna in`}
          </p>
        )}

        {kunder && grupper.length === 0 && (
          <p className="text-slate-500 text-xs">
            {typ === 'ne'
              ? 'NE-bilagan för inkomståret lämnas efter årsskiftet. Kunderna dyker upp här i januari.'
              : 'Ingen avslutad momsperiod med kommande deadline.'}
          </p>
        )}

        {grupper.map((g) => (
          <div key={g.deadline} className="mb-4">
            <h2 className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Deadline {datum(g.deadline)}
            </h2>
            <ul className="space-y-1">
              {g.rader.map((r) => {
                const id = radId(r);
                const klar = !!r.period.inlamning;
                return (
                  <li key={id}>
                    <button
                      onClick={() => setValt(id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                        valt === id ? 'border-blue-400 bg-slate-50'
                          : klar ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                            : r.period.forsenad ? 'border-red-500/40 bg-red-500/10 hover:bg-red-500/15'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`text-sm truncate mr-auto ${klar ? 'text-emerald-700' : 'text-slate-900'}`}>{r.kund.namn}</span>
                        {klar && <span className="text-emerald-600 text-xs">✓</span>}
                        {!klar && r.period.flaggor.length > 0 && (
                          <span title={r.period.flaggor.join('\n')} className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        )}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {r.period.label}
                        {r.period.forsenad && !klar && <span className="text-red-600"> · försenad</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {typ === 'moms' && saknar.length > 0 && (
          <div className="mt-6 text-xs text-slate-500">
            <p className="mb-1">Saknar momsperiod och syns därför inte:</p>
            {saknar.map((s) => (
              <Link key={s.profileId} href={`/admin/person/${encodeURIComponent(s.email ?? s.profileId)}`} className="block text-slate-600 hover:text-slate-900">
                {s.namn}
              </Link>
            ))}
          </div>
        )}
      </aside>

      <section className="flex-1 min-w-0 w-full">
        {vald
          ? <Detalj key={radId(vald)} rad={vald} typ={typ} onAndrad={(i) => andra(vald, i)} />
          : <p className="text-slate-500 text-sm mt-12 text-center">Välj en kund till vänster.</p>}
      </section>
    </div>
  );
}

function Detalj({ rad, typ, onAndrad }: {
  rad: Rad;
  typ: DeklTyp;
  onAndrad: (inlamning: InlamningPeriod['inlamning']) => void;
}) {
  const { kund, period } = rad;
  const nyckel = kund.email ?? kund.profileId;
  const [person, setPerson] = useState<Person | null>(null);
  const [bokslut, setBokslut] = useState<BokslutData | null>(null);
  const [verifikationer, setVerifikationer] = useState<AdminVerifikation[] | null>(null);
  const [fel, setFel] = useState('');
  const [upptagen, setUpptagen] = useState(false);

  useEffect(() => {
    const k = encodeURIComponent(nyckel);
    fetch(`/api/admin/people?key=${k}`).then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error);
      else { setPerson(d.person); setBokslut(d.bokslut ?? null); }
    }).catch(() => setFel('Kunde inte hämta kunden'));
    fetch(`/api/admin/people?key=${k}&view=verifikationer`).then((r) => r.json()).then((d) => {
      if (d.error) setFel(d.error);
      else setVerifikationer(d.verifikationer);
    }).catch(() => setFel('Kunde inte hämta verifikationerna'));
  }, [nyckel]);

  const markera = async () => {
    setUpptagen(true);
    const res = await fetch('/api/admin/inlamning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: kund.profileId, typ, period: period.period }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setUpptagen(false);
    if (!res?.ok) { setFel(d?.error || 'Kunde inte markera'); return; }
    onAndrad({ id: d.id, at: d.at, kvittensNamn: null });
  };

  const angra = async () => {
    if (!period.inlamning) return;
    setUpptagen(true);
    const res = await fetch(`/api/admin/inlamning?id=${period.inlamning.id}`, { method: 'DELETE' }).catch(() => null);
    setUpptagen(false);
    if (!res?.ok) { setFel('Kunde inte ångra'); return; }
    onAndrad(null);
  };

  const laddaUpp = async (fil: File) => {
    const inl = period.inlamning;
    if (!inl) return;
    setUpptagen(true);
    setFel('');
    try {
      const post = (body: object) => fetch('/api/admin/inlamning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
      const { path, signedUrl } = await post({ action: 'prepare', id: inl.id, fileName: fil.name });
      const put = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': fil.type || 'application/octet-stream' }, body: fil });
      if (!put.ok) throw new Error('Filen kom inte fram till lagringen');
      await post({ action: 'confirm', id: inl.id, fileName: fil.name, path });
      onAndrad({ ...inl, kvittensNamn: fil.name });
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Uppladdningen misslyckades');
    } finally {
      setUpptagen(false);
    }
  };

  const inl = period.inlamning;

  return (
    <div>
      <div className="flex items-start gap-4 flex-wrap mb-4">
        <div className="mr-auto">
          <h2 className="text-lg font-bold">
            <Link href={`/admin/person/${encodeURIComponent(nyckel)}`} title="Öppna personkortet"
              className="text-slate-900 hover:text-blue-700 hover:underline underline-offset-4">
              {kund.namn}
            </Link>
          </h2>
          <p className="text-slate-600 text-sm">
            {kund.foretag && kund.foretag !== kund.namn && <>{kund.foretag} · </>}
            {typ === 'moms' ? 'Moms' : 'NE-bilaga'} {period.label} · deadline {datum(period.deadline)}
            {period.forsenad && !inl && <span className="text-red-600"> · försenad</span>}
          </p>
        </div>

        {inl ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm">
            <p className="text-emerald-700 font-semibold">✓ Inlämnad {tid(inl.at)}</p>
            <div className="flex items-center gap-3 mt-1 text-xs">
              {inl.kvittensNamn
                ? <a href={`/api/admin/inlamning?kvittens=${inl.id}`} className="text-emerald-800 underline truncate max-w-48">{inl.kvittensNamn}</a>
                : <span className="text-slate-500">Ingen kvittens</span>}
              <label className={`text-blue-700 hover:text-blue-800 cursor-pointer ${upptagen ? 'opacity-50 pointer-events-none' : ''}`}>
                {inl.kvittensNamn ? 'Byt' : 'Ladda upp kvittens'}
                <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) laddaUpp(f); e.target.value = ''; }} />
              </label>
              <button onClick={angra} disabled={upptagen} className="text-slate-500 hover:text-red-600">Ångra</button>
            </div>
          </div>
        ) : (
          <button
            onClick={markera}
            disabled={upptagen}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
          >
            Markera som inlämnad
          </button>
        )}
      </div>

      {period.flaggor.length > 0 && (
        <ul className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-sm text-red-700 space-y-0.5">
          {period.flaggor.map((f) => <li key={f}>● {f}</li>)}
        </ul>
      )}

      {fel && <p className="text-red-600 text-sm mb-4">{fel}</p>}

      {!verifikationer || !person ? (
        !fel && <p className="text-slate-500 text-sm">Hämtar bokföringen…</p>
      ) : typ === 'moms' ? (
        <MomsFil
          verifikationer={verifikationer}
          orgNr={bokslut?.orgNr ?? null}
          momsPeriod={kund.momsPeriod}
          lastPeriod={{ typ: period.periodtyp, ar: period.ar, nr: period.nr }}
        />
      ) : (
        <NeBilaga
          verifikationer={verifikationer}
          person={person}
          data={bokslut}
          onData={setBokslut}
          onError={setFel}
          fastAr={period.ar}
        />
      )}
    </div>
  );
}
