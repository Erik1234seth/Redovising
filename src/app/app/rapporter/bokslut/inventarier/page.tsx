'use client';

import Link from 'next/link';
import { useState } from 'react';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';
const BLUE = '#2563EB';

type Inventarie = {
  id: number;
  namn: string;
  inkopsar: string;
  inkopspris: string;
  livslangd: string;
};

export default function InventarierPage() {
  const [inventarier, setInventarier] = useState<Inventarie[]>([
    { id: 1, namn: '', inkopsar: '', inkopspris: '', livslangd: '' },
  ]);
  const [sparad, setSparad] = useState(false);
  const [uppladdadFil, setUppladddadFil] = useState<File | null>(null);
  const [filSparad, setFilSparad] = useState(false);

  const updateRad = (id: number, field: keyof Inventarie, value: string) =>
    setInventarier(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const laggTillRad = () =>
    setInventarier(prev => [...prev, { id: Date.now(), namn: '', inkopsar: '', inkopspris: '', livslangd: '' }]);

  const taBortRad = (id: number) =>
    setInventarier(prev => prev.filter(r => r.id !== id));

  const allFilled = inventarier.length > 0 && inventarier.every(r => r.namn && r.inkopsar && r.inkopspris && r.livslangd);

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-4 flex items-start gap-3 flex-shrink-0">
        <Link
          href="/rapporter?v=bokslut"
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0 mt-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Inventarielista</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fyll i utrustning och maskiner som företaget äger</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">

          {/* Intro */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              Allt företaget äger och använder i verksamheten ska vara med — datorer, telefoner, verktyg och maskiner. Vi räknar ut avskrivningarna åt dig.
            </p>
          </div>

          {/* Steg 1 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-blue-600">Steg 1</span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-slate-800 mb-1">Gå igenom vad företaget äger</p>
                <p className="text-sm text-slate-500 leading-relaxed">Ta med allt som används i verksamheten och som köptes för företagets pengar. Privata saker räknas inte.</p>
              </div>
            </div>
          </div>

          {/* Steg 2 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-emerald-600">Steg 2</span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-slate-800 mb-1">Ta fram inköpspris och år</p>
                <p className="text-sm text-slate-500 leading-relaxed">Leta upp vad du betalade (exkl. moms) och vilket år du köpte det. Hittar du inte exakt pris är ett ungefärligt värde okej.</p>
              </div>
            </div>
          </div>

          {/* Steg 3 — med två alternativ */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-orange-500">Steg 3</span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-slate-800 mb-1">Skicka in till oss</p>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">Välj hur du vill lämna in din inventarielista:</p>

                {/* Alternativ A — fyll i tabell */}
                <div className="rounded-xl border border-slate-200 overflow-hidden mb-3">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Alternativ A — Fyll i listan här</p>
                  </div>

                  {/* Kolumnrubriker */}
                  <div className="grid grid-cols-[1fr_90px_110px_100px_36px] gap-2 px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-400">Namn</p>
                    <p className="text-xs font-semibold text-slate-400">Inköpsår</p>
                    <p className="text-xs font-semibold text-slate-400">Inköpspris</p>
                    <p className="text-xs font-semibold text-slate-400">Livslängd</p>
                    <div />
                  </div>

                  <div className="divide-y divide-slate-50">
                    {inventarier.map(rad => (
                      <div key={rad.id} className="grid grid-cols-[1fr_90px_110px_100px_36px] gap-2 px-4 py-2.5 items-center">
                        <input
                          type="text"
                          value={rad.namn}
                          onChange={e => updateRad(rad.id, 'namn', e.target.value)}
                          placeholder="t.ex. Laptop"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                        />
                        <input
                          type="number"
                          value={rad.inkopsar}
                          onChange={e => updateRad(rad.id, 'inkopsar', e.target.value)}
                          placeholder="2023"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                        />
                        <div className="relative">
                          <input
                            type="number"
                            value={rad.inkopspris}
                            onChange={e => updateRad(rad.id, 'inkopspris', e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">kr</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={rad.livslangd}
                            onChange={e => updateRad(rad.id, 'livslangd', e.target.value)}
                            placeholder="5"
                            className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">år</span>
                        </div>
                        {inventarier.length > 1 ? (
                          <button
                            onClick={() => taBortRad(rad.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ) : <div />}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={laggTillRad}
                      className="flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-75"
                      style={{ color: BLUE }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Lägg till rad
                    </button>
                    {sparad ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: BLUE }}>
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-blue-700">Sparad</span>
                        <button onClick={() => setSparad(false)} className="text-xs text-slate-400 hover:text-slate-600 ml-1">Ändra</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { if (allFilled) setSparad(true); }}
                        disabled={!allFilled}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ backgroundColor: BLUE }}
                      >
                        Spara
                      </button>
                    )}
                  </div>
                </div>

                {/* Alternativ B — ladda upp */}
                <div className="rounded-xl border border-slate-200 px-4 py-4">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Alternativ B — Ladda upp befintlig lista</p>
                  {filSparad && uppladdadFil ? (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-800 truncate">{uppladdadFil.name}</p>
                        <button onClick={() => { setUppladddadFil(null); setFilSparad(false); }} className="text-xs text-blue-500 hover:text-blue-700 mt-0.5">Ta bort</button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl px-6 py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-all">
                      <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p className="text-sm font-medium text-slate-500">Dra och släpp eller <span style={{ color: BLUE }}>välj fil</span></p>
                      <p className="text-xs text-slate-400">Excel, PDF, JPG eller PNG</p>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null;
                          setUppladddadFil(f);
                          if (f) setFilSparad(true);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm font-bold text-slate-700 mb-3">Bra att tänka på</p>
            <div className="space-y-2">
              {[
                'Dyra saker (över ca 28 000 kr) skrivs av under flera år — vi hanterar det',
                'Gamla eller utslitna inventarier kan skrivas ned i värde',
                'Spara dina kvitton — Skatteverket kan begära dem',
                'Inventarier ingår i balansrapporten som en tillgång',
              ].map(tip => (
                <div key={tip} className="flex items-start gap-2 text-sm text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                  {tip}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
