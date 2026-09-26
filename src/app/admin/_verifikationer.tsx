'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

/**
 * Verifikationslistan i adminpanelen: summering, filter och varje verifikation
 * med sina konteringar. Används både för en enskild SIE-fil och för allt en
 * kund har, så formen är den minsta gemensamma.
 */

export interface VerRad {
  konto: string;
  kontonamn: string;
  belopp: number;
  text: string;
  objekt: { dimension: string; objekt: string }[];
  borttagen: boolean;
  tillagd: boolean;
}

export interface Ver {
  id?: string;
  serie: string;
  nummer: string;
  datum: string;
  text: string;
  registrerad: string;
  signatur: string;
  summa: number;
  balanserad: boolean;
  transaktioner: VerRad[];
  /** Var verifikationen kom ifrån — visas bara i kundens samlade lista. */
  kalla?: string;
  underlagId?: string | null;
  fileName?: string | null;
}

// En stor SIE-fil kan ha tusentals verifikationer. Alla på en gång gör sidan seg.
const PAGE = 100;

export const kr = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KALLA: Record<string, string> = { sie: 'SIE', ai: 'AI', manuell: 'Manuell', zettle: 'Zettle', shopify: 'Shopify' };

function matches(v: Ver, q: string): boolean {
  if (!q) return true;
  const hay = [
    `${v.serie}${v.nummer}`, `${v.serie} ${v.nummer}`, v.datum, v.text, v.fileName ?? '',
    ...v.transaktioner.flatMap((t) => [t.konto, t.kontonamn, t.text, kr.format(Math.abs(t.belopp)), String(Math.abs(t.belopp))]),
  ].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((word) => hay.includes(word));
}

const giltiga = (v: Ver) => v.transaktioner.filter((t) => !t.borttagen && !t.tillagd);

type Sort = 'datum' | 'nummer';

// Nummer är text — "10" ska ändå komma efter "9"
const nummer = (n: string) => (/^\d+$/.test(n) ? Number(n) : Number.POSITIVE_INFINITY);

/**
 * Datum: i den ordning det hände. Verifikationsnummer: året först, sedan serie
 * och nummer. Numreringen börjar om varje år, så utan året skulle A1 för 2024
 * och A1 för 2025 hamna bredvid varandra.
 */
function compare(sort: Sort) {
  return (a: Ver, b: Ver) => {
    if (sort === 'datum') {
      return a.datum.localeCompare(b.datum) || a.serie.localeCompare(b.serie)
        || nummer(a.nummer) - nummer(b.nummer) || a.nummer.localeCompare(b.nummer);
    }
    return a.datum.slice(0, 4).localeCompare(b.datum.slice(0, 4)) || a.serie.localeCompare(b.serie)
      || nummer(a.nummer) - nummer(b.nummer) || a.nummer.localeCompare(b.nummer)
      || a.datum.localeCompare(b.datum);
  };
}

export function VerifikationLista({ verifikationer, showSource = false }: { verifikationer: Ver[]; showSource?: boolean }) {
  const [query, setQuery] = useState('');
  const [serie, setSerie] = useState('');
  const [year, setYear] = useState('');
  const [onlyUnbalanced, setOnlyUnbalanced] = useState(false);
  const [sort, setSort] = useState<Sort>('datum');
  const [shown, setShown] = useState(PAGE);

  const series = useMemo(() => [...new Set(verifikationer.map((v) => v.serie))].sort(), [verifikationer]);
  const years = useMemo(
    () => [...new Set(verifikationer.map((v) => v.datum.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort().reverse(),
    [verifikationer],
  );

  const filtered = useMemo(
    () => verifikationer.filter((v) =>
      (!serie || v.serie === serie)
      && (!year || v.datum.startsWith(year))
      && (!onlyUnbalanced || !v.balanserad)
      && matches(v, query.trim()))
      .sort(compare(sort)),
    [verifikationer, serie, year, onlyUnbalanced, query, sort],
  );

  // Ny sökning börjar om från första sidan
  useEffect(() => setShown(PAGE), [query, serie, year, onlyUnbalanced, sort]);

  // Summeringen följer filtret, så att ett år eller en serie går att stämma av för sig
  const totals = useMemo(() => {
    let debet = 0;
    let kredit = 0;
    let rader = 0;
    for (const v of filtered) {
      for (const t of giltiga(v)) {
        rader++;
        if (t.belopp > 0) debet += t.belopp;
        else kredit -= t.belopp;
      }
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return { debet: round(debet), kredit: round(kredit), differens: round(debet - kredit), rader };
  }, [filtered]);

  const unbalanced = filtered.filter((v) => !v.balanserad);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Verifikationer', value: filtered.length.toLocaleString('sv-SE') },
          { label: 'Konteringsrader', value: totals.rader.toLocaleString('sv-SE') },
          { label: 'Summa debet', value: kr.format(totals.debet) },
          { label: 'Summa kredit', value: kr.format(totals.kredit) },
          { label: 'Differens', value: kr.format(totals.differens), bad: Math.abs(totals.differens) >= 0.005 },
        ].map((tile) => (
          <div key={tile.label} className={`rounded-xl border p-4 ${
            tile.bad ? 'bg-red-500/10 border-red-500/40' : 'bg-navy-700/50 border-navy-600'
          }`}>
            <p className="text-warm-500 text-[11px] uppercase tracking-widest">{tile.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${tile.bad ? 'text-red-400' : 'text-white'}`}>{tile.value}</p>
          </div>
        ))}
      </div>

      {unbalanced.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-sm">
          <p className="text-red-400 font-semibold">
            ⚠ {unbalanced.length === 1 ? 'En verifikation balanserar inte' : `${unbalanced.length} verifikationer balanserar inte`}:{' '}
            <span className="font-normal text-red-300">
              {unbalanced.slice(0, 10).map((v) => `${v.serie}${v.nummer} (${kr.format(v.summa)})`).join(', ')}
              {unbalanced.length > 10 && ' …'}
            </span>
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök verifikation, text, konto eller belopp"
          className="flex-1 min-w-[12rem] bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-warm-600 focus:outline-none focus:border-gold-500 transition"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          title="Sortering"
          className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500"
        >
          <option value="datum">Sortera på datum</option>
          <option value="nummer">Sortera på verifikationsnummer</option>
        </select>
        {years.length > 1 && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500"
          >
            <option value="">Alla år</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {series.length > 1 && (
          <select
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500"
          >
            <option value="">Alla serier</option>
            {series.map((s) => <option key={s} value={s}>Serie {s}</option>)}
          </select>
        )}
        {verifikationer.some((v) => !v.balanserad) && (
          <label className="flex items-center gap-2 text-sm text-warm-300 cursor-pointer">
            <input type="checkbox" checked={onlyUnbalanced} onChange={(e) => setOnlyUnbalanced(e.target.checked)} />
            Bara obalanserade
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-navy-700/50 border border-navy-600 rounded-xl text-center py-12 text-warm-400 text-sm">
          {verifikationer.length === 0 ? 'Inga verifikationer.' : 'Inga verifikationer matchar.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, shown).map((v, i) => (
            <Verifikation key={v.id ?? `${v.serie}-${v.nummer}-${i}`} v={v} showSource={showSource} />
          ))}
          {filtered.length > shown && (
            <button
              onClick={() => setShown((n) => n + PAGE)}
              className="w-full py-3 bg-navy-700/50 hover:bg-navy-700 border border-navy-600 rounded-xl text-sm text-warm-300 transition"
            >
              Visa {Math.min(PAGE, filtered.length - shown)} till ({(filtered.length - shown).toLocaleString('sv-SE')} kvar)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Verifikation({ v, showSource }: { v: Ver; showSource: boolean }) {
  const rows = giltiga(v);
  const debet = rows.filter((t) => t.belopp > 0).reduce((s, t) => s + t.belopp, 0);
  const kredit = rows.filter((t) => t.belopp < 0).reduce((s, t) => s - t.belopp, 0);

  return (
    <div className={`bg-navy-700/50 border rounded-xl p-4 ${v.balanserad ? 'border-navy-600' : 'border-red-500/60'}`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-white text-sm font-semibold min-w-0 break-words">
          <span className="text-gold-400 tabular-nums mr-2">{v.serie}{v.nummer}</span>
          {v.text || <span className="text-warm-500 font-normal italic">(ingen text)</span>}
        </p>
        <span className="text-warm-500 text-xs tabular-nums shrink-0">
          {v.datum}
          {v.registrerad && v.registrerad !== v.datum && <span className="text-warm-600"> · reg. {v.registrerad}</span>}
          {v.signatur && <span className="text-warm-600"> · {v.signatur}</span>}
        </span>
      </div>

      {showSource && (v.kalla || v.fileName) && (
        <p className="text-warm-600 text-[11px] mt-1">
          {v.kalla && (
            <span className="px-1.5 py-0.5 rounded bg-navy-600 text-warm-300 font-semibold mr-1.5">{KALLA[v.kalla] ?? v.kalla}</span>
          )}
          {v.fileName && v.underlagId ? (
            <Link href={`/admin/underlag/${v.underlagId}`} className="hover:text-gold-400 transition">från {v.fileName}</Link>
          ) : v.fileName && <>från {v.fileName}</>}
        </p>
      )}

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-warm-500 text-[11px] uppercase tracking-widest">
              <th className="text-left font-medium pb-1.5 pr-3 w-16">Konto</th>
              <th className="text-left font-medium pb-1.5 pr-3">Benämning</th>
              <th className="text-right font-medium pb-1.5 pl-3 w-28">Debet</th>
              <th className="text-right font-medium pb-1.5 pl-3 w-28">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {v.transaktioner.map((t, i) => {
              const history = t.borttagen || t.tillagd;
              const strike = t.borttagen ? 'line-through' : '';
              return (
                <tr key={i} className={`border-t border-navy-600/60 ${history ? 'text-warm-600' : 'text-warm-100'}`}>
                  <td className={`py-1.5 pr-3 tabular-nums ${strike}`}>{t.konto}</td>
                  <td className="py-1.5 pr-3">
                    <span className={strike}>{t.kontonamn || '—'}</span>
                    {t.text && t.text !== v.text && <span className="text-warm-500"> · {t.text}</span>}
                    {t.objekt.length > 0 && (
                      <span className="text-warm-600 text-xs"> · {t.objekt.map((o) => `${o.dimension}:${o.objekt}`).join(', ')}</span>
                    )}
                    {t.borttagen && <span className="ml-2 text-[10px] uppercase tracking-wide">borttagen</span>}
                    {t.tillagd && <span className="ml-2 text-[10px] uppercase tracking-wide">tillagd i efterhand</span>}
                  </td>
                  <td className={`py-1.5 pl-3 text-right tabular-nums ${strike}`}>{t.belopp > 0 ? kr.format(t.belopp) : ''}</td>
                  <td className={`py-1.5 pl-3 text-right tabular-nums ${strike}`}>{t.belopp < 0 ? kr.format(-t.belopp) : ''}</td>
                </tr>
              );
            })}
            <tr className="border-t border-navy-500 text-warm-300 font-semibold">
              <td colSpan={2} className="pt-1.5 pr-3 text-xs">
                {v.balanserad ? 'Summa' : <span className="text-red-400">Balanserar inte — differens {kr.format(v.summa)}</span>}
              </td>
              <td className="pt-1.5 pl-3 text-right tabular-nums">{kr.format(debet)}</td>
              <td className="pt-1.5 pl-3 text-right tabular-nums">{kr.format(kredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
