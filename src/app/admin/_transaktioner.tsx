'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { AdminTransaktion } from '@/lib/admin-types';
import { kr } from './_verifikationer';

/**
 * Transaktionerna en AI läst ur kundens underlag.
 *
 * Steget före verifikationerna: ingenting här är konterat, det står bara vad
 * som faktiskt stod på kvittot, fakturan eller kontoutdraget. Listan visar
 * vilken fil varje rad kom ur, så att en siffra som ser konstig ut går att
 * jämföra med originalet.
 */

// Ett kontoutdrag för ett år kan ge tusentals rader. Alla på en gång gör sidan seg.
const PAGE = 200;

type Riktning = 'alla' | 'in' | 'ut';

function matches(t: AdminTransaktion, q: string): boolean {
  if (!q) return true;
  const hay = [
    t.datum, t.beskrivning, t.motpart, t.fileName ?? '', t.anteckning,
    kr.format(t.belopp), String(t.belopp),
  ].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((word) => hay.includes(word));
}

/** Odaterade rader sist — de är oftast det som behöver tittas på. */
function compare(a: AdminTransaktion, b: AdminTransaktion): number {
  if (!a.datum !== !b.datum) return a.datum ? -1 : 1;
  return a.datum.localeCompare(b.datum) || a.underlagId.localeCompare(b.underlagId) || a.radnr - b.radnr;
}

export function TransaktionsLista({
  transaktioner,
  onDelete,
}: {
  transaktioner: AdminTransaktion[];
  /** Utan den här visas inga kryssrutor — listan är då bara till för att läsas. */
  onDelete?: (ids: string[]) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [fil, setFil] = useState('');
  const [riktning, setRiktning] = useState<Riktning>('alla');
  const [shown, setShown] = useState(PAGE);
  const [valda, setValda] = useState<string[]>([]);
  // Radera kräver två klick: första visar "Säker?", andra raderar
  const [bekrafta, setBekrafta] = useState(false);
  const [raderar, setRaderar] = useState(false);

  // Filerna i den ordning de först dyker upp, så att listan matchar underlagen
  const filer = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of transaktioner) {
      if (!seen.has(t.underlagId)) seen.set(t.underlagId, t.fileName ?? 'Namnlös fil');
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [transaktioner]);

  const filtered = useMemo(
    () => transaktioner
      .filter((t) => (!fil || t.underlagId === fil)
        && (riktning === 'alla' || t.riktning === riktning)
        && matches(t, query.trim()))
      .sort(compare),
    [transaktioner, fil, riktning, query],
  );

  useEffect(() => setShown(PAGE), [query, fil, riktning]);

  // En rad som filtrerats bort ska inte kunna raderas av misstag
  useEffect(() => {
    const kvar = new Set(filtered.map((t) => t.id));
    setValda((list) => (list.every((id) => kvar.has(id)) ? list : list.filter((id) => kvar.has(id))));
    setBekrafta(false);
  }, [filtered]);

  const allaValda = filtered.length > 0 && valda.length === filtered.length;

  const radera = async () => {
    if (!onDelete || raderar || valda.length === 0) return;
    setRaderar(true);
    await onDelete(valda).catch(() => null);
    setRaderar(false);
    setValda([]);
    setBekrafta(false);
  };

  // Summeringen följer filtret. Valutor hålls isär — en rad i euro ska inte
  // läggas ihop med kronorna bara för att båda är tal.
  const summering = useMemo(() => {
    const per = new Map<string, { in: number; ut: number }>();
    for (const t of filtered) {
      const rad = per.get(t.valuta) ?? { in: 0, ut: 0 };
      if (t.riktning === 'in') rad.in += t.belopp;
      else rad.ut += t.belopp;
      per.set(t.valuta, rad);
    }
    return [...per].map(([valuta, v]) => ({
      valuta,
      in: Math.round(v.in * 100) / 100,
      ut: Math.round(v.ut * 100) / 100,
    }));
  }, [filtered]);

  const utanDatum = filtered.filter((t) => !t.datum).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-navy-700/50 border-navy-600 p-4">
          <p className="text-warm-500 text-[11px] uppercase tracking-widest">Transaktioner</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-white">{filtered.length.toLocaleString('sv-SE')}</p>
        </div>
        {summering.map((s) => (
          <div key={s.valuta} className="rounded-xl border bg-navy-700/50 border-navy-600 p-4">
            <p className="text-warm-500 text-[11px] uppercase tracking-widest">
              In / ut{summering.length > 1 || s.valuta !== 'SEK' ? ` · ${s.valuta}` : ''}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              <span className="text-emerald-300">{kr.format(s.in)}</span>
              <span className="text-warm-600"> / </span>
              <span className="text-warm-200">{kr.format(s.ut)}</span>
            </p>
          </div>
        ))}
      </div>

      {utanDatum > 0 && (
        <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-4 text-sm text-gold-300">
          {utanDatum === 1
            ? 'En rad saknar datum — det framgick inte av underlaget.'
            : `${utanDatum} rader saknar datum — det framgick inte av underlagen.`}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök text, motpart, fil eller belopp"
          className="flex-1 min-w-[12rem] bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-warm-600 focus:outline-none focus:border-gold-500 transition"
        />
        <select
          value={riktning}
          onChange={(e) => setRiktning(e.target.value as Riktning)}
          className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500"
        >
          <option value="alla">In och ut</option>
          <option value="in">Bara in</option>
          <option value="ut">Bara ut</option>
        </select>
        {filer.length > 1 && (
          <select
            value={fil}
            onChange={(e) => setFil(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500 max-w-[16rem]"
          >
            <option value="">Alla filer ({filer.length})</option>
            {filer.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
      </div>

      {onDelete && valda.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-navy-700/50 border border-navy-600 rounded-xl px-4 py-3">
          <span className="text-warm-200 text-sm">
            {valda.length.toLocaleString('sv-SE')} {valda.length === 1 ? 'markerad' : 'markerade'}
          </span>
          {bekrafta ? (
            <>
              <button
                onClick={radera}
                disabled={raderar}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50"
              >
                {raderar ? 'Raderar…' : `Ja, radera ${valda.length}`}
              </button>
              <button
                onClick={() => setBekrafta(false)}
                disabled={raderar}
                className="text-warm-500 hover:text-warm-300 text-xs transition disabled:opacity-50"
              >
                Avbryt
              </button>
            </>
          ) : (
            <button
              onClick={() => setBekrafta(true)}
              className="px-3 py-1.5 text-xs text-red-400/80 hover:text-red-400 border border-red-500/30 rounded-lg transition"
            >
              Radera
            </button>
          )}
          <button
            onClick={() => setValda([])}
            className="text-warm-500 hover:text-warm-300 text-xs transition ml-auto"
          >
            Avmarkera
          </button>
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
                  {onDelete && (
                    <th className="px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={allaValda}
                        onChange={(e) => setValda(e.target.checked ? filtered.map((t) => t.id) : [])}
                        title={allaValda ? 'Avmarkera alla' : 'Markera alla i filtret'}
                        className="accent-gold-500 align-middle"
                      />
                    </th>
                  )}
                  <th className="text-left font-semibold px-4 py-2.5">Datum</th>
                  <th className="text-left font-semibold px-4 py-2.5">Beskrivning</th>
                  <th className="text-left font-semibold px-4 py-2.5 hidden md:table-cell">Fil</th>
                  <th className="text-right font-semibold px-4 py-2.5 hidden sm:table-cell">Moms</th>
                  <th className="text-right font-semibold px-4 py-2.5">Belopp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-600/60">
                {filtered.slice(0, shown).map((t) => (
                  <tr key={t.id} className={`transition ${valda.includes(t.id) ? 'bg-gold-500/5' : 'hover:bg-navy-700/40'}`}>
                    {onDelete && (
                      <td className="px-4 py-2.5 align-top">
                        <input
                          type="checkbox"
                          checked={valda.includes(t.id)}
                          onChange={(e) => setValda((list) =>
                            e.target.checked ? [...list, t.id] : list.filter((id) => id !== t.id))}
                          className="accent-gold-500 align-middle"
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-warm-300 tabular-nums whitespace-nowrap align-top">
                      {t.datum || <span className="text-gold-400/80">utan datum</span>}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <span className="text-warm-100">{t.beskrivning || '—'}</span>
                      {t.motpart && t.motpart !== t.beskrivning && (
                        <span className="text-warm-500"> · {t.motpart}</span>
                      )}
                      {t.anteckning && (
                        <span className="block text-gold-400/80 text-xs mt-0.5">{t.anteckning}</span>
                      )}
                      <span className="block md:hidden text-warm-600 text-[11px] mt-0.5">{t.fileName}</span>
                    </td>
                    <td className="px-4 py-2.5 align-top hidden md:table-cell">
                      <Link
                        href={`/admin/underlag/${t.underlagId}`}
                        title={t.fileName ?? undefined}
                        className="text-warm-500 hover:text-gold-400 text-xs transition break-all"
                      >
                        {t.fileName ?? 'Okänd fil'}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-warm-500 tabular-nums text-right whitespace-nowrap align-top hidden sm:table-cell">
                      {t.moms ? kr.format(t.moms) : ''}
                    </td>
                    <td className={`px-4 py-2.5 tabular-nums text-right whitespace-nowrap align-top font-medium ${
                      t.riktning === 'in' ? 'text-emerald-300' : 'text-warm-200'
                    }`}>
                      {t.riktning === 'in' ? '+' : '−'}{kr.format(t.belopp)}
                      {t.valuta !== 'SEK' && <span className="text-warm-600 text-xs"> {t.valuta}</span>}
                    </td>
                  </tr>
                ))}
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
