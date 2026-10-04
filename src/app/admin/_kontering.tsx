'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { AdminKontering, AdminKonteringRad, Betalsatt } from '@/lib/admin-types';
import { kr } from './_verifikationer';

/**
 * Konteringen av kundens transaktioner enligt K1.
 *
 * Båda modellerna (gpt-5.5 och Claude Opus 5.5) konterar varje transaktion.
 * När båda är gröna och har valt samma konto och momssats bokförs den direkt;
 * annars blir det förslag, och här väljer Erik ett av dem eller ett eget konto.
 *
 * En transaktion konteras per anrop — två modeller med två pass var tar upp
 * till ett par minuter, och ett anrop får ta högst fem. Fliken kör några
 * samtidigt och visar varje rad så fort den är klar.
 */

const SAMTIDIGA = 3;
const PAGE = 100;

type Status = 'okonterad' | 'forslag' | 'bokford';
type Filter = Status | 'alla';

const MODELLNAMN: Record<string, string> = {
  'gpt-5.5': 'GPT-5.5',
  'claude-opus-5-5': 'Claude Opus 5.5',
};

const OMDOME: Record<AdminKontering['omdome'], { prick: string; text: string }> = {
  gron: { prick: 'bg-emerald-400', text: 'Grön' },
  gul: { prick: 'bg-amber-400', text: 'Gul' },
  rod: { prick: 'bg-red-500', text: 'Röd' },
};

function status(r: AdminKonteringRad): Status {
  if (r.verifikation) return 'bokford';
  return r.konteringar.length ? 'forslag' : 'okonterad';
}

function matches(r: AdminKonteringRad, q: string): boolean {
  if (!q) return true;
  const hay = [
    r.datum, r.beskrivning, r.motpart, r.fileName ?? '', String(r.belopp),
    ...r.konteringar.map((k) => `${k.konto} ${k.kontonamn}`),
  ].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

export function KonteringsVy({ userId, betalsatt }: { userId: string; betalsatt: Betalsatt | null }) {
  const [rader, setRader] = useState<AdminKonteringRad[] | null>(null);
  const [laddfel, setLaddfel] = useState('');
  const [filter, setFilter] = useState<Filter>('alla');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [valda, setValda] = useState<string[]>([]);
  const [oppen, setOppen] = useState<string | null>(null);
  // Rader som konteras just nu, och fel per rad från senaste körningen
  const [pagar, setPagar] = useState<Set<string>>(new Set());
  const [radfel, setRadfel] = useState<Record<string, string>>({});
  const [ko, setKo] = useState<{ klara: number; totalt: number } | null>(null);
  const avbryt = useRef(false);

  useEffect(() => {
    fetch(`/api/admin/kontering?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => (data.error ? setLaddfel(data.error) : setRader(data.rader ?? [])))
      .catch(() => setLaddfel('Kunde inte hämta transaktionerna'));
  }, [userId]);

  const ersatt = (rad: AdminKonteringRad | null, id: string) =>
    setRader((list) => list && (rad ? list.map((r) => (r.id === id ? rad : r)) : list.filter((r) => r.id !== id)));

  const antal = useMemo(() => {
    const a = { okonterad: 0, forslag: 0, bokford: 0 };
    for (const r of rader ?? []) a[status(r)]++;
    return a;
  }, [rader]);

  const filtered = useMemo(
    () => (rader ?? []).filter((r) => (filter === 'alla' || status(r) === filter) && matches(r, query.trim())),
    [rader, filter, query],
  );
  useEffect(() => setShown(PAGE), [filter, query]);
  // Bokförda rader går inte att kontera om utan att ångra först
  const valbara = useMemo(() => filtered.filter((r) => status(r) !== 'bokford'), [filtered]);
  useEffect(() => {
    const kvar = new Set(valbara.map((r) => r.id));
    setValda((list) => (list.every((id) => kvar.has(id)) ? list : list.filter((id) => kvar.has(id))));
  }, [valbara]);

  /** Konterar de markerade raderna, några i taget, och visar varje rad så fort den är klar. */
  const kontera = async () => {
    if (ko || valda.length === 0) return;
    const lista = [...valda];
    avbryt.current = false;
    setValda([]);
    setRadfel({});
    setKo({ klara: 0, totalt: lista.length });

    let nasta = 0;
    const arbetare = async () => {
      while (nasta < lista.length && !avbryt.current) {
        const id = lista[nasta++];
        setPagar((s) => new Set(s).add(id));
        try {
          const res = await fetch('/api/admin/kontering', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, transaktionId: id }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) setRadfel((f) => ({ ...f, [id]: data.error || `Fel ${res.status}` }));
          else ersatt(data.rad, id);
        } catch {
          setRadfel((f) => ({ ...f, [id]: 'Tappade kontakten med servern' }));
        }
        setPagar((s) => { const n = new Set(s); n.delete(id); return n; });
        setKo((k) => k && { ...k, klara: k.klara + 1 });
      }
    };
    await Promise.all(Array.from({ length: Math.min(SAMTIDIGA, lista.length) }, arbetare));
    setKo(null);
  };

  if (!betalsatt) {
    return (
      <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-5 text-sm text-gold-300">
        Välj först om kunden betalar via företagskonto eller privatkonto under <strong>Kundkontext</strong>.
        Det avgör vilket konto pengarna bokförs mot.
      </div>
    );
  }
  if (laddfel) return <p className="text-red-400 text-sm">{laddfel}</p>;
  if (!rader) return <p className="text-warm-500 text-sm">Hämtar transaktionerna…</p>;
  if (rader.length === 0) {
    return (
      <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-12 text-warm-400 text-sm">
        Inga transaktioner att kontera. Läs av underlag under fliken Underlag först.
      </div>
    );
  }

  const allaValda = valbara.length > 0 && valda.length === valbara.length;
  const flikar: { id: Filter; label: string; n: number }[] = [
    { id: 'alla', label: 'Alla', n: rader.length },
    { id: 'okonterad', label: 'Okonterade', n: antal.okonterad },
    { id: 'forslag', label: 'Förslag', n: antal.forslag },
    { id: 'bokford', label: 'Bokförda', n: antal.bokford },
  ];

  return (
    <div className="space-y-5">
      <p className="text-warm-500 text-xs">
        Båda modellerna konterar varje rad enligt K1. Bokförs direkt när båda är gröna och överens om konto och
        moms — annars blir det förslag. Betalkonto:{' '}
        <span className="text-warm-300">
          {betalsatt === 'foretagskonto' ? '1930 Företagskonto' : betalsatt === 'privatkonto' ? '2017 Egna insättningar / 2013 Egna uttag' : 'väljs per rad'}
        </span>
        .
      </p>

      <div className="flex gap-2 flex-wrap items-center">
        {flikar.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              filter === f.id ? 'bg-gold-500/15 border-gold-500 text-gold-400' : 'border-navy-600 text-warm-400 hover:text-white'
            }`}
          >
            {f.label} <span className="tabular-nums opacity-70">{f.n.toLocaleString('sv-SE')}</span>
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök text, belopp eller konto"
          className="flex-1 min-w-[12rem] bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-warm-600 focus:outline-none focus:border-gold-500 transition"
        />
      </div>

      {(valda.length > 0 || ko) && (
        <div className="flex items-center gap-3 flex-wrap bg-navy-700/50 border border-navy-600 rounded-xl px-4 py-3">
          {ko ? (
            <>
              <span className="text-warm-200 text-sm">
                Konterar… {ko.klara.toLocaleString('sv-SE')} av {ko.totalt.toLocaleString('sv-SE')} klara
              </span>
              <button
                onClick={() => { avbryt.current = true; }}
                className="text-warm-500 hover:text-warm-300 text-xs transition ml-auto"
              >
                Stoppa efter pågående
              </button>
            </>
          ) : (
            <>
              <span className="text-warm-200 text-sm">
                {valda.length.toLocaleString('sv-SE')} {valda.length === 1 ? 'markerad' : 'markerade'}
              </span>
              <button
                onClick={kontera}
                className="px-3 py-1.5 bg-gold-500 hover:bg-gold-400 text-navy-900 font-bold rounded-lg text-xs transition"
              >
                Kontera {valda.length.toLocaleString('sv-SE')}
              </button>
              <span className="text-warm-600 text-xs">Tar runt en halv minut per rad, {SAMTIDIGA} åt gången.</span>
              <button onClick={() => setValda([])} className="text-warm-500 hover:text-warm-300 text-xs transition ml-auto">
                Avmarkera
              </button>
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-12 text-warm-400 text-sm">
          Ingen transaktion matchar filtret
        </div>
      ) : (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-warm-500 text-[11px] uppercase tracking-widest border-b border-navy-600">
                  <th className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allaValda}
                      disabled={!!ko || valbara.length === 0}
                      onChange={(e) => setValda(e.target.checked ? valbara.map((r) => r.id) : [])}
                      title={allaValda ? 'Avmarkera alla' : 'Markera alla som inte är bokförda'}
                      className="accent-gold-500 align-middle"
                    />
                  </th>
                  <th className="text-left font-semibold px-4 py-2.5">Datum</th>
                  <th className="text-left font-semibold px-4 py-2.5">Beskrivning</th>
                  <th className="text-left font-semibold px-4 py-2.5">Kontering</th>
                  <th className="text-right font-semibold px-4 py-2.5">Belopp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-600/60">
                {filtered.slice(0, shown).map((r) => {
                  const s = status(r);
                  const kor = pagar.has(r.id);
                  const open = oppen === r.id;
                  return (
                    <Rad
                      key={r.id}
                      rad={r}
                      status={s}
                      kor={kor}
                      fel={radfel[r.id]}
                      open={open}
                      vald={valda.includes(r.id)}
                      lasta={!!ko}
                      betalsatt={betalsatt}
                      userId={userId}
                      onToggle={() => setOppen(open ? null : r.id)}
                      onValj={(on) => setValda((l) => (on ? [...l, r.id] : l.filter((id) => id !== r.id)))}
                      onRad={(ny) => ersatt(ny, r.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > shown && (
            <button
              onClick={() => setShown((n) => n + PAGE)}
              className="w-full px-4 py-3 text-sm text-warm-400 hover:text-white border-t border-navy-600 transition"
            >
              Visa fler ({(filtered.length - shown).toLocaleString('sv-SE')} kvar)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Rad({
  rad: r, status: s, kor, fel, open, vald, lasta, betalsatt, userId, onToggle, onValj, onRad,
}: {
  rad: AdminKonteringRad;
  status: Status;
  kor: boolean;
  fel?: string;
  open: boolean;
  vald: boolean;
  lasta: boolean;
  betalsatt: Betalsatt;
  userId: string;
  onToggle: () => void;
  onValj: (on: boolean) => void;
  onRad: (rad: AdminKonteringRad | null) => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition ${open ? 'bg-navy-700/60' : vald ? 'bg-gold-500/5' : 'hover:bg-navy-700/40'}`}
      >
        <td className="px-4 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
          {s !== 'bokford' && (
            <input
              type="checkbox"
              checked={vald}
              disabled={lasta || kor}
              onChange={(e) => onValj(e.target.checked)}
              className="accent-gold-500 align-middle"
            />
          )}
        </td>
        <td className="px-4 py-2.5 text-warm-300 tabular-nums whitespace-nowrap align-top">
          {r.datum || <span className="text-gold-400/80">utan datum</span>}
        </td>
        <td className="px-4 py-2.5 align-top">
          <span className="text-warm-100">{r.beskrivning || '—'}</span>
          {r.motpart && r.motpart !== r.beskrivning && <span className="text-warm-500"> · {r.motpart}</span>}
          {r.kalla === 'bank' && <span className="block text-warm-600 text-[11px] mt-0.5">Bankrad</span>}
        </td>
        <td className="px-4 py-2.5 align-top whitespace-nowrap">
          <KonteringsStatus rad={r} status={s} kor={kor} fel={fel} />
        </td>
        <td className={`px-4 py-2.5 tabular-nums text-right whitespace-nowrap align-top font-medium ${
          r.riktning === 'in' ? 'text-emerald-300' : 'text-warm-200'
        }`}>
          {r.riktning === 'in' ? '+' : '−'}{kr.format(r.belopp)}
          {r.valuta !== 'SEK' && <span className="text-warm-600 text-xs"> {r.valuta}</span>}
          {r.moms ? <span className="block text-warm-600 text-[11px] font-normal">moms {kr.format(r.moms)}</span> : null}
        </td>
      </tr>
      {open && (
        <tr className="bg-navy-800/40">
          <td colSpan={5} className="px-4 py-4">
            <Detalj rad={r} status={s} betalsatt={betalsatt} userId={userId} onRad={onRad} />
          </td>
        </tr>
      )}
    </>
  );
}

function KonteringsStatus({ rad: r, status: s, kor, fel }: { rad: AdminKonteringRad; status: Status; kor: boolean; fel?: string }) {
  if (kor) return <span className="text-gold-400 text-xs">Konterar…</span>;
  if (fel) return <span className="text-red-400 text-xs whitespace-normal">{fel}</span>;
  if (s === 'bokford') {
    const huvud = r.verifikation!.rader[0];
    return (
      <span className="text-xs">
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold mr-2">Bokförd</span>
        <span className="text-warm-300 tabular-nums">{huvud?.konto}</span>
        <span className="text-warm-500"> {huvud?.kontonamn}</span>
      </span>
    );
  }
  if (s === 'forslag') {
    return (
      <span className="flex flex-col gap-0.5 text-xs">
        {r.konteringar.map((k) => (
          <span key={k.modell} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${OMDOME[k.omdome].prick}`} title={OMDOME[k.omdome].text} />
            <span className="text-warm-600 w-12">{k.modell.startsWith('gpt') ? 'GPT' : 'Claude'}</span>
            <span className="text-warm-200 tabular-nums">{k.konto ?? '—'}</span>
            <span className="text-warm-500 truncate max-w-[14rem]">{k.kontonamn}</span>
            {k.momssats ? <span className="text-warm-600">{k.momssats} %</span> : null}
          </span>
        ))}
      </span>
    );
  }
  return <span className="text-warm-600 text-xs">Okonterad</span>;
}

function Detalj({
  rad: r, status: s, betalsatt, userId, onRad,
}: {
  rad: AdminKonteringRad;
  status: Status;
  betalsatt: Betalsatt;
  userId: string;
  onRad: (rad: AdminKonteringRad | null) => void;
}) {
  const [arbetar, setArbetar] = useState(false);
  const [fel, setFel] = useState('');
  const forsta = r.konteringar[0];
  const [konto, setKonto] = useState(forsta?.konto ?? '');
  const [sats, setSats] = useState(String(forsta?.momssats ?? 0));
  const [motkonto, setMotkonto] = useState(r.riktning === 'ut' ? '2017' : '2013');

  const anropa = async (method: 'PUT' | 'DELETE', body?: object) => {
    setArbetar(true);
    setFel('');
    const res = await fetch(
      method === 'DELETE'
        ? `/api/admin/kontering?userId=${encodeURIComponent(userId)}&transaktionId=${r.id}`
        : '/api/admin/kontering',
      { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined },
    ).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setArbetar(false);
    if (!res?.ok) setFel(data?.error || 'Det gick inte');
    else onRad(data.rad);
  };

  const bokfor = (k: string, m: number | string) =>
    anropa('PUT', {
      userId,
      transaktionId: r.id,
      konto: k,
      momssats: Number(m) || 0,
      motkonto: betalsatt === 'bada' ? motkonto : undefined,
    });

  const detaljer = r.detaljer ? (
    <details>
      <summary className="text-warm-500 hover:text-warm-300 text-xs cursor-pointer">Detaljer från underlaget</summary>
      <p className="text-warm-400 text-xs whitespace-pre-wrap mt-1 max-w-3xl">{r.detaljer}</p>
    </details>
  ) : null;

  if (s === 'bokford') {
    const v = r.verifikation!;
    return (
      <div className="space-y-3">
        {detaljer}
        <table className="text-xs">
          <tbody>
            {v.rader.map((x, i) => (
              <tr key={i}>
                <td className="pr-3 text-warm-300 tabular-nums">{x.konto}</td>
                <td className="pr-6 text-warm-500">{x.kontonamn}</td>
                <td className="pr-3 text-right tabular-nums text-warm-200">{x.belopp > 0 ? kr.format(x.belopp) : ''}</td>
                <td className="text-right tabular-nums text-warm-200">{x.belopp < 0 ? kr.format(-x.belopp) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-3">
          <span className="text-warm-600 text-xs">
            {v.signatur === 'AI' ? 'Bokförd direkt — båda modellerna var överens.' : `Bokförd av ${v.signatur ?? 'okänd'}.`}
          </span>
          <button
            onClick={() => anropa('DELETE')}
            disabled={arbetar}
            className="px-3 py-1.5 text-xs text-red-400/80 hover:text-red-400 border border-red-500/30 rounded-lg transition disabled:opacity-50"
          >
            {arbetar ? 'Ångrar…' : 'Ångra bokföringen'}
          </button>
          {fel && <span className="text-red-400 text-xs">{fel}</span>}
        </div>
        {r.konteringar.length > 0 && (
          <div className="grid md:grid-cols-2 gap-3 pt-2">
            {r.konteringar.map((k) => <Forslag key={k.modell} k={k} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {detaljer}
      {r.konteringar.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-3">
          {r.konteringar.map((k) => (
            <Forslag
              key={k.modell}
              k={k}
              onBokfor={k.konto && k.omdome !== 'rod' ? () => bokfor(k.konto!, k.momssats ?? 0) : undefined}
              arbetar={arbetar}
            />
          ))}
        </div>
      ) : (
        <p className="text-warm-500 text-xs">Inte konterad än. Markera raden och tryck Kontera, eller välj konto själv nedan.</p>
      )}

      {/* Eget konto: när ingen av modellerna har rätt. Kontot prövas mot K1 på servern. */}
      <div className="flex items-end gap-2 flex-wrap pt-3 border-t border-navy-600/60">
        <label className="text-xs text-warm-500">
          Eget konto
          <input
            value={konto}
            onChange={(e) => setKonto(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="t.ex. 5400"
            className="block mt-1 w-24 bg-navy-800 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-white tabular-nums focus:outline-none focus:border-gold-500"
          />
        </label>
        <label className="text-xs text-warm-500">
          Moms
          <select
            value={sats}
            onChange={(e) => setSats(e.target.value)}
            className="block mt-1 bg-navy-800 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-gold-500"
          >
            {['25', '12', '6', '0'].map((m) => <option key={m} value={m}>{m} %</option>)}
          </select>
        </label>
        {betalsatt === 'bada' && (
          <label className="text-xs text-warm-500">
            Betalt via
            <select
              value={motkonto}
              onChange={(e) => setMotkonto(e.target.value)}
              className="block mt-1 bg-navy-800 border border-navy-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-gold-500"
            >
              <option value="1930">1930 Företagskonto</option>
              <option value={r.riktning === 'ut' ? '2017' : '2013'}>
                {r.riktning === 'ut' ? '2017 Egna insättningar' : '2013 Egna uttag'} (privat)
              </option>
            </select>
          </label>
        )}
        <button
          onClick={() => bokfor(konto, sats)}
          disabled={arbetar || konto.length !== 4}
          className="px-3 py-1.5 bg-navy-600 hover:bg-navy-500 text-white font-semibold rounded-lg text-xs transition disabled:opacity-50"
        >
          {arbetar ? 'Bokför…' : 'Bokför'}
        </button>
        {fel && <span className="text-red-400 text-xs">{fel}</span>}
      </div>
    </div>
  );
}

function Forslag({ k, onBokfor, arbetar }: { k: AdminKontering; onBokfor?: () => void; arbetar?: boolean }) {
  const g = k.granskning;
  const byttFran = g?.forstaKonto && g.forstaKonto !== k.konto ? g.forstaKonto : null;
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-800/40 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${OMDOME[k.omdome].prick}`} />
        <span className="text-warm-400 text-xs font-semibold">{MODELLNAMN[k.modell] ?? k.modell}</span>
        {g?.svarade && !g.svarade.includes(k.modell) && (
          <span className="text-warm-600 text-[11px]">svarade: {g.svarade}</span>
        )}
      </div>
      <p className="text-warm-100 text-sm">
        <span className="tabular-nums font-semibold">{k.konto ?? '—'}</span> {k.kontonamn}
        <span className="text-warm-500"> · moms {k.momssats ?? 0} %</span>
        {byttFran && <span className="text-warm-600 text-xs"> (bytt från {byttFran} i granskningen)</span>}
      </p>
      <p className="text-warm-400 text-xs leading-relaxed">{k.motivering}</p>
      {g?.motivering && (
        <p className="text-warm-500 text-xs leading-relaxed">
          <span className="text-warm-400">Granskning:</span> {g.motivering}
        </p>
      )}
      {k.flaggor.some((f) => f.typ !== 'granskning') && (
        <ul className="space-y-0.5">
          {k.flaggor.filter((f) => f.typ !== 'granskning').map((f, i) => (
            <li key={i} className={`text-xs ${f.allvar === 'stopp' ? 'text-red-400' : 'text-amber-300/90'}`}>• {f.text}</li>
          ))}
        </ul>
      )}
      {onBokfor && (
        <button
          onClick={onBokfor}
          disabled={arbetar}
          className="mt-1 px-3 py-1.5 bg-gold-500 hover:bg-gold-400 text-navy-900 font-bold rounded-lg text-xs transition disabled:opacity-50"
        >
          Bokför {k.konto}
        </button>
      )}
    </div>
  );
}
