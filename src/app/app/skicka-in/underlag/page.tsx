'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const STEPS = [
  {
    nr: 1,
    title: 'Samla ihop dina underlag',
    desc: 'Kvitton, fakturor och kontoutdrag — det räcker med foton eller skannade PDF:er.',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    nr: 2,
    title: 'Maila dem till oss',
    desc: 'Skicka filerna som bilagor till erik@enklabokslut.se. Ange gärna vilket kvartal eller månad det gäller i ämnesraden.',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    nr: 3,
    title: 'Vi sköter resten',
    desc: 'Vi kontrollerar filerna och återkommer om vi saknar något. Bokföringen syns sen direkt här på hemsidan.',
    color: '#059669',
    bg: '#ECFDF5',
  },
];

const FORMATS = [
  { label: 'PDF', icon: '📄' },
  { label: 'JPG / PNG', icon: '🖼️' },
  { label: 'Excel (.xlsx)', icon: '📊' },
  { label: 'CSV', icon: '📋' },
  { label: 'Kontoutdrag', icon: '🏦' },
  { label: 'Skanningar', icon: '🔍' },
];

export default function UnderlagGuidePage() {
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    navigator.clipboard.writeText('erik@enklabokslut.se');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d2236 0%, #173b57 100%)' }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="relative px-8 pt-10 pb-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-8">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
              Maila in underlag
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Maila in ditt underlag</h1>
          <p className="text-white/55 text-sm mt-2 leading-relaxed max-w-xs">
            Skicka in kvitton och fakturor via mail — vi bokför och håller dig uppdaterad.
          </p>
          <div className="flex gap-3 mt-7 flex-wrap">
            {[{ value: '3', label: 'steg' }, { value: '1–2 dagar', label: 'svarstid' }, { value: '6', label: 'filformat' }].map(s => (
              <div key={s.label} className="rounded-xl px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-white font-extrabold text-base leading-none">{s.value}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-12 max-w-2xl flex flex-col gap-5 mt-6">

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-6">Så här gör du</h2>
          <div className="relative">
            <div className="absolute left-[17px] top-9 bottom-4 w-0.5" style={{ background: 'linear-gradient(to bottom, #e2e8f0 60%, transparent)' }} />
            <div className="flex flex-col">
              {STEPS.map((step) => (
                <div key={step.nr} className="relative flex gap-5 pb-7 last:pb-0">
                  <div
                    className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-extrabold border-2 border-white shadow-sm"
                    style={{ backgroundColor: step.bg, color: step.color }}
                  >
                    {step.nr}
                  </div>
                  <div className="flex-1 pt-1.5">
                    <p className="font-bold text-slate-800 text-sm">{step.title}</p>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filformat */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-1">Vi tar emot</h2>
          <p className="text-xs text-slate-400 mb-4">Alla vanliga filformat fungerar.</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map(f => (
              <div key={f.label} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}12` }}>
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-semibold text-slate-600">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mail CTA */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f2840 0%, #173b57 100%)' }}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-white text-sm">Skicka in nu</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Vi svarar inom 1–2 arbetsdagar</p>
              </div>
            </div>

            <div className="rounded-xl px-5 py-3.5 flex items-center justify-between gap-3 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Mailadress</p>
                <p className="text-white font-bold text-sm">erik@enklabokslut.se</p>
              </div>
              <button
                onClick={copyEmail}
                className="text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all flex-shrink-0"
                style={{
                  backgroundColor: copied ? '#059669' : 'rgba(255,255,255,0.14)',
                  color: 'white',
                }}
              >
                {copied ? '✓ Kopierat' : 'Kopiera'}
              </button>
            </div>

            <a
              href="mailto:erik@enklabokslut.se?subject=Underlag bokföring"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: CORAL }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Öppna mail
            </a>
          </div>
        </div>

        {/* Tipsrad */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}18` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: NAV_BG }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-bold text-slate-800 text-sm">Tips för snabbare hantering</h2>
          </div>
          <ul className="flex flex-col gap-2.5">
            {[
              'Namnge filerna med datum, t.ex. "kvitto-2025-03-15.jpg".',
              'Skicka gärna per kvartal eller månad i separata mail.',
              'Du kan alltid bokföra direkt på hemsidan under Bokföra.',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {tip}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
