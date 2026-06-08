'use client';

import Link from 'next/link';

const NAV_BG = '#173b57';

export default function UnderlagGuidePage() {
  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="max-w-2xl mx-auto w-full px-6 py-10">

        {/* Tillbaka */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-8 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </Link>

        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-1">
          Maila in ditt underlag
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          Skicka in dina kvitton och fakturor via mail — vi sköter resten.
        </p>

        {/* Hur det fungerar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Så här gör du</h2>
          <ol className="flex flex-col gap-4">
            {[
              {
                nr: '1',
                title: 'Samla ihop dina underlag',
                desc: 'Kvitton, fakturor och kontoutdrag — det räcker med foton eller skannade PDF:er.',
              },
              {
                nr: '2',
                title: 'Maila dem till oss',
                desc: 'Skicka filerna som bilagor till ekonomi@enklabokslut.se. Ange gärna vilket kvartal eller månad det gäller i ämnesraden.',
              },
              {
                nr: '3',
                title: 'Vi går igenom underlaget',
                desc: 'Vi kontrollerar filerna och återkommer om vi saknar något. Bokföringen syns sen här på hemsidan.',
              },
            ].map(step => (
              <li key={step.nr} className="flex gap-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: NAV_BG }}
                >
                  {step.nr}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{step.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Vad vi tar emot */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Vi tar emot</h2>
          <div className="grid grid-cols-2 gap-2">
            {['PDF', 'JPG / PNG', 'Excel (.xlsx)', 'CSV', 'Kontoutdrag', 'Scannningar'].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Mailaknapp */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-bold text-slate-700 mb-1">Skicka in nu</h2>
          <p className="text-xs text-slate-500 mb-5">
            Öppnar din e-postklient med rätt adress ifylld.
          </p>
          <a
            href="mailto:ekonomi@enklabokslut.se?subject=Underlag bokföring"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: NAV_BG }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Maila till ekonomi@enklabokslut.se
          </a>
        </div>

        {/* Info om hemsidan */}
        <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 bg-slate-100">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-slate-500 leading-relaxed">
            Du kan alltid bokföra direkt på hemsidan under <span className="font-medium text-slate-600">Bokföra</span> — oavsett om du också mailar in underlag.
          </p>
        </div>

      </div>
    </div>
  );
}
