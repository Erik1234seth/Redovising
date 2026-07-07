'use client';

import Link from 'next/link';
import { useState } from 'react';

const CORAL = '#E95C63';
const BLUE = '#2563EB';

type Post = { id: number; beskrivning: string; belopp: string; typ: 'kostnad' | 'inkomst' };

let nextId = 1;

export default function PeriodiseringPage() {
  const [poster, setPoster] = useState<Post[]>([{ id: nextId++, beskrivning: '', belopp: '', typ: 'kostnad' }]);
  const [sparad, setSparad] = useState(false);

  const updatePost = (id: number, field: keyof Post, value: string) => {
    setPoster(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    setSparad(false);
  };

  const addRow = () => {
    setPoster(prev => [...prev, { id: nextId++, beskrivning: '', belopp: '', typ: 'kostnad' }]);
    setSparad(false);
  };

  const removeRow = (id: number) => {
    if (poster.length > 1) setPoster(prev => prev.filter(p => p.id !== id));
  };

  const allFilled = poster.every(p => p.beskrivning.trim() && p.belopp.trim());

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
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Periodisering</h1>
          <p className="text-sm text-slate-400 mt-0.5">Kostnader och inkomster som gäller ett annat år</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">

          {/* Intro */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              En kostnad eller inkomst ska redovisas det år den <span className="font-semibold text-slate-800">hör till</span>, inte när du betalar eller får betalt. Att fördela dem rätt kallas periodisering och påverkar ditt resultat.
            </p>
          </div>

          {/* Steg 1 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start gap-4 px-6 py-5">
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-blue-600">Steg 1</span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-bold text-slate-800 mb-1">Identifiera vad som gäller fel år</p>
                <p className="text-sm text-slate-500 leading-relaxed">Gå igenom dina kostnader och inkomster och se om något gäller ett annat räkenskapsår. Vanliga exempel:</p>
                <div className="mt-3 space-y-2">
                  {[
                    'Försäkringar betalda i förväg (gäller delvis nästa år)',
                    'Fakturor skickade men arbetet är inte utfört än',
                    'Hyra eller abonnemang som sträcker sig över årsskiftet',
                    'Arbete utfört men ännu inte fakturerat',
                  ].map(ex => (
                    <div key={ex} className="flex items-start gap-2 text-sm text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                      {ex}
                    </div>
                  ))}
                </div>
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
                <p className="text-sm font-bold text-slate-800 mb-1">Räkna ut beloppet som gäller fel år</p>
                <p className="text-sm text-slate-500 leading-relaxed">Dela upp beloppet proportionellt. En försäkring på 12 000 kr som gäller jan–dec nästa år ska periodiseras med hela 12 000 kr. En som gäller jul–jun ska delas på hälften.</p>
              </div>
            </div>
          </div>

          {/* Steg 3 — lista + skicka */}
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
                <p className="text-sm text-slate-500 leading-relaxed mb-4">Välj hur du vill lämna in:</p>

                {/* Alternativ A — lista */}
                <div className="rounded-xl border border-slate-200 px-4 py-4 mb-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Alternativ A — Fyll i listan</p>

                  {sparad ? (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-800">{poster.length} post{poster.length !== 1 ? 'er' : ''} sparade</p>
                        <button onClick={() => setSparad(false)} className="text-xs text-blue-500 hover:text-blue-700 mt-0.5">Ändra</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_100px_110px_32px] gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
                        <span>Beskrivning</span>
                        <span>Belopp (kr)</span>
                        <span>Typ</span>
                        <span />
                      </div>
                      {poster.map(p => (
                        <div key={p.id} className="grid grid-cols-[1fr_100px_110px_32px] gap-2 items-center">
                          <input
                            type="text"
                            value={p.beskrivning}
                            onChange={e => updatePost(p.id, 'beskrivning', e.target.value)}
                            placeholder="t.ex. Försäkring jan–jun"
                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                          />
                          <input
                            type="number"
                            value={p.belopp}
                            onChange={e => updatePost(p.id, 'belopp', e.target.value)}
                            placeholder="0"
                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                          />
                          <select
                            value={p.typ}
                            onChange={e => updatePost(p.id, 'typ', e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                          >
                            <option value="kostnad">Kostnad</option>
                            <option value="inkomst">Inkomst</option>
                          </select>
                          <button
                            onClick={() => removeRow(p.id)}
                            disabled={poster.length === 1}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={addRow}
                          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Lägg till rad
                        </button>
                        <button
                          onClick={() => { if (allFilled) setSparad(true); }}
                          disabled={!allFilled}
                          className="ml-auto px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                          style={{ backgroundColor: BLUE }}
                        >
                          Spara
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Alternativ B — mail */}
                <div className="rounded-xl border border-slate-200 px-4 py-4">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Alternativ B — Skicka via mail</p>
                  <p className="text-xs text-slate-400 mb-3">Beskriv vad det gäller och vilket belopp i ett mail till oss.</p>
                  <a
                    href="mailto:erik@enklabokslut.se"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: CORAL, color: 'white' }}
                  >
                    Skicka via mail
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>

              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm font-bold text-slate-700 mb-3">Bra att tänka på</p>
            <div className="space-y-2">
              {[
                'Periodisering kallas förutbetalda kostnader, upplupna intäkter eller omvänt',
                'Beloppet ska spegla den del som verkligen gäller räkenskapsåret',
                'Är du osäker — skriv vad det gäller så hjälper vi dig räkna ut beloppet',
                'Periodiseringar påverkar både resultat- och balansrapporten',
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
