'use client';

import Link from 'next/link';
import { useState } from 'react';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';
const BLUE = '#2563EB';

export default function LagerPage() {
  const [lagervarde, setLagervarde] = useState('');
  const [sparad, setSparad] = useState(false);

  const handleSpara = () => {
    if (lagervarde.trim()) setSparad(true);
  };

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
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Redovisa ditt lager</h1>
          <p className="text-sm text-slate-400 mt-0.5">Så här gör du en korrekt lagerinventering inför bokslutet</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">

          {/* Intro */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              Lagrets värde vid årets slut påverkar ditt resultat. Att inventera noggrant säkerställer att bokslutet stämmer och att du inte betalar för mycket eller för lite skatt.
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
                <p className="text-sm font-bold text-slate-800 mb-1">Räkna ditt lager</p>
                <p className="text-sm text-slate-500 leading-relaxed">Gå igenom allt du har i lager på årets sista dag. Räkna antal och notera varje artikel.</p>
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
                <p className="text-sm font-bold text-slate-800 mb-1">Beräkna inköpspriset</p>
                <p className="text-sm text-slate-500 leading-relaxed">Lagret värderas till inköpspris (vad du betalade för varorna). Om du tillverkar själv räknar du in material och direkta kostnader.</p>
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
                <p className="text-sm text-slate-500 leading-relaxed mb-4">Välj hur du vill lämna in ditt lagervärde:</p>

                {/* Alternativ A — ange totalt värde */}
                <div className="rounded-xl border border-slate-200 px-4 py-4 mb-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Alternativ A — Ange totalt lagervärde</p>
                  {sparad ? (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-800">
                          Sparat: {Number(lagervarde).toLocaleString('sv-SE')} kr
                        </p>
                        <button onClick={() => setSparad(false)} className="text-xs text-blue-500 hover:text-blue-700 mt-0.5">Ändra</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={lagervarde}
                          onChange={e => setLagervarde(e.target.value)}
                          placeholder="0"
                          className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">kr</span>
                      </div>
                      <button
                        onClick={handleSpara}
                        disabled={!lagervarde.trim()}
                        className="px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ backgroundColor: BLUE }}
                      >
                        Spara
                      </button>
                    </div>
                  )}
                </div>

                {/* Alternativ B — skicka lista */}
                <div className="rounded-xl border border-slate-200 px-4 py-4">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Alternativ B — Skicka detaljerad lista</p>
                  <p className="text-xs text-slate-400 mb-3">Sammanställ artiklar, antal och inköpspris i Excel, PDF eller ett vanligt mail.</p>
                  <a
                    href="mailto:erik@enklabokslut.se"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: CORAL, color: 'white' }}
                  >
                    Skicka lagerlista via mail
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
                'Värdera lagret till det lägsta av inköpspris och verkligt värde',
                'Gamla eller osäljbara varor kan skrivas ned i värde',
                'Spara din inventeringslista — Skatteverket kan begära den',
                'Lagret ingår i balansrapporten som en tillgång',
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
