'use client';

import Link from 'next/link';
import { packages } from '@/data/packages';
import { PAYMENTS_ENABLED } from '@/lib/config';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const monthlyFeatures = [
  'Samma låga kostnad varje månad',
  'Mejla in dina underlag',
  'Bokföring, bokslut och deklaration ingår',
  'Vi lämnar in till Skatteverket',
  'Automatisk månadsbetalning',
  'Ingen bindningstid',
];

const yearlyFeatures = [
  'Betala en gång för hela året',
  'Slipp månadsfakturor',
  'Mejla bara in dina underlag',
  'Bokföring, bokslut och deklaration ingår',
  'Vi lämnar in till Skatteverket',
  'Allt klart med en enda betalning',
];

export default function SkaffaPage() {
  const pkg = packages[0];

  const handleGetStarted = (billing: 'monthly' | 'yearly') => {
    sessionStorage.setItem('billingPeriod', billing);
    window.location.href = 'https://app.enklabokslut.se/auth/signup';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold mb-2" style={{ color: NAV_BG }}>Samma enkla lösning - Allt ingår</h1>
          <p className="text-slate-500 text-sm">Du mejlar in dina underlag när det passar dig. Vi sköter den löpande bokföringen, momsredovisningen, årsbokslutet och deklarationen.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 items-start">

          {/* Monthly */}
          <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: NAV_BG, boxShadow: `0 24px 64px ${NAV_BG}40` }}>
            <div className="px-8 pt-6 pb-0 flex justify-between items-center">
              <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ backgroundColor: CORAL, color: 'white' }}>
                ALLT INKLUDERAT
              </span>
            </div>

            <div className="p-7 sm:p-9">
              <div className="mb-7 pb-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                <h3 className="text-xl font-bold mb-1 text-white">Månadsvis</h3>
                <p className="text-sm mb-6 text-white/55">Perfekt om du vill fördela kostnaden över året istället för att betala allt på en gång.</p>
                <div className="flex items-end gap-1.5">
                  <span className="text-6xl font-extrabold text-white leading-none">
                    {pkg.price.toLocaleString('sv')}
                  </span>
                  <div className="mb-1">
                    <p className="text-lg font-light text-white/50">kr <span className="text-xs">(exkl. moms)</span></p>
                    <p className="text-sm font-semibold" style={{ color: CORAL }}>per månad</p>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Sprid din kostnad över året</p>
              </div>

              <ul className="space-y-3 mb-8">
                {monthlyFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${CORAL}30` }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm leading-relaxed text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleGetStarted('monthly')}
                className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 text-sm"
                style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 20px ${CORAL}40` }}
              >
                {PAYMENTS_ENABLED ? 'Kom igång →' : 'Skapa konto'}
              </button>
            </div>
          </div>

          {/* Yearly */}
          <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: NAV_BG, boxShadow: `0 24px 64px ${NAV_BG}40` }}>
            <div className="px-8 pt-6 pb-0 flex justify-between items-center">
              <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ backgroundColor: CORAL, color: 'white' }}>
                ALLT INKLUDERAT
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${CORAL}20`, color: CORAL }}>
                Spara 89 kr
              </span>
            </div>

            <div className="p-7 sm:p-9">
              <div className="mb-7 pb-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                <h3 className="text-xl font-bold mb-1 text-white">Årsvis</h3>
                <p className="text-sm mb-6 text-white/55">Passar dig som vill betala en gång och sedan vara klar för hela året.</p>
                <div className="flex items-end gap-1.5">
                  <span className="text-6xl font-extrabold text-white leading-none">
                    {pkg.yearlyPrice.toLocaleString('sv')}
                  </span>
                  <div className="mb-1">
                    <p className="text-lg font-light text-white/50">kr <span className="text-xs">(exkl. moms)</span></p>
                    <p className="text-sm font-semibold" style={{ color: CORAL }}>per år</p>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Faktureras årsvis efter inlämnad deklaration</p>
              </div>

              <ul className="space-y-3 mb-8">
                {yearlyFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${CORAL}30` }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm leading-relaxed text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleGetStarted('yearly')}
                className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 text-sm"
                style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 20px ${CORAL}40` }}
              >
                {PAYMENTS_ENABLED ? 'Kom igång →' : 'Skapa konto'}
              </button>
            </div>
          </div>

        </div>

        <Link href="/" className="block text-center mt-8 text-sm text-slate-400 hover:text-slate-600 transition-colors">
          ← Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
}
