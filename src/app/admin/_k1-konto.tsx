'use client';

import { useEffect, useState } from 'react';

/**
 * Ändra kontobeskrivningen för ett K1-konto. Öppnas när man klickar på ett
 * konto som AI:n valt, eller i kontoplanerna (/admin/kontoplan/lopande och
 * /bokslut). Ändringen läggs ovanpå k1.json (se @/lib/kontering/k1-andringar).
 * Konteringen läser den löpande kontoplanen, så klick i Flöde och Kontering
 * öppnar den.
 *
 * `ny` lägger till ett konto som inte finns i k1.json. Ett tillagt konto har
 * inget original, så "Återställ" blir "Ta bort kontot" — det försvinner ur
 * vyn men finns kvar i historiken.
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

const TOMT: Konto = {
  konto: '', namn: '', beskrivning: '', anvandNar: [], anvandInteNar: [], beslutsregler: [],
  varningar: [], exempel: [], granskningNar: [], nyckelord: [],
};

export function KontoRuta({ konto: kontoIn, variant = 'lopande', ny = false, onStang, onSparad }: {
  konto: string;
  /** Kontoplanen: löpande bokföring (som konteringen använder) eller bokslut */
  variant?: 'lopande' | 'bokslut';
  /** Ett nytt konto som inte är sparat än: inget laddas, kontonumret går att skriva */
  ny?: boolean;
  onStang: () => void;
  /** Efter spara, återställ eller ta bort — kontoplanen laddar om listan */
  onSparad?: () => void;
}) {
  const [konto, setKonto] = useState(kontoIn);
  const [ar, setAr] = useState<'laddar' | 'original' | 'tillagt' | 'osparat'>(ny ? 'osparat' : 'laddar');
  // Ett tillagt konto jämförs med tomt — allt i det är byråns text
  const [original, setOriginal] = useState<Konto | null>(ny ? TOMT : null);
  const [andradAt, setAndradAt] = useState<string | null>(null);
  const [namn, setNamn] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [listor, setListor] = useState<Record<Lista, string>>({} as Record<Lista, string>);
  const [laddfel, setLaddfel] = useState('');
  const [sparar, setSparar] = useState(false);
  const [sparfel, setSparfel] = useState('');
  const [sparad, setSparad] = useState(false);

  function fyll(k: Konto) {
    setNamn(k.namn);
    setBeskrivning(k.beskrivning);
    setListor(Object.fromEntries(LISTOR.map(({ falt }) => [falt, (k[falt] ?? []).join('\n')])) as Record<Lista, string>);
  }

  useEffect(() => {
    if (ny) return;
    fetch(`/api/admin/k1-konto?variant=${variant}&konto=${encodeURIComponent(kontoIn)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setOriginal(d.original ?? TOMT);
        setAr(d.original ? 'original' : 'tillagt');
        setAndradAt(d.andradAt);
        fyll(d.aktuell);
      })
      .catch((err) => setLaddfel(err instanceof Error ? err.message : String(err)));
  }, [kontoIn, ny, variant]);

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
        body: JSON.stringify({ variant, konto: konto.trim(), ny: ar === 'osparat', namn, beskrivning, ...Object.fromEntries(LISTOR.map(({ falt }) => [falt, rader(listor[falt] ?? '')])) }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setSparad(true);
      setAndradAt(new Date().toISOString());
      if (ar === 'osparat') setAr('tillagt');
      onSparad?.();
    } catch (err) {
      setSparfel(err instanceof Error ? err.message : String(err));
    } finally {
      setSparar(false);
    }
  }

  async function aterstall() {
    if (!original) return;
    if (ar === 'tillagt' && !confirm(`Ta bort konto ${konto} ${namn}? Det försvinner ur kontoplanen men finns kvar i historiken.`)) return;
    setSparar(true);
    setSparfel('');
    try {
      const res = await fetch(`/api/admin/k1-konto?variant=${variant}&konto=${encodeURIComponent(konto)}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      onSparad?.();
      if (ar === 'tillagt') { onStang(); return; }
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
          <h2 className="font-semibold text-slate-900">
            {ar === 'osparat' ? 'Nytt konto' : `Konto ${konto} ${namn}`}
          </h2>
          <span className="text-xs text-slate-500">{variant === 'bokslut' ? 'Bokslut' : 'Löpande bokföring'}</span>
          {ar === 'tillagt' && <span className="text-xs text-emerald-700">Tillagt av byrån</span>}
          {andradAt && <span className="text-xs text-blue-700">{ar === 'tillagt' ? 'Sparat' : 'Ändrad av byrån'} {DATUM.format(new Date(andradAt))}</span>}
          <button onClick={onStang} className="ml-auto text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Stäng">×</button>
        </div>
        {laddfel ? <p className="px-5 py-4 text-sm text-red-600">{laddfel}</p> : !original ? <p className="px-5 py-4 text-sm text-slate-500">Laddar…</p> : (
          <div className="px-5 py-4 space-y-4 text-sm">
            <p className="text-slate-500 text-xs">
              {variant === 'bokslut'
                ? 'Kontobeskrivningen i bokslutets kontoplan. En punkt per rad i listorna.'
                : 'Det AI:n läser om kontot. En punkt per rad i listorna. Ändringen gäller från nästa kontering, också i dagens flöde.'}
            </p>
            <div className="flex gap-3">
              <label className="block w-28">
                <span className="font-medium text-slate-700">Konto</span>
                <input value={konto} onChange={(e) => setKonto(e.target.value)} disabled={ar !== 'osparat'} inputMode="numeric" maxLength={4}
                  placeholder="1234" autoFocus={ar === 'osparat'}
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-600" />
              </label>
              <label className="block flex-1">
                <span className={`font-medium ${namn.trim() !== original.namn ? 'text-blue-700' : 'text-slate-700'}`}>Namn</span>
                <input value={namn} onChange={(e) => setNamn(e.target.value)}
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-slate-900 bg-white" />
              </label>
            </div>
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
          {ar === 'osparat' && !sparfel && <span className="text-sm text-slate-500">Kontonummer, namn och beskrivning krävs, resten kan fyllas i senare</span>}
          {andradAt && (
            <button onClick={aterstall} disabled={sparar} className="text-sm text-slate-500 hover:text-red-600 disabled:opacity-40">
              {ar === 'tillagt' ? 'Ta bort kontot' : 'Återställ till originalet'}
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
