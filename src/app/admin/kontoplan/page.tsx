'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KontoRuta } from '../_k1-konto';

/**
 * Kontoplanen: alla K1-konton som konteringen får välja, med byråns ändringar
 * och tillagda konton. Klick på ett konto öppnar samma ruta som i Flöde och
 * Kontering. Hela kontobeskrivningarna kan laddas ner som JSON (som k1.json)
 * eller xlsx (samma form som filen k1.json byggs från, se scripts/k1-till-json.mjs).
 */

interface Rad {
  konto: string;
  namn: string;
  beskrivning: string;
  status: 'original' | 'andrad' | 'ny';
  andradAt: string | null;
}

const KLASSER: Record<string, string> = {
  '1': 'Tillgångar', '2': 'Eget kapital och skulder', '3': 'Intäkter', '4': 'Varor och material',
  '5': 'Övriga externa kostnader', '6': 'Övriga externa kostnader', '7': 'Personal och avskrivningar', '8': 'Finansiella poster',
};

export default function Kontoplan() {
  const [rader, setRader] = useState<Rad[] | null>(null);
  const [fel, setFel] = useState('');
  const [sok, setSok] = useState('');
  const [bara, setBara] = useState<'alla' | 'byran'>('alla');
  const [oppet, setOppet] = useState<{ konto: string; ny: boolean } | null>(null);

  const ladda = useCallback(() => {
    fetch('/api/admin/k1-konto')
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setRader(d.konton); })
      .catch((err) => setFel(err instanceof Error ? err.message : String(err)));
  }, []);
  useEffect(() => { ladda(); }, [ladda]);

  const synliga = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return (rader ?? []).filter((r) =>
      (bara === 'alla' || r.status !== 'original') &&
      (!q || r.konto.startsWith(q) || r.namn.toLowerCase().includes(q) || r.beskrivning.toLowerCase().includes(q)));
  }, [rader, sok, bara]);

  const andrade = (rader ?? []).filter((r) => r.status === 'andrad').length;
  const nya = (rader ?? []).filter((r) => r.status === 'ny').length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-slate-900">Kontoplan</h1>
          {rader && (
            <p className="text-xs text-slate-500">
              {rader.length} K1-konton{andrade ? ` · ${andrade} ändrade av byrån` : ''}{nya ? ` · ${nya} tillagda` : ''}
            </p>
          )}
        </div>
        <a href="/api/admin/k1-konto?fil=xlsx" className="text-sm border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-slate-700 hover:border-slate-400">
          Ladda ner xlsx
        </a>
        <a href="/api/admin/k1-konto?fil=json" className="text-sm border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-slate-700 hover:border-slate-400">
          Ladda ner JSON
        </a>
        <button onClick={() => setOppet({ konto: '', ny: true })} className="text-sm bg-blue-600 text-white font-medium rounded-lg px-3 py-1.5">
          Lägg till konto
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Sök kontonummer, namn eller text…"
          className="w-full sm:w-80 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
        {(['alla', 'byran'] as const).map((f) => (
          <button key={f} onClick={() => setBara(f)}
            className={`text-sm px-3 py-1 rounded-full ${bara === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-600'}`}>
            {f === 'alla' ? 'Alla' : 'Ändrade och tillagda'}
          </button>
        ))}
      </div>

      {fel && <p className="text-sm text-red-600">{fel}</p>}
      {!rader && !fel && <p className="text-sm text-slate-500">Laddar…</p>}
      {rader && !synliga.length && <p className="text-sm text-slate-500">Inga konton matchar.</p>}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {synliga.map((r, i) => {
          const klass = r.konto[0];
          const nyKlass = i === 0 || synliga[i - 1].konto[0] !== klass;
          return (
            <div key={r.konto}>
              {nyKlass && (
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50">
                  {klass} · {KLASSER[klass] ?? ''}
                </p>
              )}
              <button onClick={() => setOppet({ konto: r.konto, ny: false })}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex gap-3 items-baseline">
                <span className="font-mono text-sm text-slate-900 w-12 shrink-0">{r.konto}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-900">{r.namn}</span>
                  {r.status === 'andrad' && <span className="ml-2 text-[11px] text-blue-700">ändrad</span>}
                  {r.status === 'ny' && <span className="ml-2 text-[11px] text-emerald-700">tillagd</span>}
                  <span className="block text-xs text-slate-500 truncate">{r.beskrivning}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {oppet && (
        <KontoRuta key={oppet.konto || 'ny'} konto={oppet.konto} ny={oppet.ny} onStang={() => setOppet(null)} onSparad={ladda} />
      )}
    </div>
  );
}
