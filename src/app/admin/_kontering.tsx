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
  // Radera kräver två klick: första visar "Ja, radera", andra raderar
  const [bekrafta, setBekrafta] = useState(false);
  const [raderar, setRaderar] = useState(false);

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
  // En rad som filtrerats bort ska inte kunna konteras eller raderas av misstag
  useEffect(() => {
    const kvar = new Set(filtered.map((r) => r.id));
    setValda((list) => (list.every((id) => kvar.has(id)) ? list : list.filter((id) => kvar.has(id))));
    setBekrafta(false);
  }, [filtered]);

  const perId = useMemo(() => new Map((rader ?? []).map((r) => [r.id, r])), [rader]);
  // Bokförda rader konteras inte om förrän konteringen raderats
  const konterbara = valda.filter((id) => perId.get(id) && status(perId.get(id)!) !== 'bokford');
  const raderbara = valda.filter((id) => perId.get(id) && status(perId.get(id)!) !== 'okonterad');

  /** Raderar förslag och bokföring för de markerade raderna, så att de blir okonterade igen. */
  const radera = async () => {
    if (raderar || raderbara.length === 0) return;
    setRaderar(true);
    const res = await fetch('/api/admin/kontering', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, transaktionIds: raderbara }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setRaderar(false);
    setBekrafta(false);
    if (!res?.ok) {
      setLaddfel(data?.error || 'Konteringarna kunde inte raderas');
      return;
    }
    const nya = new Map(((data.rader ?? []) as AdminKonteringRad[]).map((r) => [r.id, r]));
    setRader((list) => list && list.map((r) => nya.get(r.id) ?? r));
    setValda([]);
  };

  /** Konterar de markerade raderna, några i taget, och visar varje rad så fort den är klar. */
  const kontera = async () => {
    if (ko || konterbara.length === 0) return;
    const lista = [...konterbara];
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
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
        Välj först om kunden betalar via företagskonto eller privatkonto under <strong>Kundkontext</strong>.
        Det avgör vilket konto pengarna bokförs mot.
      </div>
    );
  }
  if (laddfel) return <p className="text-red-600 text-sm">{laddfel}</p>;
  if (!rader) return <p className="text-slate-500 text-sm">Hämtar transaktionerna…</p>;
  if (rader.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl text-center py-12 text-slate-600 text-sm">
        Inga transaktioner att kontera. Läs av underlag under fliken Underlag först.
      </div>
    );
  }

  const allaValda = filtered.length > 0 && valda.length === filtered.length;
  const flikar: { id: Filter; label: string; n: number }[] = [
    { id: 'alla', label: 'Alla', n: rader.length },
    { id: 'okonterad', label: 'Okonterade', n: antal.okonterad },
    { id: 'forslag', label: 'Förslag', n: antal.forslag },
    { id: 'bokford', label: 'Bokförda', n: antal.bokford },
  ];

  return (
    <div className="space-y-5">
      <p className="text-slate-500 text-xs">
        Båda modellerna konterar varje rad enligt K1. Bokförs direkt när båda är gröna och överens om konto och
        moms — annars blir det förslag. Betalkonto:{' '}
        <span className="text-slate-700">
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
              filter === f.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {f.label} <span className="tabular-nums opacity-70">{f.n.toLocaleString('sv-SE')}</span>
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök text, belopp eller konto"
          className="flex-1 min-w-[12rem] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      {(valda.length > 0 || ko) && (
        <div className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          {ko ? (
            <>
              <span className="text-slate-800 text-sm">
                Konterar… {ko.klara.toLocaleString('sv-SE')} av {ko.totalt.toLocaleString('sv-SE')} klara
              </span>
              <button
                onClick={() => { avbryt.current = true; }}
                className="text-slate-500 hover:text-slate-700 text-xs transition ml-auto"
              >
                Stoppa efter pågående
              </button>
            </>
          ) : (
            <>
              <span className="text-slate-800 text-sm">
                {valda.length.toLocaleString('sv-SE')} {valda.length === 1 ? 'markerad' : 'markerade'}
              </span>
              {konterbara.length > 0 && (
                <button
                  onClick={kontera}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition"
                  title="Bokförda rader konteras inte om — radera konteringen först"
                >
                  Kontera {konterbara.length.toLocaleString('sv-SE')}
                </button>
              )}
              {raderbara.length > 0 && (bekrafta ? (
                <>
                  <button
                    onClick={radera}
                    disabled={raderar}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50"
                  >
                    {raderar ? 'Raderar…' : `Ja, radera ${raderbara.length.toLocaleString('sv-SE')}`}
                  </button>
                  <button
                    onClick={() => setBekrafta(false)}
                    disabled={raderar}
                    className="text-slate-500 hover:text-slate-700 text-xs transition disabled:opacity-50"
                  >
                    Avbryt
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setBekrafta(true)}
                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-600 border border-red-500/30 rounded-lg transition"
                  title="Tar bort förslagen och bokföringen — raderna blir okonterade"
                >
                  Radera kontering ({raderbara.length.toLocaleString('sv-SE')})
                </button>
              ))}
              {konterbara.length > 0 && (
                <span className="text-slate-400 text-xs">Tar runt en halv minut per rad, {SAMTIDIGA} åt gången.</span>
              )}
              <button onClick={() => setValda([])} className="text-slate-500 hover:text-slate-700 text-xs transition ml-auto">
                Avmarkera
              </button>
            </>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl text-center py-12 text-slate-600 text-sm">
          Ingen transaktion matchar filtret
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-[11px] uppercase tracking-widest border-b border-slate-200">
                  <th className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allaValda}
                      disabled={!!ko}
                      onChange={(e) => setValda(e.target.checked ? filtered.map((r) => r.id) : [])}
                      title={allaValda ? 'Avmarkera alla' : 'Markera alla i filtret'}
                      className="accent-blue-600 align-middle"
                    />
                  </th>
                  <th className="text-left font-semibold px-4 py-2.5">Datum</th>
                  <th className="text-left font-semibold px-4 py-2.5">Beskrivning</th>
                  <th className="text-left font-semibold px-4 py-2.5">Kontering</th>
                  <th className="text-right font-semibold px-4 py-2.5">Belopp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
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
              className="w-full px-4 py-3 text-sm text-slate-600 hover:text-slate-900 border-t border-slate-200 transition"
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
        className={`cursor-pointer transition ${open ? 'bg-slate-50' : vald ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
      >
        <td className="px-4 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={vald}
            disabled={lasta || kor}
            onChange={(e) => onValj(e.target.checked)}
            className="accent-blue-600 align-middle"
          />
        </td>
        <td className="px-4 py-2.5 text-slate-700 tabular-nums whitespace-nowrap align-top">
          {r.datum || <span className="text-blue-700">utan datum</span>}
        </td>
        <td className="px-4 py-2.5 align-top">
          <span className="text-slate-900">{r.beskrivning || '—'}</span>
          {r.motpart && r.motpart !== r.beskrivning && <span className="text-slate-500"> · {r.motpart}</span>}
          {r.kalla === 'bank' && <span className="block text-slate-400 text-[11px] mt-0.5">Bankrad</span>}
        </td>
        <td className="px-4 py-2.5 align-top whitespace-nowrap">
          <KonteringsStatus rad={r} status={s} kor={kor} fel={fel} />
        </td>
        <td className={`px-4 py-2.5 tabular-nums text-right whitespace-nowrap align-top font-medium ${
          r.riktning === 'in' ? 'text-emerald-700' : 'text-slate-800'
        }`}>
          {r.riktning === 'in' ? '+' : '−'}{kr.format(r.belopp)}
          {r.valuta !== 'SEK' && <span className="text-slate-400 text-xs"> {r.valuta}</span>}
          {r.moms ? <span className="block text-slate-400 text-[11px] font-normal">moms {kr.format(r.moms)}</span> : null}
        </td>
      </tr>
      {open && (
        <tr className="bg-white">
          <td colSpan={5} className="px-4 py-4">
            <Detalj rad={r} status={s} betalsatt={betalsatt} userId={userId} onRad={onRad} />
          </td>
        </tr>
      )}
    </>
  );
}

function KonteringsStatus({ rad: r, status: s, kor, fel }: { rad: AdminKonteringRad; status: Status; kor: boolean; fel?: string }) {
  if (kor) return <span className="text-blue-700 text-xs">Konterar…</span>;
  if (fel) return <span className="text-red-600 text-xs whitespace-normal">{fel}</span>;
  if (s === 'bokford') {
    const huvud = r.verifikation!.rader[0];
    return (
      <span className="text-xs">
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-semibold mr-2">Bokförd</span>
        <span className="text-slate-700 tabular-nums">{huvud?.konto}</span>
        <span className="text-slate-500"> {huvud?.kontonamn}</span>
      </span>
    );
  }
  if (s === 'forslag') {
    return (
      <span className="flex flex-col gap-0.5 text-xs">
        {r.konteringar.map((k) => (
          <span key={k.modell} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${OMDOME[k.omdome].prick}`} title={OMDOME[k.omdome].text} />
            <span className="text-slate-400 w-12">{k.modell.startsWith('gpt') ? 'GPT' : 'Claude'}</span>
            <span className="text-slate-800 tabular-nums">{k.konto ?? '—'}</span>
            <span className="text-slate-500 truncate max-w-[14rem]">{k.kontonamn}</span>
            {k.momssats ? <span className="text-slate-400">{k.momssats} %</span> : null}
          </span>
        ))}
      </span>
    );
  }
  return <span className="text-slate-400 text-xs">Okonterad</span>;
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

  const anropa = async (method: 'PUT' | 'DELETE', body: object) => {
    setArbetar(true);
    setFel('');
    const res = await fetch('/api/admin/kontering', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setArbetar(false);
    setBekraftaRadera(false);
    if (!res?.ok) setFel(data?.error || 'Det gick inte');
    else onRad(method === 'DELETE' ? data.rader?.[0] ?? null : data.rad);
  };

  // Ångra tar bara bort bokföringen och låter förslagen ligga kvar; radera tar bort allt
  const angra = () => anropa('DELETE', { userId, transaktionIds: [r.id], bara: 'bokforing' });
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const raderaKnapp = bekraftaRadera ? (
    <>
      <button
        onClick={() => anropa('DELETE', { userId, transaktionIds: [r.id] })}
        disabled={arbetar}
        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50"
      >
        {arbetar ? 'Raderar…' : 'Ja, radera'}
      </button>
      <button onClick={() => setBekraftaRadera(false)} className="text-slate-500 hover:text-slate-700 text-xs transition">
        Avbryt
      </button>
    </>
  ) : (
    <button
      onClick={() => setBekraftaRadera(true)}
      disabled={arbetar}
      title="Tar bort modellernas förslag och bokföringen — raden blir okonterad"
      className="px-3 py-1.5 text-xs text-red-600 hover:text-red-600 border border-red-500/30 rounded-lg transition disabled:opacity-50"
    >
      Radera konteringen
    </button>
  );

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
      <summary className="text-slate-500 hover:text-slate-700 text-xs cursor-pointer">Detaljer från underlaget</summary>
      <p className="text-slate-600 text-xs whitespace-pre-wrap mt-1 max-w-3xl">{r.detaljer}</p>
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
                <td className="pr-3 text-slate-700 tabular-nums">{x.konto}</td>
                <td className="pr-6 text-slate-500">{x.kontonamn}</td>
                <td className="pr-3 text-right tabular-nums text-slate-800">{x.belopp > 0 ? kr.format(x.belopp) : ''}</td>
                <td className="text-right tabular-nums text-slate-800">{x.belopp < 0 ? kr.format(-x.belopp) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-xs">
            {v.signatur === 'AI' ? 'Bokförd direkt — båda modellerna var överens.' : `Bokförd av ${v.signatur ?? 'okänd'}.`}
          </span>
          {r.konteringar.length > 0 && (
            <button
              onClick={angra}
              disabled={arbetar}
              title="Tar bort verifikationen men behåller modellernas förslag"
              className="px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg transition disabled:opacity-50"
            >
              Ångra bokföringen
            </button>
          )}
          {raderaKnapp}
          {fel && <span className="text-red-600 text-xs">{fel}</span>}
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
        <p className="text-slate-500 text-xs">Inte konterad än. Markera raden och tryck Kontera, eller välj konto själv nedan.</p>
      )}
      {r.konteringar.length > 0 && <div className="flex items-center gap-3">{raderaKnapp}</div>}

      {/* Eget konto: när ingen av modellerna har rätt. Kontot prövas mot K1 på servern. */}
      <div className="flex items-end gap-2 flex-wrap pt-3 border-t border-slate-200">
        <label className="text-xs text-slate-500">
          Eget konto
          <input
            value={konto}
            onChange={(e) => setKonto(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="t.ex. 5400"
            className="block mt-1 w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 tabular-nums focus:outline-none focus:border-blue-500"
          />
        </label>
        <label className="text-xs text-slate-500">
          Moms
          <select
            value={sats}
            onChange={(e) => setSats(e.target.value)}
            className="block mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          >
            {['25', '12', '6', '0'].map((m) => <option key={m} value={m}>{m} %</option>)}
          </select>
        </label>
        {betalsatt === 'bada' && (
          <label className="text-xs text-slate-500">
            Betalt via
            <select
              value={motkonto}
              onChange={(e) => setMotkonto(e.target.value)}
              className="block mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
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
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-lg text-xs transition disabled:opacity-50"
        >
          {arbetar ? 'Bokför…' : 'Bokför'}
        </button>
        {fel && <span className="text-red-600 text-xs">{fel}</span>}
      </div>
    </div>
  );
}

function Forslag({ k, onBokfor, arbetar }: { k: AdminKontering; onBokfor?: () => void; arbetar?: boolean }) {
  const g = k.granskning;
  const byttFran = g?.forstaKonto && g.forstaKonto !== k.konto ? g.forstaKonto : null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${OMDOME[k.omdome].prick}`} />
        <span className="text-slate-600 text-xs font-semibold">{MODELLNAMN[k.modell] ?? k.modell}</span>
        {g?.svarade && !g.svarade.includes(k.modell) && (
          <span className="text-slate-400 text-[11px]">svarade: {g.svarade}</span>
        )}
      </div>
      <p className="text-slate-900 text-sm">
        <span className="tabular-nums font-semibold">{k.konto ?? '—'}</span> {k.kontonamn}
        <span className="text-slate-500"> · moms {k.momssats ?? 0} %</span>
        {byttFran && <span className="text-slate-400 text-xs"> (bytt från {byttFran} i granskningen)</span>}
      </p>
      <p className="text-slate-600 text-xs leading-relaxed">{k.motivering}</p>
      {g?.motivering && (
        <p className="text-slate-500 text-xs leading-relaxed">
          <span className="text-slate-600">Granskning:</span> {g.motivering}
        </p>
      )}
      {k.flaggor.some((f) => f.typ !== 'granskning') && (
        <ul className="space-y-0.5">
          {k.flaggor.filter((f) => f.typ !== 'granskning').map((f, i) => (
            <li key={i} className={`text-xs ${f.allvar === 'stopp' ? 'text-red-600' : 'text-amber-700'}`}>• {f.text}</li>
          ))}
        </ul>
      )}
      {onBokfor && (
        <button
          onClick={onBokfor}
          disabled={arbetar}
          className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50"
        >
          Bokför {k.konto}
        </button>
      )}
    </div>
  );
}
