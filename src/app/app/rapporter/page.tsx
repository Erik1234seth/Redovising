'use client';

import Link from 'next/link';
import { useState } from 'react';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const mainReports = [
  {
    href: '/rapporter/resultatrapport',
    title: 'Resultatrapport',
    desc: 'Se om din verksamhet går med vinst eller förlust under perioden.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    href: '/rapporter/balansrapport',
    title: 'Balansrapport',
    desc: 'Vad du äger och vad du är skyldig — en ögonblicksbild av ekonomin.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    color: 'bg-blue-50 text-blue-600',
  },
  {
    href: '/rapporter/momsredovisning',
    title: 'Momsredovisning',
    desc: 'Hur mycket moms du ska betala eller få tillbaka från Skatteverket.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
    color: 'bg-orange-50 text-orange-600',
  },
  {
    href: '/rapporter/ne-bilaga',
    title: 'NE-bilaga',
    desc: 'Underlaget du bifogar till din deklaration. Skapas automatiskt.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'bg-slate-100 text-slate-600',
  },
];

const ovrigtReports = [
  {
    href: '/rapporter/transaktionslista',
    title: 'Transaktionslista',
    desc: 'Alla dina registrerade händelser i en sökbar lista.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    color: 'bg-violet-50 text-violet-600',
  },
  {
    href: '/rapporter/kontosaldo',
    title: 'Kontosaldo',
    desc: 'Detaljerad uppdelning av alla siffror bakom rapporterna.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    color: 'bg-amber-50 text-amber-600',
  },
  {
    href: '/rapporter/historik',
    title: 'Historik',
    desc: 'Dokument och rapporter från tidigare år.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'bg-slate-100 text-slate-600',
  },
];

const bokslutsteps = [
  {
    id: 1,
    title: 'Kolla att du har registrerat allt',
    desc: 'Gå igenom ditt bankkonto och se till att alla intäkter och utgifter finns inlagda i Bokföring.',
    link: '/bokforing',
    linkLabel: 'Gå till bokföring',
  },
  {
    id: 2,
    title: 'Stäm av din momsredovisning',
    desc: 'Kontrollera att momsbeloppet stämmer och lämna in till Skatteverket om det är dags.',
    link: '/rapporter/momsredovisning',
    linkLabel: 'Öppna momsredovisning',
  },
  {
    id: 3,
    title: 'Kolla om resultatet verkar rimligt',
    desc: 'Öppna resultatrapporten och se om vinsten eller förlusten stämmer med hur du upplevt året.',
    link: '/rapporter/resultatrapport',
    linkLabel: 'Öppna resultatrapport',
  },
  {
    id: 4,
    title: 'Ladda upp förra årets NE-bilaga',
    desc: 'Om du haft företag tidigare år — ladda upp förra årets bilaga så att beräkningarna blir rätt. Är det ditt första år hoppar du över det här steget.',
    link: '/rapporter/ne-bilaga',
    linkLabel: 'Öppna NE-bilaga',
  },
  {
    id: 5,
    title: 'Ladda ned din NE-bilaga',
    desc: 'Din NE-bilaga är klar och uppdaterad. Ladda ned den som PDF.',
    link: '/rapporter/ne-bilaga',
    linkLabel: 'Öppna NE-bilaga',
  },
  {
    id: 6,
    title: 'Lämna in deklarationen',
    desc: 'Logga in på Skatteverket och bifoga NE-bilagan till din inkomstdeklaration (INK1). Klart!',
    link: 'https://www.skatteverket.se',
    linkLabel: 'Skatteverket →',
  },
];

const year = new Date().getFullYear();

export default function RapporterLandingPage() {
  const [checked, setChecked] = useState<number[]>([]);
  const [showOvrigt, setShowOvrigt] = useState(false);

  const toggle = (id: number) => {
    setChecked(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 bg-white border-b border-slate-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Rapporter & Bokslut</h1>
        <p className="text-sm text-slate-400 mt-0.5">Räkenskapsår {year} · Uppdateras automatiskt</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Huvudrapporter */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Rapporter</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mainReports.map(r => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="flex items-start gap-4 bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${r.color}`}>
                    {r.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{r.desc}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>

            {/* Expanderbara övrigt-rapporter */}
            {showOvrigt && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ovrigtReports.map(r => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="flex items-start gap-4 bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all group"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${r.color}`}>
                      {r.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{r.desc}</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}

            {/* Toggle-knapp */}
            <button
              onClick={() => setShowOvrigt(o => !o)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showOvrigt ? 'Visa mindre' : 'Visa fler rapporter'}
              <svg
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{ transform: showOvrigt ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </section>

          {/* Bokslutschecklista */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Förbered dig inför bokslut</h2>
              <span className="text-xs text-slate-400 font-medium">
                {checked.length}/{bokslutsteps.length} klart
              </span>
            </div>

            <div className="h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(checked.length / bokslutsteps.length) * 100}%`,
                  backgroundColor: checked.length === bokslutsteps.length ? '#22c55e' : CORAL,
                }}
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {bokslutsteps.map(step => {
                const done = checked.includes(step.id);
                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-4 px-5 py-4 transition-colors ${done ? 'bg-green-50/40' : ''}`}
                  >
                    <button
                      onClick={() => toggle(step.id)}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                        done ? 'border-green-500 bg-green-500' : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {done && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {step.title}
                      </p>
                      {!done && (
                        <>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                          <Link
                            href={step.link}
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium hover:opacity-80 transition-opacity"
                            style={{ color: NAV_BG }}
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
                );
              })}
            </div>

            {checked.length === bokslutsteps.length && (
              <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Bokslut klart!</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Bra jobbat! Glöm inte att lämna in deklarationen i tid.
                  </p>
                </div>
              </div>
            )}
          </section>


        </div>
      </div>
    </div>
  );
}
