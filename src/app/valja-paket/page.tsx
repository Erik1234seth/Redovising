'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { packages } from '@/data/packages';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';
const DEADLINE = new Date('2026-05-02T23:59:59');

function useCountdown() {
  const [days, setDays] = useState(0);
  useEffect(() => {
    const update = () => setDays(Math.max(0, Math.ceil((DEADLINE.getTime() - Date.now()) / 86400000)));
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  return days;
}

export default function ValjaPaketPage() {
  const daysLeft = useCountdown();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>

      {/* Header */}
      <div className="py-14 sm:py-16 text-center px-4" style={{ backgroundColor: NAV_BG }}>
        {daysLeft > 0 && (
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5"
            style={{ backgroundColor: CORAL, color: '#fff' }}
          >
            ⏳ {daysLeft} dagar kvar till 2 maj
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3 leading-tight">
          Välj ditt paket
        </h1>
        <p className="text-white/60 text-base sm:text-lg max-w-md mx-auto">
          Fast pris. Ingen bindningstid. Vi kontaktar dig med instruktioner direkt efter beställning.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Packages */}
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 items-start mb-6">
          {packages.map((pkg) => {
            const isPopular = pkg.id === 'komplett';
            return (
              <div
                key={pkg.id}
                className="relative rounded-2xl overflow-hidden flex flex-col"
                style={isPopular
                  ? { backgroundColor: NAV_BG, boxShadow: `0 24px 64px ${NAV_BG}50` }
                  : { backgroundColor: 'white', border: '1px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }
                }
              >
                {isPopular && (
                  <div className="px-8 pt-6 pb-0 flex justify-between items-center">
                    <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ backgroundColor: CORAL, color: 'white' }}>
                      POPULÄRAST
                    </span>
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Vi rekommenderar</span>
                  </div>
                )}

                <div className="p-7 sm:p-9 flex flex-col flex-1">
                  {/* Price block */}
                  <div className="mb-6 pb-6" style={{ borderBottom: `1px solid ${isPopular ? 'rgba(255,255,255,0.1)' : '#f1f5f9'}` }}>
                    <h2 className={`text-xl font-bold mb-1 ${isPopular ? 'text-white' : ''}`} style={!isPopular ? { color: NAV_BG } : {}}>
                      {pkg.name}
                    </h2>
                    <p className={`text-sm mb-5 ${isPopular ? 'text-white/55' : 'text-slate-400'}`}>
                      {pkg.description}
                    </p>
                    <div className="flex items-end gap-1.5">
                      <span className={`text-5xl font-extrabold tracking-tight ${isPopular ? 'text-white' : ''}`} style={!isPopular ? { color: NAV_BG } : {}}>
                        {pkg.price.toLocaleString('sv')}
                      </span>
                      <span className={`text-xl mb-1.5 font-light ${isPopular ? 'text-white/40' : 'text-slate-300'}`}>kr</span>
                    </div>
                    <p className={`text-xs mt-1 ${isPopular ? 'text-white/40' : 'text-slate-400'}`}>Fast pris — inga dolda avgifter</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: isPopular ? `${CORAL}35` : `${NAV_BG}10` }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            style={{ color: isPopular ? CORAL : NAV_BG }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className={`text-sm leading-relaxed ${isPopular ? 'text-white/75' : 'text-slate-600'}`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={`/flow/${pkg.id}/qualification`}
                    className="block w-full text-center font-bold py-4 rounded-xl transition-all duration-200 hover:scale-[1.02] text-sm"
                    style={isPopular
                      ? { backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 24px ${CORAL}50` }
                      : { backgroundColor: NAV_BG, color: 'white', boxShadow: `0 8px 24px ${NAV_BG}25` }
                    }
                  >
                    Välj {pkg.name} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust line */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 py-4 mb-10">
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

        {/* Book meeting CTA */}
        <div
          className="rounded-2xl p-8 sm:p-10 text-center"
          style={{ backgroundColor: NAV_BG }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${CORAL}25` }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">
            Osäker på vilket paket som passar?
          </h2>
          <p className="text-white/55 text-sm sm:text-base mb-7 max-w-sm mx-auto leading-relaxed">
            Boka ett kort möte med oss — kostnadsfritt. Vi hjälper dig att välja rätt och svarar på alla frågor.
          </p>
          <Link
            href="/boka-mote"
            className="inline-flex items-center gap-2 px-8 py-3.5 font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] text-sm"
            style={{ backgroundColor: CORAL, color: 'white', boxShadow: `0 8px 24px ${CORAL}40` }}
          >
            Boka möte
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}
