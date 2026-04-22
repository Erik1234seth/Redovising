'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { packages } from '@/data/packages';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function ValjaPaketPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const router = useRouter();

  const handleGetStarted = (pkgId: string) => {
    sessionStorage.setItem('billingPeriod', billing);
    router.push(`/flow/${pkgId}/qualification`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>

      {/* Header */}
      <div className="py-14 sm:py-16 text-center px-4" style={{ backgroundColor: NAV_BG }}>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3 leading-tight">
          Kom igång idag
        </h1>
        <p className="text-white/60 text-base sm:text-lg max-w-md mx-auto">
          Allt inkluderat. Löpande abonnemang utan bindningstid.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Package */}
        <div className="flex justify-center mb-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="relative rounded-2xl overflow-hidden flex flex-col w-full max-w-md"
              style={{ backgroundColor: NAV_BG, boxShadow: `0 24px 64px ${NAV_BG}50` }}
            >
              <div className="px-8 pt-6 pb-0 flex justify-between items-center">
                <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ backgroundColor: CORAL, color: 'white' }}>
                  ALLT INKLUDERAT
                </span>
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Löpande abonnemang</span>
              </div>

              <div className="p-7 sm:p-9 flex flex-col flex-1">

                {/* Billing toggle */}
                <div className="flex items-center gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                  <button
                    onClick={() => setBilling('monthly')}
                    className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200"
                    style={billing === 'monthly'
                      ? { backgroundColor: 'white', color: NAV_BG }
                      : { color: 'rgba(255,255,255,0.5)' }
                    }
                  >
                    Månadsvis
                  </button>
                  <button
                    onClick={() => setBilling('yearly')}
                    className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5"
                    style={billing === 'yearly'
                      ? { backgroundColor: 'white', color: NAV_BG }
                      : { color: 'rgba(255,255,255,0.5)' }
                    }
                  >
                    Årsvis
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: billing === 'yearly' ? `${CORAL}20` : `${CORAL}40`, color: billing === 'yearly' ? CORAL : 'rgba(233,92,99,0.8)' }}>
                      Spara 89 kr
                    </span>
                  </button>
                </div>

                <div className="mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h2 className="text-xl font-bold mb-1 text-white">{pkg.name}</h2>
                  <p className="text-sm mb-5 text-white/55">{pkg.description}</p>
                  <div className="flex items-end gap-1.5">
                    <span className="text-5xl font-extrabold tracking-tight text-white">
                      {billing === 'monthly' ? pkg.price.toLocaleString('sv') : pkg.yearlyPrice.toLocaleString('sv')}
                    </span>
                    <div className="mb-1">
                      <span className="text-xl font-light text-white/40">kr</span>
                      <p className="text-sm font-semibold leading-none mt-0.5" style={{ color: CORAL }}>
                        {billing === 'monthly' ? 'per månad' : 'per år'}
                      </p>
                    </div>
                  </div>
                  {billing === 'yearly'
                    ? <p className="text-xs mt-2 text-white/35">≈ 292 kr/mån — faktureras en gång per år</p>
                    : <p className="text-xs mt-1 text-white/40">Ingen bindningstid — avsluta när du vill</p>
                  }
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${CORAL}35` }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm leading-relaxed text-white/75">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleGetStarted(pkg.id)}
                  className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 hover:scale-[1.02] text-sm"
                  style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 24px ${CORAL}50` }}
                >
                  Kom igång →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Trust line */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 py-4">
          {[
            'Ingen bindningstid',
            '100% fokus på enskilda firmor',
            'Vi kontaktar dig inom 24h',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
