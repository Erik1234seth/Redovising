'use client';

import { useEffect, useState } from 'react';

/**
 * Ändra kontobeskrivningen för ett K1-konto. Öppnas när man klickar på ett
 * konto som AI:n valt. Ändringen gäller från nästa kontering — den läggs ovanpå
 * k1.json (se @/lib/kontering/k1-andringar).
 *
 * Listorna skrivs en punkt per rad.
 */

interface Konto {
  konto: string;
  namn: string;
  beskrivning: string;
  anvandNar: string[];
  anvandInteNar: string[];
  beslutsregler: string[];
  varningar: string[];
  exempel: string[];
  granskningNar: string[];
  nyckelord: string[];
}

type Lista = 'anvandNar' | 'anvandInteNar' | 'beslutsregler' | 'varningar' | 'exempel' | 'granskningNar' | 'nyckelord';

const LISTOR: { falt: Lista; rubrik: string }[] = [
  { falt: 'anvandNar', rubrik: 'Använd när' },
  { falt: 'anvandInteNar', rubrik: 'Använd INTE när' },
  { falt: 'beslutsregler', rubrik: 'Beslutsregler' },
  { falt: 'varningar', rubrik: 'Varningar' },
  { falt: 'exempel', rubrik: 'Exempel' },
  { falt: 'granskningNar', rubrik: 'Kräver manuell granskning när' },
  { falt: 'nyckelord', rubrik: 'Sökord' },
];

const DATUM = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Kontonumret som en knapp som öppnar beskrivningen. */
export function KontoLank({ konto, children, className = '' }: { konto: string; children?: React.ReactNode; className?: string }) {
  const [oppen, setOppen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOppen(true); }}
        title="Visa och ändra kontobeskrivningen"
        className={`hover:underline decoration-dotted underline-offset-2 text-left ${className}`}
      >
        {children ?? konto}
      </button>
      {oppen && <KontoRuta konto={konto} onStang={() => setOppen(false)} />}
    </>
  );
}

function KontoRuta({ konto, onStang }: { konto: string; onStang: () => void }) {
  const [original, setOriginal] = useState<Konto | null>(null);
  const [andradAt, setAndradAt] = useState<string | null>(null);
  const [beskrivning, setBeskrivning] = useState('');
  const [listor, setListor] = useState<Record<Lista, string>>({} as Record<Lista, string>);
  const [laddfel, setLaddfel] = useState('');
  const [sparar, setSparar] = useState(false);
  const [sparfel, setSparfel] = useState('');
  const [sparad, setSparad] = useState(false);

  function fyll(k: Konto) {
    setBeskrivning(k.beskrivning);
    setListor(Object.fromEntries(LISTOR.map(({ falt }) => [falt, (k[falt] ?? []).join('\n')])) as Record<Lista, string>);
  }

  useEffect(() => {
    fetch(`/api/admin/k1-konto?konto=${encodeURIComponent(konto)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setOriginal(d.original);
        setAndradAt(d.andradAt);
        fyll(d.aktuell);
      })
      .catch((err) => setLaddfel(err instanceof Error ? err.message : String(err)));
  }, [konto]);

  // Esc stänger
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape') onStang(); };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [onStang]);

  const rader = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const andrat = (falt: Lista) => !!original && JSON.stringify(rader(listor[falt] ?? '')) !== JSON.stringify(original[falt]);

  async function spara() {
    setSparar(true);
    setSparfel('');
    setSparad(false);
    try {
      const res = await fetch('/api/admin/k1-konto', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ konto, beskrivning, ...Object.fromEntries(LISTOR.map(({ falt }) => [falt, rader(listor[falt] ?? '')])) }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setSparad(true);
      setAndradAt(new Date().toISOString());
    } catch (err) {
      setSparfel(err instanceof Error ? err.message : String(err));
    } finally {
      setSparar(false);
    }
  }

  async function aterstall() {
    if (!original) return;
    setSparar(true);
    setSparfel('');
    try {
      const res = await fetch(`/api/admin/k1-konto?konto=${encodeURIComponent(konto)}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      fyll(original);
      setAndradAt(null);
      setSparad(true);
    } catch (err) {
      setSparfel(err instanceof Error ? err.message : String(err));
    } finally {
      setSparar(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onStang}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline gap-3 px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Konto {konto}{original ? ` ${original.namn}` : ''}</h2>
          {andradAt && <span className="text-xs text-blue-700">Ändrad av byrån {DATUM.format(new Date(andradAt))}</span>}
          <button onClick={onStang} className="ml-auto text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Stäng">×</button>
        </div>
        {laddfel ? <p className="px-5 py-4 text-sm text-red-600">{laddfel}</p> : !original ? <p className="px-5 py-4 text-sm text-slate-500">Laddar…</p> : (
          <div className="px-5 py-4 space-y-4 text-sm">
            <p className="text-slate-500 text-xs">
              Det AI:n läser om kontot. En punkt per rad i listorna. Ändringen gäller från nästa kontering, också i dagens flöde.
            </p>
            <label className="block">
              <span className={`font-medium ${beskrivning.trim() !== original.beskrivning ? 'text-blue-700' : 'text-slate-700'}`}>Beskrivning</span>
              <textarea value={beskrivning} onChange={(e) => setBeskrivning(e.target.value)} rows={3}
                className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-slate-900 bg-white" />
            </label>
            {LISTOR.map(({ falt, rubrik }) => (
              <label key={falt} className="block">
                <span className={`font-medium ${andrat(falt) ? 'text-blue-700' : 'text-slate-700'}`}>{rubrik}{andrat(falt) ? ' (ändrad)' : ''}</span>
                <textarea
                  value={listor[falt] ?? ''}
                  onChange={(e) => setListor((l) => ({ ...l, [falt]: e.target.value }))}
                  rows={Math.min(12, Math.max(2, (listor[falt] ?? '').split('\n').length + 1))}
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 font-[inherit] text-slate-900 bg-white"
                />
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-200">
          {sparfel && <span className="text-sm text-red-600">{sparfel}</span>}
          {sparad && !sparfel && <span className="text-sm text-emerald-700">Sparat — gäller från nästa kontering</span>}
          {andradAt && (
            <button onClick={aterstall} disabled={sparar} className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-40">
              Återställ till originalet
            </button>
          )}
          <button onClick={onStang} className="ml-auto text-sm text-slate-600 px-3 py-1.5">Stäng</button>
          <button onClick={spara} disabled={sparar || !original} className="bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded disabled:opacity-40">
            {sparar ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}
