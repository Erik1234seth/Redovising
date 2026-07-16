'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { packages } from '@/data/packages';
import { PAYMENTS_ENABLED } from '@/lib/config';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const monthlyFeatures = [
  'Mejla in dina underlag när det passar dig',
  'Bokföring, moms, bokslut & deklaration ingår',
  'Vi lämnar in till Skatteverket',
  'Samma låga kostnad varje månad',
  'Ingen bindningstid — avsluta när du vill',
];

const yearlyFeatures = [
  'Mejla in dina underlag när det passar dig',
  'Bokföring, moms, bokslut & deklaration ingår',
  'Vi lämnar in till Skatteverket',
  'Slipp månadsfakturor — allt klart på en gång',
  'Betala först när allt är färdigställt',
];

export default function SkaffaPage() {
  const pkg = packages[0];
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const isYearly = billing === 'yearly';

  // Förvälj det upplägg kunden redan valde på startsidan (sätts i sessionStorage
  // vid "Kom igång"). Läses efter mount för att undvika hydration-mismatch.
  useEffect(() => {
    const saved = sessionStorage.getItem('billingPeriod');
    if (saved === 'monthly' || saved === 'yearly') setBilling(saved);
  }, []);

  const handleGetStarted = () => {
    sessionStorage.setItem('billingPeriod', billing);
    window.location.href = 'https://app.enklabokslut.se/auth/signup';
  };

  const features = isYearly ? yearlyFeatures : monthlyFeatures;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-5xl">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

        {/* ── LEFT: value & trust ── */}
        <div className="order-2 lg:order-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 leading-tight" style={{ color: NAV_BG }}>
            Allt för din enskilda firma — på ett ställe
          </h1>
          <p className="text-slate-500 text-sm sm:text-base mb-8 max-w-md">
            Du mejlar in dina underlag när det passar dig. Vi sköter bokföring, moms, årsbokslut och deklaration. Allt ingår.
          </p>

          {/* Så funkar det */}
          <div className="space-y-5 mb-8">
            {[
              { t: 'Skapa konto', d: 'Tar under en minut — inga förkunskaper behövs.' },
              { t: 'Mejla in dina underlag', d: 'Kvitton och fakturor, när det passar dig.' },
              { t: 'Vi sköter resten', d: 'Bokföring, bokslut och deklaration — inlämnat till Skatteverket.' },
            ].map((step, i) => (
              <div key={step.t} className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: NAV_BG }}
                >
                  {i + 1}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: NAV_BG }}>{step.t}</p>
                  <p className="text-sm text-slate-500 leading-snug">{step.d}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust points */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8">
            {['Ingen bindningstid', 'Byggt för enskilda firmor', 'Personlig kontakt', 'Kvalitetsgranskad redovisning'].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke={CORAL} strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium text-slate-600">{t}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <div className="flex gap-0.5 mb-2">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 fill-amber-400" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              &ldquo;Äntligen ett ställe som verkligen förstår hur det fungerar att driva enskild firma. Snabbt, tydligt och till ett pris jag faktiskt har råd med.&rdquo;
            </p>
            <p className="text-xs font-bold" style={{ color: NAV_BG }}>Anna Lindgren <span className="font-normal text-slate-400">· Frilansfotograf</span></p>
          </div>
        </div>

        {/* ── RIGHT: toggle + pricing card ── */}
        <div className="order-1 lg:order-2 w-full max-w-md mx-auto lg:mx-0">

        {/* Toggle */}
        <div className="flex justify-center mb-6">
          <div className="relative inline-flex p-1 rounded-full bg-white shadow-sm border border-slate-200">
            {/* Sliding indicator */}
            <span
              className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out"
              style={{
                backgroundColor: NAV_BG,
                left: isYearly ? '50%' : '0.25rem',
                right: isYearly ? '0.25rem' : '50%',
              }}
            />
            <button
              onClick={() => setBilling('monthly')}
              className="relative z-10 px-6 py-2 text-sm font-bold rounded-full transition-colors duration-200"
              style={{ color: isYearly ? '#64748b' : '#fff' }}
            >
              Månadsvis
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className="relative z-10 px-6 py-2 text-sm font-bold rounded-full transition-colors duration-200 flex items-center gap-1.5"
              style={{ color: isYearly ? '#fff' : '#64748b' }}
            >
              Årsvis
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none"
                style={{
                  backgroundColor: isYearly ? 'rgba(255,255,255,0.2)' : 'rgba(23,59,87,0.1)',
                  color: isYearly ? '#fff' : NAV_BG,
                }}
              >
                POPULÄRT
              </span>
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: NAV_BG, boxShadow: `0 24px 64px ${NAV_BG}40` }}>
          <div className="px-8 pt-6 pb-0">
            <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ backgroundColor: CORAL, color: 'white' }}>
              ALLT INKLUDERAT
            </span>
          </div>

          <div className="p-8">
            {/* Price */}
            <div className="mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <h3 className="text-xl font-bold mb-1 text-white">
                {isYearly ? 'Årsvis' : 'Månadsvis'}
              </h3>
              <p className="text-sm mb-5 text-white/55 min-h-[2.5rem]">
                {isYearly
                  ? 'Betala en gång och var klar för hela året — helt utan kostnad förrän jobbet är gjort.'
                  : 'Fördela kostnaden jämnt över året istället för att betala allt på en gång.'}
              </p>
              <div className="flex items-end gap-1.5">
                <span key={billing} className="text-6xl font-extrabold text-white leading-none animate-[priceIn_0.3s_ease-out]">
                  {(isYearly ? pkg.yearlyPrice : pkg.price).toLocaleString('sv')}
                </span>
                <div className="mb-1">
                  <p className="text-sm font-semibold" style={{ color: CORAL }}>
                    {isYearly ? 'kr/år' : 'kr/månad'}
                  </p>
                  <p className="text-xs text-white/40">(exkl. moms)</p>
                </div>
              </div>
            </div>

            {/* Billing-timing callout */}
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3.5 mb-6 transition-colors duration-300"
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={2}
              >
                {isYearly ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <div>
                <p className="text-sm font-bold text-white leading-snug">
                  {isYearly ? 'Du betalar inget nu' : 'Automatisk månadsbetalning'}
                </p>
                <p className="text-xs text-white/60 leading-snug mt-0.5">
                  {isYearly
                    ? 'Faktureras först när bokslut och deklaration är färdigställda.'
                    : 'Dras automatiskt varje månad. Ingen bindningstid.'}
                </p>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm leading-relaxed text-white/80">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleGetStarted}
              className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 text-sm hover:opacity-90 hover:scale-[1.01]"
              style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 20px ${CORAL}40` }}
            >
              {PAYMENTS_ENABLED ? 'Kom igång →' : 'Skapa konto'}
            </button>

            <p className="text-center text-xs text-white/40 mt-4">
              {isYearly ? 'Ingen betalning idag • Faktura efter färdigställt bokslut' : 'Ingen bindningstid • Avsluta när du vill'}
            </p>
          </div>
        </div>

        </div>
        {/* ── end right column ── */}

        </div>
        {/* ── end grid ── */}

        <Link href="/" className="block text-center mt-10 text-sm text-slate-400 hover:text-slate-600 transition-colors">
          ← Tillbaka till startsidan
        </Link>
      </div>

      <style jsx>{`
        @keyframes priceIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
