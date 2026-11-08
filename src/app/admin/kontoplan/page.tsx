'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KontoRuta } from '../_k1-konto';

/**
 * Kontoplanen: alla K1-konton som konteringen får välja, med byråns ändringar
 * och tillagda konton. Klick på ett konto öppnar samma ruta som i Flöde och
 * Kontering. Hela kontobeskrivningarna kan laddas ner som JSON (som k1.json)
 * eller xlsx (samma form som filen k1.json byggs från, se scripts/k1-till-json.mjs).
 *
 * Importera tar en fil med samma struktur (@/lib/kontering/k1-import): först
 * visas vad som skulle ändras, sedan sparas det när man trycker Importera.
 */

interface Importplan {
  andrade: { konto: string; namn: string; falt: string[] }[];
  nya: { konto: string; namn: string }[];
  ogiltiga: { konto: string; fel: string }[];
  oforandrade: number;
  iFilen: number;
}

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
  const [importFil, setImportFil] = useState<File | null>(null);

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
        <label className="text-sm border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-slate-700 hover:border-slate-400 cursor-pointer">
          Importera
          <input type="file" accept=".xlsx,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImportFil(f); }} />
        </label>
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

      {importFil && <Import fil={importFil} onStang={() => setImportFil(null)} onKlar={ladda} />}

      {oppet && (
        <KontoRuta key={oppet.konto || 'ny'} konto={oppet.konto} ny={oppet.ny} onStang={() => setOppet(null)} onSparad={ladda} />
      )}
    </div>
  );
}

/** Visar vad filen ändrar och sparar det när man trycker Importera. */
function Import({ fil, onStang, onKlar }: { fil: File; onStang: () => void; onKlar: () => void }) {
  const [plan, setPlan] = useState<Importplan | null>(null);
  const [fel, setFel] = useState('');
  const [sparar, setSparar] = useState(false);
  const [klar, setKlar] = useState(false);
  const skickad = useRef(false);

  const skicka = useCallback(async (spara: boolean) => {
    const form = new FormData();
    form.append('fil', fil);
    if (spara) form.append('spara', '1');
    const d = await (await fetch('/api/admin/k1-konto', { method: 'POST', body: form })).json();
    if (d.error) throw new Error(d.error);
    return d as Importplan;
  }, [fil]);

  useEffect(() => {
    if (skickad.current) return;
    skickad.current = true;
    skicka(false).then(setPlan).catch((err) => setFel(err instanceof Error ? err.message : String(err)));
  }, [skicka]);

  async function importera() {
    setSparar(true);
    setFel('');
    try {
      setPlan(await skicka(true));
      setKlar(true);
      onKlar();
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err));
    } finally {
      setSparar(false);
    }
  }

  const antal = plan ? plan.andrade.length + plan.nya.length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onStang}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Importera {fil.name}</h2>
          <button onClick={onStang} className="ml-auto text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Stäng">×</button>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm">
          {!plan && !fel && <p className="text-slate-500">Läser filen…</p>}
          {plan && (
            <>
              <p className="text-slate-600">
                {plan.iFilen} konton i filen · {plan.oforandrade} oförändrade
                {klar ? ` · ${antal} importerade — gäller från nästa kontering` : ''}
              </p>
              {plan.nya.length > 0 && (
                <div>
                  <p className="font-medium text-emerald-700">Nya konton ({plan.nya.length})</p>
                  <ul className="mt-1 space-y-0.5 text-slate-900">
                    {plan.nya.map((k) => <li key={k.konto}><span className="font-mono">{k.konto}</span> {k.namn}</li>)}
                  </ul>
                </div>
              )}
              {plan.andrade.length > 0 && (
                <div>
                  <p className="font-medium text-blue-700">Ändrade konton ({plan.andrade.length})</p>
                  <ul className="mt-1 space-y-0.5 text-slate-900">
                    {plan.andrade.map((k) => (
                      <li key={k.konto}>
                        <span className="font-mono">{k.konto}</span> {k.namn}
                        <span className="text-slate-500"> — {k.falt.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.ogiltiga.length > 0 && (
                <div>
                  <p className="font-medium text-red-700">Hoppas över ({plan.ogiltiga.length})</p>
                  <ul className="mt-1 space-y-0.5 text-slate-900">
                    {plan.ogiltiga.map((k, i) => <li key={i}><span className="font-mono">{k.konto}</span> {k.fel}</li>)}
                  </ul>
                </div>
              )}
              {!antal && !klar && <p className="text-slate-500">Filen ändrar inget.</p>}
              <p className="text-xs text-slate-400">
                Namn, beskrivning och listorna importeras. Konton som saknas i filen rörs inte, och gränsvärdena följer inte med.
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-200">
          {fel && <span className="text-sm text-red-600">{fel}</span>}
          <button onClick={onStang} className="ml-auto text-sm text-slate-600 px-3 py-1.5">{klar ? 'Stäng' : 'Avbryt'}</button>
          {!klar && (
            <button onClick={importera} disabled={sparar || !antal} className="bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded disabled:opacity-40">
              {sparar ? 'Importerar…' : `Importera ${antal} ${antal === 1 ? 'konto' : 'konton'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
