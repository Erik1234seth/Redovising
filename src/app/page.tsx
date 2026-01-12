'use client';

import Link from 'next/link';
import { packages } from '@/data/packages';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, profile, isReturningCustomer, loading } = useAuth();

  return (
    <div className="bg-navy-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 sm:-top-40 sm:-right-40 w-40 h-40 sm:w-80 sm:h-80 bg-gold-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-40 -left-20 sm:top-60 sm:-left-40 w-48 h-48 sm:w-96 sm:h-96 bg-gold-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gold-500/10 border border-gold-500/20 rounded-full mb-6 sm:mb-8">
              <span className="text-gold-500 text-xs sm:text-sm font-semibold">
                Det som krävs. Inget mer.
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Bokslut för
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                Enskilda Firmor
              </span>
            </h1>

            <p className="text-base sm:text-xl md:text-2xl text-warm-300 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2">
              Årsbokslut och förenklad årsredovisning – utan onödiga moment,
              <span className="block mt-2">
                utan dyra byråtimmar och utan krångel.
              </span>
            </p>

            {/* Welcome Message - Auto-detected based on auth */}
            <div className="mb-12 sm:mb-20">
              {!loading && user && isReturningCustomer ? (
                <div className="bg-gradient-to-br from-gold-500/10 to-gold-600/5 border border-gold-500/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto backdrop-blur-sm">
                  <div className="flex items-center justify-center mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                    Välkommen tillbaka{profile?.full_name ? `, ${profile.full_name}` : ''}!
                  </h2>
                  <p className="text-warm-300 text-base sm:text-lg">
                    Du har gjort {profile?.order_count || 0} {profile?.order_count === 1 ? 'beställning' : 'beställningar'} hos oss tidigare.
                    Välj ditt paket nedan för att komma igång direkt.
                  </p>
                </div>
              ) : !loading && user && !isReturningCustomer ? (
                <div className="bg-gradient-to-br from-gold-500/10 to-gold-600/5 border border-gold-500/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto backdrop-blur-sm">
                  <div className="flex items-center justify-center mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gold-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                    Välkommen{profile?.full_name ? `, ${profile.full_name}` : ''}!
                  </h2>
                  <p className="text-warm-300 text-base sm:text-lg">
                    Detta är din första beställning hos oss. Vi guidar dig genom hela processen steg för steg.
                  </p>
                </div>
              ) : (
                <div className="bg-navy-700/50 border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto backdrop-blur-sm">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                    Så här fungerar det
                  </h2>
                  <p className="text-warm-300 text-base sm:text-lg mb-3 sm:mb-4 leading-relaxed">
                    Välj det paket som passar dig bäst nedan. Därefter guidar vi dig
                    steg för steg genom hela processen - från att ladda ner dina kontoutdrag
                    till färdig NE-bilaga.
                  </p>
                  <div className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gold-500/10 rounded-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gold-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-gold-500 text-sm sm:text-base font-semibold">
                      Färdig på 24 timmar
                    </span>
                  </div>
                  {!user && (
                    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-navy-600">
                      <p className="text-warm-400 text-xs sm:text-sm mb-3 sm:mb-4">
                        Har du ett konto? Logga in för snabbare checkout.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                        <Link
                          href="/auth/login"
                          className="px-6 py-2 bg-navy-800 hover:bg-navy-600 border border-gold-500/50 hover:border-gold-500 text-white rounded-lg font-semibold transition-all duration-200"
                        >
                          Logga in
                        </Link>
                        <Link
                          href="/auth/signup"
                          className="px-6 py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-lg font-bold transition-all duration-200 shadow-lg shadow-gold-500/20"
                        >
                          Skapa konto
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Packages Section */}
          <div id="packages" className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className="group relative bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl overflow-hidden hover:border-gold-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-gold-500/10"
              >
                {/* Popular badge for komplett */}
                {pkg.id === 'komplett' && (
                  <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
                    <span className="px-2 py-1 sm:px-3 bg-gold-500 text-navy-900 text-xs font-bold rounded-full">
                      POPULÄRAST
                    </span>
                  </div>
                )}

                {/* Header with gradient */}
                <div className="relative bg-gradient-to-br from-navy-600 to-navy-700 p-6 sm:p-8 border-b border-navy-600">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <div className="relative">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">{pkg.name}</h3>
                    <p className="text-warm-300 text-sm sm:text-base mb-4 sm:mb-6">{pkg.description}</p>

                    <div className="flex items-baseline">
                      <span className="text-4xl sm:text-5xl font-bold text-gold-500">{pkg.price}</span>
                      <span className="text-xl sm:text-2xl text-warm-400 ml-2">kr</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="p-6 sm:p-8">
                  <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                    {pkg.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-gold-500/20 rounded-full flex items-center justify-center mr-2 sm:mr-3 mt-0.5">
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4 text-gold-500"
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
                        <span className="text-warm-200 text-sm sm:text-base leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/flow/${pkg.id}/bank-selection`}
                    className="block w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 text-center font-bold py-3 sm:py-4 px-6 rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02] text-sm sm:text-base"
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
      <section className="relative py-16 sm:py-24 bg-navy-900">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-800 to-navy-900"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
              Varför välja oss?
            </h2>
            <div className="w-20 sm:w-24 h-1 bg-gradient-to-r from-gold-500 to-gold-600 mx-auto mb-4 sm:mb-6"></div>
            <p className="text-base sm:text-xl text-warm-300 max-w-2xl mx-auto px-4">
              Vi är specialister på enskilda firmor och vet exakt vad som krävs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
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
                className="group bg-navy-800/50 backdrop-blur-sm border border-navy-700 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-gold-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-gold-500/5"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-gold-500/20 to-gold-600/10 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {item.icon}
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 text-center">
                  {item.title}
                </h3>
                <p className="text-warm-300 text-sm sm:text-base text-center leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16 sm:py-20 bg-gradient-to-br from-navy-800 to-navy-900">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-gold-500/20 to-transparent"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6">
            Redo att komma igång?
          </h2>
          <p className="text-base sm:text-xl text-warm-300 mb-6 sm:mb-8 px-4">
            Välj ditt paket och få din NE-bilaga inom 24 timmar
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <a
              href="#packages"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105 text-sm sm:text-base"
            >
              Se våra paket
            </a>
            <Link
              href="/kontakt"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-navy-700 hover:bg-navy-600 border border-navy-600 hover:border-gold-500/50 text-white font-bold rounded-lg sm:rounded-xl transition-all duration-200 text-sm sm:text-base"
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
