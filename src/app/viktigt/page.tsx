export default function ViktigtPage() {
  return (
    <div className="min-h-screen bg-navy-800 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-10 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Viktigt att tänka på
          </h1>
          <p className="text-base sm:text-xl text-warm-300 max-w-2xl mx-auto px-4">
            Ansvarsfördelning mellan dig och oss
          </p>
        </div>

        {/* Ditt ansvar */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12 mb-8">
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mr-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Ditt ansvar som företagare
            </h2>
          </div>

          <ul className="space-y-4">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <strong className="text-white block mb-1">Kvitton och verifikationer</strong>
                <p className="text-warm-300 text-sm sm:text-base">
                  Du ansvarar för att ha kvitton och underlag som styrker samtliga transaktioner i din verksamhet. Enligt bokföringslagen ska varje affärshändelse ha en verifikation.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <strong className="text-white block mb-1">Korrekt underlag</strong>
                <p className="text-warm-300 text-sm sm:text-base">
                  Det material du skickar in till oss ska vara komplett och korrekt. Vi baserar vårt arbete helt på de uppgifter och kontoutdrag du lämnar till oss, och vi kan inte göra mer än så.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <strong className="text-white block mb-1">Skilja på privat och företag</strong>
                <p className="text-warm-300 text-sm sm:text-base">
                  Du ansvarar för att kunna skilja mellan privata och företagsrelaterade transaktioner. Om privata utgifter finns med i kontoutdraget behöver du markera dessa.
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Vårt ansvar */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 md:p-12 mb-8">
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gold-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mr-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Vårt ansvar
            </h2>
          </div>

          <ul className="space-y-4">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-gold-500 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white block mb-1">Bokföring baserat på ditt underlag</strong>
                <p className="text-warm-300 text-sm sm:text-base">
                  Vi bokför och upprättar din NE-bilaga utifrån de kontoutdrag och uppgifter du skickar in till oss.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-gold-500 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white block mb-1">Korrekt hantering</strong>
                <p className="text-warm-300 text-sm sm:text-base">
                  Vi ser till att bokföringen och NE-bilagan upprättas enligt gällande regler och god redovisningssed, baserat på det underlag vi fått.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-gold-500 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white block mb-1">Leverans i tid</strong>
                <p className="text-warm-300 text-sm sm:text-base">
                  Vi levererar din färdiga NE-bilaga inom utlovad tid efter att vi mottagit komplett underlag.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-gold-500 mr-3 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white block mb-1">Support</strong>
                <p className="text-warm-300 text-sm sm:text-base">
                  Vi finns tillgängliga för frågor och hjälper dig genom hela processen.
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Vad lagen säger */}
        <div className="bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/30 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 mb-8">
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gold-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mr-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Vad säger lagen?
            </h2>
          </div>

          <div className="space-y-6">
            <div className="bg-navy-800/50 rounded-xl p-5 sm:p-6">
              <h3 className="font-bold text-gold-500 mb-2">Bokföringslagen (1999:1078)</h3>
              <p className="text-warm-300 text-sm sm:text-base leading-relaxed">
                Enligt bokföringslagen är det alltid den som bedriver näringsverksamheten som är bokföringsskyldig. Det innebär att du som företagare har det yttersta ansvaret för att bokföringen är korrekt och fullständig, även om du anlitar någon annan för att utföra arbetet.
              </p>
            </div>

            <div className="bg-navy-800/50 rounded-xl p-5 sm:p-6">
              <h3 className="font-bold text-gold-500 mb-2">Verifikationskrav</h3>
              <p className="text-warm-300 text-sm sm:text-base leading-relaxed">
                Varje affärshändelse ska enligt lag dokumenteras med en verifikation (kvitto, faktura eller liknande). Du som företagare ansvarar för att dessa finns och är korrekta. Utan verifikationer kan Skatteverket underkänna avdrag vid en eventuell granskning.
              </p>
            </div>

          </div>
        </div>

        {/* Sammanfattning */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 md:p-12">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
            Sammanfattningsvis
          </h2>
          <p className="text-warm-300 text-sm sm:text-base leading-relaxed mb-4">
            Vi utför ett professionellt arbete baserat på det material du skickar in. Det är viktigt att förstå att kvaliteten på vår leverans är direkt beroende av kvaliteten på det underlag vi får. Vi kan inte ansvara för uppgifter som saknas eller är felaktiga i det material du lämnar till oss.
          </p>
          <p className="text-warm-300 text-sm sm:text-base leading-relaxed">
            Se därför till att ha ordning på dina kvitton, att kontoutdragen är kompletta, och att du tydligt markerar vilka transaktioner som är privata respektive företagsrelaterade. Då kan vi göra det bästa möjliga jobbet åt dig.
          </p>
        </div>
      </div>
    </div>
  );
}
