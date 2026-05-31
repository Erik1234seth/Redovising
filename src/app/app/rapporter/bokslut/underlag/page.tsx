'use client';

import Link from 'next/link';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';
const BLUE = '#2563EB';

const underlagTypes = [
  {
    title: 'Försäljning & intäkter',
    desc: 'Allt som kommit in i företaget under året.',
    examples: ['Fakturor du skickat', 'Kontantförsäljning', 'Swish-betalningar', 'Bankinsättningar från kunder'],
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    title: 'Kostnader & utgifter',
    desc: 'Allt som gått ut ur företaget under året.',
    examples: ['Kvitton och fakturor', 'Bankutdrag', 'Kortransaktioner', 'Hyra, abonnemang, material'],
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    title: 'Bankutdrag',
    desc: 'Kontoutdrag för hela räkenskapsåret.',
    examples: ['Kontoutdrag jan–dec', 'Sparkonto om du har ett', 'Företagskort', 'Digitala betaltjänster (Stripe, PayPal)'],
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    title: 'Löner & egenavgifter',
    desc: 'Om du tagit ut lön eller gjort egna uttag.',
    examples: ['Lönespecifikationer', 'Skattedeklarationer', 'Preliminärskatt betald', 'Egenavgifter'],
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
];

export default function UnderlagPage() {
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
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Samla ditt underlag</h1>
          <p className="text-sm text-slate-400 mt-0.5">Vi behöver det här för att göra ett korrekt bokslut</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">

          {/* Intro */}
          <div className="bg-white rounded-2xl border border-slate-200 px-7 py-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              För att vi ska kunna bokföra rätt och göra ett korrekt bokslut behöver vi underlag för <span className="font-semibold text-slate-800">allt som påverkat företaget ekonomiskt</span> under året. Nedan ser du vad som behövs — samla det du har och skicka till oss.
            </p>
          </div>

          {/* Underlagstyper */}
          {underlagTypes.map(u => (
            <div key={u.title} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: u.bg }}>
                  <svg className="w-5 h-5" style={{ color: u.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={u.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{u.title}</p>
                  <p className="text-xs text-slate-400">{u.desc}</p>
                </div>
              </div>
              <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-2">
                {u.examples.map(ex => (
                  <div key={ex} className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: u.color }} />
                    {ex}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* CTA */}
          <div
            className="rounded-2xl px-7 py-7 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${NAV_BG} 0%, #1e5278 100%)` }}
          >
            <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10" style={{ background: CORAL }} />
            <div className="relative">
              <p className="text-white font-extrabold text-lg mb-1">Redo att skicka in?</p>
              <p className="text-white/55 text-sm leading-relaxed mb-5 max-w-sm">
                Skicka ditt underlag till oss via mail så tar vi hand om resten och återkommer till dig.
              </p>
              <a
                href="mailto:hej@enklabok.se"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                style={{ backgroundColor: CORAL, color: 'white' }}
              >
                Skicka underlag
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
