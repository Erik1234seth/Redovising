import Link from 'next/link';

export default function OmOssPage() {
  return (
    <div className="min-h-screen bg-navy-800 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-10 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Om oss
          </h1>
          <p className="text-base sm:text-xl text-warm-300 max-w-2xl mx-auto px-4">
            Specialister på redovisning för enskilda firmor
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12 mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">
            Vår mission
          </h2>
          <p className="text-base sm:text-lg text-warm-300 mb-4 sm:mb-6 leading-relaxed">
            Vi grundades med en enkel men viktig vision: att göra professionell
            redovisning tillgänglig och prisvärd för alla enskilda firmor i Sverige.
          </p>
          <p className="text-base sm:text-lg text-warm-300 mb-4 sm:mb-6 leading-relaxed">
            Traditionella redovisningsbyråer erbjuder ofta samma tjänster till både
            aktiebolag och enskilda firmor, vilket leder till onödigt höga kostnader
            för enskilda företagare. Vi insåg att det fanns ett bättre sätt.
          </p>
          <p className="text-base sm:text-lg text-warm-300 leading-relaxed">
            Genom att fokusera enbart på enskilda firmor och utnyttja möjligheten till
            förenklad redovisning, kan vi erbjuda professionell service till en
            bråkdel av det traditionella priset.
          </p>
        </div>

        {/* Why Choose Us */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 hover:border-gold-500/50 transition-all duration-300">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gold-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">
              Specialiserad expertis
            </h3>
            <p className="text-sm sm:text-base text-warm-300 leading-relaxed">
              Vi är experter på förenklad redovisning för enskilda firmor. Detta är
              allt vi gör, och vi gör det bättre än någon annan.
            </p>
          </div>

          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 hover:border-gold-500/50 transition-all duration-300">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gold-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">
              Transparent prissättning
            </h3>
            <p className="text-sm sm:text-base text-warm-300 leading-relaxed">
              Inga dolda avgifter eller överraskningar. Du betalar exakt det pris
              som anges - inte mer, inte mindre.
            </p>
          </div>

          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 hover:border-gold-500/50 transition-all duration-300">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gold-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">
              Snabb leverans
            </h3>
            <p className="text-sm sm:text-base text-warm-300 leading-relaxed">
              Din NE-bilaga är klar inom 24 timmar. Ingen väntan, ingen stress.
              Vi vet att din tid är värdefull.
            </p>
          </div>

          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 hover:border-gold-500/50 transition-all duration-300">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gold-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">
              Säkerhet och integritet
            </h3>
            <p className="text-sm sm:text-base text-warm-300 leading-relaxed">
              Dina uppgifter hanteras med högsta säkerhet enligt GDPR. Vi tar
              integritet på allvar.
            </p>
          </div>
        </div>

        {/* Simplified Accounting Explanation */}
        <div className="bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/30 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">
            Vad är förenklad redovisning?
          </h2>
          <div className="space-y-4 text-warm-200 leading-relaxed">
            <p>
              Enskilda firmor med en omsättning under 3 miljoner kronor kan använda
              <strong className="text-gold-500"> förenklad redovisning</strong> enligt
              Bokföringslagen. Detta innebär:
            </p>
            <ul className="space-y-3 ml-6">
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-gold-500 mr-2 flex-shrink-0 mt-0.5"
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
                <span>Enklare bokföringskrav jämfört med aktiebolag</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-gold-500 mr-2 flex-shrink-0 mt-0.5"
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
                <span>Färre obligatoriska rapporter och deklarationer</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-gold-500 mr-2 flex-shrink-0 mt-0.5"
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
                <span>Streamlinead process för NE-bilagor</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-gold-500 mr-2 flex-shrink-0 mt-0.5"
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
                <span>Betydligt lägre administrativa kostnader</span>
              </li>
            </ul>
            <p className="pt-4">
              Genom att specialisera oss på förenklad redovisning kan vi automatisera
              stora delar av processen och därmed erbjuda våra tjänster till marknadens
              lägsta priser.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 md:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
            Redo att komma igång?
          </h2>
          <p className="text-base sm:text-lg text-warm-300 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            Välj ditt paket och få din NE-bilaga klar inom 24 timmar.
            Enkel process, fast pris, professionellt resultat.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="px-8 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105"
            >
              Välj ditt paket
            </Link>
            <Link
              href="/kontakt"
              className="px-8 py-3 bg-navy-800 hover:bg-navy-600 border-2 border-gold-500/50 hover:border-gold-500 text-white rounded-xl font-bold transition-all duration-200"
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
