'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { packages } from '@/data/packages';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, profile, isReturningCustomer, loading } = useAuth();
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showExitIntent, setShowExitIntent] = useState(false);

  // Show popup for non-logged-in users after a short delay
  useEffect(() => {
    if (!loading && !user) {
      // Check if user has already seen the popup this session
      const hasSeenPopup = sessionStorage.getItem('hasSeenInfoPopup');
      if (!hasSeenPopup) {
        const timer = setTimeout(() => {
          setShowInfoPopup(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, user]);

  const closePopup = () => {
    setShowInfoPopup(false);
    sessionStorage.setItem('hasSeenInfoPopup', 'true');
  };

  // Exit intent detection
  useEffect(() => {
    const hasSeenExitIntent = localStorage.getItem('hasSeenExitIntent');
    if (hasSeenExitIntent) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Detect if mouse is leaving from the top of the viewport
      if (e.clientY <= 0) {
        setShowExitIntent(true);
        localStorage.setItem('hasSeenExitIntent', 'true');
      }
    };

    // Add listener after a short delay to avoid triggering immediately
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 5000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const closeExitIntent = () => {
    setShowExitIntent(false);
  };

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "name": "Enkla Bokslut",
            "description": "Professionell årsredovisning och bokslut för enskilda firmor. Vi hjälper enskilda näringsidkare med NE-bilaga och förenklat årsbokslut.",
            "url": "https://enklabokslut.se",
            "logo": "https://enklabokslut.se/loggautantext.png",
            "image": "https://enklabokslut.se/loggautantext.png",
            "priceRange": "1999 kr - 3499 kr",
            "areaServed": {
              "@type": "Country",
              "name": "Sverige"
            },
            "serviceType": [
              "Årsredovisning",
              "Bokslut",
              "NE-bilaga",
              "Förenklat årsbokslut",
              "Redovisning för enskild firma",
              "Bokföring enskild näringsidkare"
            ],
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Bokslut och Redovisningstjänster",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "NE-bilaga",
                    "description": "Förenklat årsbokslut för enskilda firmor enligt K1-regelverket",
                    "serviceType": "Årsredovisning"
                  },
                  "price": "1999",
                  "priceCurrency": "SEK"
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Komplett Redovisning",
                    "description": "Fullständig redovisning och bokslut för enskilda firmor inklusive inlämning till Skatteverket",
                    "serviceType": "Bokslut och Redovisning"
                  },
                  "price": "3499",
                  "priceCurrency": "SEK"
                }
              ]
            }
          })
        }}
      />
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
              Bokföring och förenklat årsbokslut – utan onödiga moment,
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
                      Snabb leverans
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

          {/* Login Required Notice for Guests */}
          {!loading && !user && (
            <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-xl p-4 sm:p-6 mb-8 max-w-5xl mx-auto">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-gold-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-gold-500 font-bold mb-1 text-sm sm:text-base">Inloggning krävs</h3>
                  <p className="text-warm-200 text-sm sm:text-base">
                    Du måste vara inloggad för att göra en beställning. Skapa ett gratis konto eller logga in för att komma igång.
                  </p>
                </div>
              </div>
            </div>
          )}

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

                  {user ? (
                    <Link
                      href={`/flow/${pkg.id}/${pkg.id === 'komplett' || pkg.id === 'ne-bilaga' ? 'qualification' : 'bank-selection'}`}
                      className="block w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 text-center font-bold py-3 sm:py-4 px-6 rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02] text-sm sm:text-base"
                    >
                      Välj {pkg.name} →
                    </Link>
                  ) : (
                    <Link
                      href={`/auth/login?redirect=/flow/${pkg.id}/${pkg.id === 'komplett' || pkg.id === 'ne-bilaga' ? 'qualification' : 'bank-selection'}`}
                      className="block w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 text-center font-bold py-3 sm:py-4 px-6 rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-[1.02] text-sm sm:text-base"
                    >
                      Logga in för att välja {pkg.name} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trust Signals */}
          <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
              <div className="bg-navy-700/30 border border-navy-600 rounded-xl p-4 sm:p-6 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">500+</div>
                <div className="text-xs sm:text-sm text-warm-300">Godkända deklarationer 2024</div>
              </div>
              <div className="bg-navy-700/30 border border-navy-600 rounded-xl p-4 sm:p-6 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">3 dagar</div>
                <div className="text-xs sm:text-sm text-warm-300">Genomsnittlig leveranstid</div>
              </div>
              <div className="bg-navy-700/30 border border-navy-600 rounded-xl p-4 sm:p-6 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">98%</div>
                <div className="text-xs sm:text-sm text-warm-300">Godkänt första gången</div>
              </div>
              <div className="bg-navy-700/30 border border-navy-600 rounded-xl p-4 sm:p-6 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">10+</div>
                <div className="text-xs sm:text-sm text-warm-300">Banker stöds</div>
              </div>
            </div>

            {/* Guarantee Badge */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    100% Godkänd-garanti
                  </h3>
                  <p className="text-sm sm:text-base text-warm-300">
                    Godkänt av Skatteverket eller pengarna tillbaka. Vi står för kvaliteten i varje deklaration.
                  </p>
                </div>
              </div>
            </div>
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
                description: 'Snabb leverans av din NE-bilaga. Enkla steg-för-steg instruktioner.'
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
            Välj ditt paket och kom igång direkt
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

      {/* Info Popup for New Visitors */}
      {showInfoPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-8 sm:py-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm"
            onClick={closePopup}
          ></div>

          {/* Modal */}
          <div className="relative bg-navy-800 border border-navy-600 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={closePopup}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-warm-400 hover:text-white transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-gold-500/10 to-gold-600/5 border-b border-navy-600 p-4 sm:p-8">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white text-center">
                Välkommen hit!
              </h2>
              <p className="text-warm-300 text-center mt-1 sm:mt-2 text-sm sm:text-base">
                Kul att du startat enskild firma - här är några tips
              </p>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-8 space-y-4 sm:space-y-5">
              {/* Point 1 - Law requirement */}
              <div className="flex gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gold-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">Det är lag på att redovisa</h3>
                  <p className="text-xs sm:text-sm text-warm-300">
                    Som enskild näringsidkare måste du enligt lag lämna in en NE-bilaga till Skatteverket varje år. Vi gör det enkelt!
                  </p>
                </div>
              </div>

              {/* Point 2 - We have instructions */}
              <div className="flex gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gold-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">Vi guidar dig hela vägen</h3>
                  <p className="text-xs sm:text-sm text-warm-300">
                    Steg-för-steg instruktioner för allt - från att hämta kontoutdrag till färdig inlämning.
                  </p>
                </div>
              </div>

              {/* Point 3 - Important note */}
              <div className="bg-navy-700/50 border border-navy-600 rounded-lg sm:rounded-xl p-3 sm:p-4">
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-warm-300 text-xs sm:text-sm mb-0.5 sm:mb-1">Viktigt att tänka på</h3>
                    <p className="text-xs text-warm-400">
                      Vi kan tyvärr inte hjälpa till med jordbruk, skogsbruk, byggverksamhet, taxi eller liknande.
                    </p>
                  </div>
                </div>
              </div>

              {/* Button */}
              <div className="pt-1 sm:pt-2">
                <button
                  onClick={closePopup}
                  className="w-full text-center px-6 py-2.5 sm:py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20"
                >
                  Fortsätt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit Intent Popup */}
      {showExitIntent && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-navy-900/90 backdrop-blur-sm"
            onClick={closeExitIntent}
          ></div>

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-navy-800 to-navy-900 border-2 border-gold-500 rounded-2xl shadow-2xl max-w-md w-full animate-slideUp">
            {/* Close button */}
            <button
              onClick={closeExitIntent}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-warm-400 hover:text-white transition-colors z-10 rounded-full hover:bg-navy-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gold-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                  Vänta! Innan du går...
                </h2>
                <p className="text-base sm:text-lg text-warm-300 mb-6">
                  Få <span className="text-gold-500 font-bold">10% rabatt</span> på din första beställning!
                </p>
              </div>

              <div className="bg-navy-700/50 border border-navy-600 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-warm-200">Spara upp till 11 000 kr jämfört med traditionell byrå</p>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-warm-200">Leverans inom 3 dagar</p>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-warm-200">100% godkänd-garanti</p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="#packages"
                  onClick={closeExitIntent}
                  className="block w-full text-center px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-gold-500/20"
                >
                  Ja, ge mig 10% rabatt! →
                </Link>
                <button
                  onClick={closeExitIntent}
                  className="w-full text-center px-6 py-3 text-warm-400 hover:text-white font-semibold transition-colors text-sm"
                >
                  Nej tack, jag vill betala fullt pris
                </button>
              </div>

              <p className="text-xs text-warm-500 text-center mt-4">
                Använd kod: <span className="font-mono font-bold text-gold-500">VÄLKOMMEN10</span> vid beställning
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
