'use client';

import { useCallback, useEffect, useState } from 'react';
import { MomsFil } from './_momsfil';
import { NeBilaga } from './_ne';
import type { AdminVerifikation, BokslutData, InlamningKund, InlamningPeriod, Person } from '@/lib/admin-types';
import type { DeklTyp } from '@/lib/deadlines';

/**
 * Inlämning i kundvyn: kundens perioder med kommande deadline, och filen som
 * ska till Skatteverket för den valda. "Markera som inlämnad" gör perioden grön.
 *
 * Låg tidigare som en egen sida med alla kunder i en lista. Kalendern och
 * översikten visar vilka som är kvar; härifrån lämnar man in.
 */

const DAG = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const datum = (d: string) => DAG.format(new Date(`${d}T00:00:00Z`));
const tid = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

export function InlamningFlik({ profileId }: { profileId: string | null }) {
  const [typ, setTyp] = useState<DeklTyp>('moms');
  const [kund, setKund] = useState<InlamningKund | null | undefined>(undefined);
  const [saknarMomsperiod, setSaknarMomsperiod] = useState(false);
  const [fel, setFel] = useState('');
  const [valt, setValt] = useState<string | null>(null);

  const ladda = useCallback(() => {
    if (!profileId) return;
    setKund(undefined);
    setFel('');
    fetch(`/api/admin/inlamning?typ=${typ}&profileId=${encodeURIComponent(profileId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setFel(d.error); return; }
        const k: InlamningKund | null = d.kunder?.[0] ?? null;
        setKund(k);
        setSaknarMomsperiod((d.saknarMomsperiod ?? []).length > 0);
        // Första perioden som inte är inlämnad öppnas direkt
        setValt((k?.perioder.find((p) => !p.inlamning) ?? k?.perioder[0])?.period ?? null);
      })
      .catch(() => setFel('Kunde inte hämta inlämningen'));
  }, [typ, profileId]);

  useEffect(() => { ladda(); }, [ladda]);

  if (!profileId) return <p className="text-slate-500 text-sm">Personen har inget konto än, så det finns inget att lämna in.</p>;

  const vald = kund?.perioder.find((p) => p.period === valt) ?? null;

  /** Uppdaterar perioden lokalt, så att den blir grön direkt utan att läsas om. */
  const andra = (period: string, inlamning: InlamningPeriod['inlamning']) => {
    setKund((k) => k && { ...k, perioder: k.perioder.map((p) => (p.period === period ? { ...p, inlamning } : p)) });
  };

  const flik = (t: DeklTyp, text: string) => (
    <button
      onClick={() => setTyp(t)}
      className={`px-3 py-1.5 text-xs rounded-lg transition ${typ === t ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:text-slate-900 border border-transparent'}`}
    >
      {text}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {flik('moms', 'Momsdeklaration')}
          {flik('ne', 'NE-bilaga')}
        </div>
        {kund?.perioder.map((p) => {
          const klar = !!p.inlamning;
          return (
            <button
              key={p.period}
              onClick={() => setValt(p.period)}
              className={`px-3 py-1.5 rounded-lg border text-xs transition ${
                valt === p.period ? 'border-blue-400 bg-white text-slate-900'
                  : klar ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                    : p.forsenad ? 'border-red-500/40 bg-red-500/10 text-red-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.label}{klar ? ' ✓' : p.forsenad ? ' · försenad' : ''}
            </button>
          );
        })}
      </div>

      {fel && <p className="text-red-600 text-sm">{fel}</p>}
      {kund === undefined && !fel && <p className="text-slate-500 text-sm">Hämtar…</p>}
      {kund === null && !fel && (
        <p className="text-slate-500 text-sm">
          {typ === 'moms' && saknarMomsperiod
            ? 'Kunden saknar momsperiod. Fyll i den under Kundkontext så dyker perioderna upp här.'
            : typ === 'ne'
              ? 'NE-bilagan för inkomståret lämnas efter årsskiftet och dyker upp här i januari.'
              : 'Ingen avslutad momsperiod med kommande deadline.'}
        </p>
      )}

      {kund && vald && (
        <InlamningDetalj key={`${typ}|${vald.period}`} kund={kund} period={vald} typ={typ} onAndrad={(i) => andra(vald.period, i)} />
      )}
    </div>
  );
}

function InlamningDetalj({ kund, period, typ, onAndrad }: {
  kund: InlamningKund;
  period: InlamningPeriod;
  typ: DeklTyp;
  onAndrad: (inlamning: InlamningPeriod['inlamning']) => void;
}) {
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
        <p className="mr-auto text-slate-600 text-sm">
          {typ === 'moms' ? 'Moms' : 'NE-bilaga'} {period.label} · deadline {datum(period.deadline)}
          {period.forsenad && !inl && <span className="text-red-600"> · försenad</span>}
        </p>

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
