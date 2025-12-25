'use client';

import { useState } from 'react';
import Link from 'next/link';
import { packages } from '@/data/packages';
import { Package } from '@/types';

export default function Home() {
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);

  return (
    <div className="bg-navy-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-60 -left-40 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-gold-500/10 border border-gold-500/20 rounded-full mb-8">
              <span className="text-gold-500 text-sm font-semibold">
                Det som krävs. Inget mer.
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Bokslut för
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                Enskilda Firmor
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-warm-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Årsbokslut och förenklad årsredovisning – utan onödiga moment,
              <span className="block mt-2">
                utan dyra byråtimmar och utan krångel.
              </span>
            </p>

            {/* Customer Type Toggle */}
            <div className="flex justify-center mb-16">
              <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-1.5 inline-flex">
                <button
                  onClick={() => setIsReturningCustomer(false)}
                  className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    !isReturningCustomer
                      ? 'bg-gold-500 text-navy-900 shadow-lg shadow-gold-500/20'
                      : 'text-warm-300 hover:text-white'
                  }`}
                >
                  Ny kund
                </button>
                <button
                  onClick={() => setIsReturningCustomer(true)}
                  className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    isReturningCustomer
                      ? 'bg-gold-500 text-navy-900 shadow-lg shadow-gold-500/20'
                      : 'text-warm-300 hover:text-white'
                  }`}
                >
                  Återkommande kund
                </button>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="mb-20">
              {isReturningCustomer ? (
                <div className="bg-gradient-to-br from-gold-500/10 to-gold-600/5 border border-gold-500/20 rounded-2xl p-8 max-w-2xl mx-auto backdrop-blur-sm">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-gold-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    Välkommen tillbaka!
                  </h2>
                  <p className="text-warm-300 text-lg">
                    Som återkommande kund känner du redan till processen.
                    Välj ditt paket nedan för att komma igång direkt.
                  </p>
                </div>
              ) : (
                <div className="bg-navy-700/50 border border-navy-600 rounded-2xl p-8 max-w-2xl mx-auto backdrop-blur-sm">
                  <h2 className="text-2xl font-bold text-white mb-4">
                    Så här fungerar det
                  </h2>
                  <p className="text-warm-300 text-lg mb-4 leading-relaxed">
                    Välj det paket som passar dig bäst nedan. Därefter guidar vi dig
                    steg för steg genom hela processen - från att ladda ner dina kontoutdrag
                    till färdig NE-bilaga.
                  </p>
                  <div className="inline-flex items-center px-4 py-2 bg-gold-500/10 rounded-lg">
                    <svg className="w-5 h-5 text-gold-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-gold-500 font-semibold">
                      Färdig på 24 timmar
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Packages Section */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className="group relative bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-2xl overflow-hidden hover:border-gold-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-gold-500/10"
              >
                {/* Popular badge for komplett */}
                {pkg.id === 'komplett' && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="px-3 py-1 bg-gold-500 text-navy-900 text-xs font-bold rounded-full">
                      POPULÄRAST
                    </span>
                  </div>
                )}

                {/* Header with gradient */}
                <div className="relative bg-gradient-to-br from-navy-600 to-navy-700 p-8 border-b border-navy-600">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <div className="relative">
                    <h3 className="text-3xl font-bold text-white mb-2">{pkg.name}</h3>
                    <p className="text-warm-300 mb-6">{pkg.description}</p>

                    <div className="flex items-baseline">
                      <span className="text-5xl font-bold text-gold-500">{pkg.price}</span>
                      <span className="text-2xl text-warm-400 ml-2">kr</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="p-8">
                  <ul className="space-y-4 mb-8">
                    {pkg.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <div className="flex-shrink-0 w-6 h-6 bg-gold-500/20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                          <svg
                            className="w-4 h-4 text-gold-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <span className="text-warm-200 leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/flow/${pkg.id}/bank-selection`}
                    className="block w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 text-center font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02]"
                  >
                    Välj {pkg.name} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="relative py-24 bg-navy-900">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-800 to-navy-900"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Varför välja oss?
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-gold-500 to-gold-600 mx-auto mb-6"></div>
            <p className="text-xl text-warm-300 max-w-2xl mx-auto">
              Vi är specialister på enskilda firmor och vet exakt vad som krävs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                ),
                title: 'Säkert och pålitligt',
                description: 'Dina uppgifter hanteras med högsta säkerhet och följer alla regelverk.'
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                ),
                title: 'Snabbt och enkelt',
                description: 'Färdig NE-bilaga inom 24 timmar. Enkla steg-för-steg instruktioner.'
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                ),
                title: 'Bästa priset',
                description: 'Genom att fokusera enbart på enskilda firmor kan vi hålla priserna låga.'
              }
            ].map((item, index) => (
              <div
                key={index}
                className="group bg-navy-800/50 backdrop-blur-sm border border-navy-700 rounded-2xl p-8 hover:border-gold-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-gold-500/5"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-gold-500/20 to-gold-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="w-8 h-8 text-gold-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {item.icon}
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 text-center">
                  {item.title}
                </h3>
                <p className="text-warm-300 text-center leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 bg-gradient-to-br from-navy-800 to-navy-900">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-gold-500/20 to-transparent"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Redo att komma igång?
          </h2>
          <p className="text-xl text-warm-300 mb-8">
            Välj ditt paket och få din NE-bilaga inom 24 timmar
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#packages"
              className="px-8 py-4 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105"
            >
              Se våra paket
            </a>
            <Link
              href="/kontakt"
              className="px-8 py-4 bg-navy-700 hover:bg-navy-600 border border-navy-600 hover:border-gold-500/50 text-white font-bold rounded-xl transition-all duration-200"
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
