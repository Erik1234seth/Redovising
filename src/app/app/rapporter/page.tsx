'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const mainReports = [
  {
    href: '/rapporter/resultatrapport',
    title: 'Resultatrapport',
    desc: 'Vinst eller förlust under perioden.',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    href: '/rapporter/balansrapport',
    title: 'Balansrapport',
    desc: 'Vad du äger och vad du är skyldig.',
    icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    href: '/rapporter/momsredovisning',
    title: 'Momsredovisning',
    desc: 'Moms att betala eller få tillbaka.',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    href: '/rapporter/transaktionslista',
    title: 'Transaktionslista',
    desc: 'Alla händelser i en sökbar lista.',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    color: '#0891B2',
    bg: '#ECFEFF',
  },
  {
    href: '/rapporter/kontosaldo',
    title: 'Kontosaldo',
    desc: 'Siffror bakom alla rapporter.',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    color: '#B45309',
    bg: '#FEF3C7',
  },
  {
    href: '/rapporter/historik',
    title: 'Historik',
    desc: 'Rapporter från tidigare år.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#475569',
    bg: '#F1F5F9',
  },
];

const bokslutsteps = [
  {
    id: 1,
    title: 'Registrera alla transaktioner',
    desc: 'Gå igenom ditt bankkonto och se till att alla intäkter och utgifter finns inlagda.',
    link: '/bokforing',
    linkLabel: 'Gå till bokföring',
    color: '#2563EB',
  },
  {
    id: 2,
    title: 'Stäm av momsredovisningen',
    desc: 'Kontrollera att momsbeloppet stämmer och lämna in till Skatteverket om det är dags.',
    link: '/rapporter/momsredovisning',
    linkLabel: 'Öppna momsredovisning',
    color: '#D97706',
  },
  {
    id: 3,
    title: 'Granska resultatrapporten',
    desc: 'Se om vinsten eller förlusten stämmer med hur du upplevt året.',
    link: '/rapporter/resultatrapport',
    linkLabel: 'Öppna resultatrapport',
    color: '#059669',
  },
  {
    id: 4,
    title: 'Ladda upp förra årets NE-bilaga',
    desc: 'Är det ditt första år hoppar du över det här steget.',
    link: '/rapporter/ne-bilaga',
    linkLabel: 'Öppna NE-bilaga',
    color: '#7C3AED',
  },
  {
    id: 5,
    title: 'Ladda ned din NE-bilaga',
    desc: 'Din NE-bilaga är klar. Ladda ned den som PDF.',
    link: '/rapporter/ne-bilaga',
    linkLabel: 'Ladda ned PDF',
    color: '#7C3AED',
  },
  {
    id: 6,
    title: 'Lämna in deklarationen',
    desc: 'Logga in på Skatteverket och bifoga NE-bilagan till din inkomstdeklaration (INK1).',
    link: 'https://www.skatteverket.se',
    linkLabel: 'Till Skatteverket',
    color: '#059669',
  },
];

const year = new Date().getFullYear();

type View = null | 'rapporter' | 'bokslut';

export default function RapporterLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get('v') as View) ?? null;

  const setView = (v: View) => {
    if (v === null) router.push('/rapporter');
    else router.push(`/rapporter?v=${v}`);
  };

  const [checked, setChecked] = useState<number[]>([]);

  const toggle = (id: number) =>
    setChecked(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const progress = Math.round((checked.length / bokslutsteps.length) * 100);

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* Header */}
      <div className="px-8 pt-12 pb-4 flex items-start justify-between flex-shrink-0">
        <div className="flex items-start gap-3">
          {view && (
            <button
              onClick={() => setView(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0 mt-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              {view === 'rapporter' ? 'Rapporter' : view === 'bokslut' ? 'Bokslut' : 'Rapporter & Bokslut'}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Räkenskapsår {year} · Uppdateras automatiskt</p>
          </div>
        </div>
        {view === 'bokslut' && (
          <div className="flex items-center gap-3 mt-2">
            <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#22c55e' : CORAL }}
              />
            </div>
            <span className="text-xs font-medium text-slate-400">{checked.length}/{bokslutsteps.length}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Startvy */}
          {view === null && (
            <div className="grid grid-cols-2 gap-[4.5rem] h-full">

              {/* Rapporter-kort */}
              <button
                onClick={() => setView('rapporter')}
                className="group text-left bg-white rounded-2xl border border-slate-200 p-9 hover:border-blue-200 hover:shadow-lg transition-all duration-200 relative overflow-hidden w-full flex flex-col"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%)' }}
                />
                <div className="relative flex flex-col h-full">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-xl font-extrabold text-slate-800 mb-2">Rapporter</p>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 min-h-[3rem]">
                    Se hur din ekonomi ser ut just nu — alltid uppdaterat.
                  </p>
                  <div className="space-y-2">
                    {mainReports.map(r => (
                      <div key={r.href} className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                        {r.title}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-auto pt-8 text-sm font-semibold text-blue-600">
                    Öppna rapporter
                    <svg className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Bokslut-kort */}
              <button
                onClick={() => setView('bokslut')}
                className="group text-left bg-white rounded-2xl border border-slate-200 p-9 hover:border-emerald-200 hover:shadow-lg transition-all duration-200 relative overflow-hidden w-full flex flex-col"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 55%)' }}
                />
                <div className="relative flex flex-col h-full">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <p className="text-xl font-extrabold text-slate-800 mb-2">Bokslut</p>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 min-h-[3rem]">
                    Stäng räkenskapsåret steg för steg. Checklista som guidar dig hela vägen till inlämnad deklaration.
                  </p>
                  <div className="space-y-2">
                    {['Stäm av transaktioner', 'Kontrollera moms', 'Ladda ned NE-bilaga', 'Lämna in deklaration'].map(r => (
                      <div key={r} className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        {r}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-auto pt-8 text-sm font-semibold text-emerald-600">
                    Starta bokslut
                    <svg className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Rapporter-vy */}
          {view === 'rapporter' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mainReports.map(r => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="group flex items-center gap-5 bg-white rounded-2xl border border-slate-200 px-7 py-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: r.bg }}>
                    <svg className="w-7 h-7" style={{ color: r.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={r.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-800">{r.title}</p>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{r.desc}</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}

          {/* Bokslut-vy */}
          {view === 'bokslut' && (
            <div className="space-y-3">
              {bokslutsteps.map((step, idx) => {
                const done = checked.includes(step.id);
                return (
                  <div
                    key={step.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${done ? 'border-green-200' : 'border-slate-200'}`}
                  >
                    <div className={`flex items-start gap-4 px-5 py-5 ${done ? 'opacity-60' : ''}`}>
                      {/* Step number / check */}
                      <button
                        onClick={() => toggle(step.id)}
                        className="flex-shrink-0 mt-0.5 transition-all duration-200"
                      >
                        {done ? (
                          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div
                            className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold hover:border-slate-400 transition-colors"
                            style={{ borderColor: step.color, color: step.color }}
                          >
                            {idx + 1}
                          </div>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {step.title}
                        </p>
                        {!done && (
                          <>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
                            <Link
                              href={step.link}
                              className="inline-flex items-center gap-1 mt-2.5 text-xs font-semibold hover:opacity-75 transition-opacity"
                              style={{ color: step.color }}
                            >
                              {step.linkLabel}
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {checked.length === bokslutsteps.length && (
                <div className="mt-2 flex items-center gap-4 bg-green-50 border border-green-200 rounded-2xl px-6 py-5">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-800">Bokslut klart!</p>
                    <p className="text-xs text-green-600 mt-0.5">Bra jobbat — glöm inte att lämna in deklarationen i tid.</p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
