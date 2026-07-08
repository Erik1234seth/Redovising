import Link from 'next/link';

const CORAL = '#E95C63';
const NAVY = '#173b57';

const specializationPoints = [
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h4m3 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
    title: 'Enskilda firmor, inte aktiebolag',
    body: 'Vi är specialister på det regelverk som gäller enskilda firmor med förenklad redovisning – inte på alla bolagsformer.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    ),
    title: 'Verksamheter utan anställda',
    body: 'Ingen lönehantering eller personaladministration. Det håller varje ärende enkelt, tydligt och lätt att kontrollera.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    ),
    title: 'Återkommande, standardiserbara flöden',
    body: 'När uppgifterna följer samma mönster år efter år kan vi arbeta strukturerat och effektivt – utan att tumma på noggrannheten.',
  },
];

const workSteps = [
  {
    step: '1',
    title: 'Du skickar in dina uppgifter',
    body: 'Du lämnar in underlag och information om din verksamhet på ett tydligt och strukturerat sätt.',
  },
  {
    step: '2',
    title: 'Vi kontrollerar och tolkar',
    body: 'En redovisningskonsult granskar informationen och kontrollerar att allt stämmer innan något går vidare.',
  },
  {
    step: '3',
    title: 'Vi frågar om något är oklart',
    body: 'Är något otydligt hör vi av oss och ställer frågor – vi gissar aldrig oss fram i din bokföring.',
  },
  {
    step: '4',
    title: 'Bokföring, moms och deklaration klart',
    body: 'Allt sammanställs noggrant och lämnas in korrekt och i tid till Skatteverket.',
  },
];

const pricingPoints = [
  'Tydligt avgränsad målgrupp – enskilda firmor utan anställda',
  'Standardiserade arbetssätt istället för timdebiterad rådgivning',
  'Återkommande flöden vi känner väl och kan arbeta effektivt med',
  'Effektiv process – inte mindre kontroll av din bokföring',
];

const fitPoints = [
  'Du driver enskild firma',
  'Du har inga anställda',
  'Din verksamhet har enklare, återkommande flöden',
  'Du vill ha bokföring, moms och deklaration hanterat till ett fast, lägre pris',
  'Du vill kunna lita på att någon granskar och frågar vid oklarheter',
];

const notFitPoints = [
  'Du driver aktiebolag',
  'Du omsätter minst 3 miljoner kr',
  'Du har anställda eller hanterar löner',
  'Din verksamhet har mer avancerade eller komplexa redovisningsupplägg',
  'Du behöver löpande rådgivning utöver bokföring, moms och deklaration',
];

export default function OmOssPage() {
  return (
    <div className="bg-white">

      {/* ── HERO ── */}
      <section className="bg-white overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-left py-16 lg:py-24">
            <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: CORAL }}>
              Om oss
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-6" style={{ color: NAVY }}>
              Trygg redovisning för dig
              <br />
              som driver enskild firma
            </h1>
            <div className="space-y-4 text-slate-500 text-base sm:text-lg leading-relaxed">
              <p>
                Enkla Bokslut är skapat för dig som driver enskild firma och vill ha hjälp med bokföring, moms och deklaration på ett tryggt och tydligt sätt.
              </p>
              <p>
                Vi har valt att specialisera oss på enskilda firmor med standardiserbara flöden. Det gör att vi kan arbeta strukturerat och fokusera på det som faktiskt krävs – utan onödig administration eller krångliga upplägg.
              </p>
              <p>
                Vårt mål är inte att hjälpa alla typer av företag. Vårt mål är att göra rätt saker, för rätt kunder, på ett noggrant och prisvärt sätt.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ── VARFÖR VI FINNS ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
                Varför vi finns
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mb-6 leading-snug">
                Bokföring ska kännas enkel och logisk
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed text-[15px]">
                <p>
                  Många som driver enskild firma upplever bokföring, moms och deklaration som krångligt,
                  dyrt och osäkert. Man vet inte alltid om man har gjort rätt, och en traditionell
                  redovisningsbyrå kan kännas både svårtillgänglig och för dyr för en mindre verksamhet.
                </p>
                <p>
                  Samtidigt går det inte att pruta på att det blir rätt. Fel i bokföringen eller
                  deklarationen kan bli kostsamt och skapa problem gentemot Skatteverket längre fram.
                </p>
                <p>
                  Enkla Bokslut finns för att göra redovisningen begriplig och tillgänglig för rätt typ
                  av företagare – utan att göra avkall på noggrannheten.
                </p>
              </div>
            </div>

            <div className="rounded-2xl p-8 sm:p-10" style={{ backgroundColor: NAVY }}>
              <h3 className="text-lg font-bold text-white mb-6">
                Det här vill vi ändra på
              </h3>
              <div className="space-y-4">
                {[
                  { from: 'Krångligt', to: 'Tydliga steg och ett strukturerat flöde' },
                  { from: 'Dyrt', to: 'Fast, lägre pris utan timarvoden' },
                  { from: 'Osäkert', to: 'Kontrolleras och granskas av en redovisningskonsult' },
                ].map((item) => (
                  <div key={item.from} className="flex items-start gap-3 pb-4 border-b border-white/10 last:border-0 last:pb-0">
                    <span className="text-sm font-semibold text-white/40 line-through whitespace-nowrap mt-0.5 flex-shrink-0 w-20">{item.from}</span>
                    <svg className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-white/85 text-sm leading-relaxed">{item.to}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ── SPECIALISERING ── */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
              Vår specialisering
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mb-4">
              Vi försöker inte passa alla
            </h2>
            <p className="text-slate-600 leading-relaxed text-[15px]">
              Enkla Bokslut hjälper framför allt enskilda firmor utan anställda, med enklare och
              återkommande flöden. Det är ett medvetet val – inte en begränsning vi hamnat i av misstag.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {specializationPoints.map((v) => (
              <div
                key={v.title}
                className="bg-white rounded-2xl p-7 border border-navy-100 shadow-sm hover:shadow-md hover:border-navy-300 transition-all duration-200"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: '#173b5712' }}
                >
                  <svg className="w-6 h-6 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {v.icon}
                  </svg>
                </div>
                <h3 className="text-base font-bold text-navy-900 mb-2">{v.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 text-sm mt-10 max-w-xl mx-auto leading-relaxed">
            Den tydliga avgränsningen är anledningen till att vi kan hålla nere priset och samtidigt
            vara noggranna.
          </p>
        </div>
      </section>

      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ── SÅ ARBETAR VI ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
              Så arbetar vi
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900">
              En tydlig process, steg för steg
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {workSteps.map((s) => (
              <div key={s.step} className="relative">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mb-4"
                  style={{ backgroundColor: NAVY }}
                >
                  {s.step}
                </div>
                <h3 className="text-base font-bold text-navy-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ── LÄGRE PRIS – UTAN GENVÄGAR ── */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
                Lägre pris – utan genvägar
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mb-6 leading-snug">
                Hur kan priset vara så lågt?
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed text-[15px]">
                <p>
                  Ett lägre pris handlar inte om lägre kvalitet. Det handlar om hur vi arbetar.
                </p>
                <p>
                  Genom att hjälpa en tydligt avgränsad målgrupp – enskilda firmor utan anställda, med
                  enklare flöden – kan vi standardisera stora delar av arbetet. Det gör processen mer
                  effektiv, utan att en redovisningskonsult behöver granska varje ärende från grunden.
                </p>
                <p>
                  Vi tar inga genvägar i kontrollen av din bokföring, moms eller deklaration. Det vi har
                  effektiviserat är arbetssättet – inte noggrannheten.
                </p>
              </div>
            </div>

            <div className="rounded-2xl p-8 sm:p-10" style={{ backgroundColor: NAVY }}>
              <h3 className="text-lg font-bold text-white mb-6">
                Vad gör priset lägre?
              </h3>
              <ul className="space-y-3">
                {pricingPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${CORAL}22` }}
                    >
                      <svg className="w-3 h-3" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-white/80 text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full h-px" style={{ backgroundColor: '#94a3b8' }} />

      {/* ── PASSAR / PASSAR INTE ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-left mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
              Är Enkla Bokslut rätt för dig?
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-900">
              Vi vill bara ta in kunder där vi passar
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* När det passar */}
            <div className="rounded-2xl p-8 sm:p-10" style={{ backgroundColor: NAVY }}>
              <h3 className="text-lg font-bold text-white mb-6">
                När Enkla Bokslut passar
              </h3>
              <ul className="space-y-3">
                {fitPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${CORAL}22` }}
                    >
                      <svg className="w-3 h-3" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-white/80 text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* När man bör välja annat */}
            <div className="rounded-2xl p-7 sm:p-8 border border-slate-200 bg-gray-50">
              <h3 className="text-lg font-bold text-navy-900 mb-5">
                När du bör välja en annan lösning
              </h3>
              <ul className="space-y-3">
                {notFitPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 bg-slate-200">
                      <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <span className="text-slate-700 text-sm leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
              <p className="text-slate-500 text-sm leading-relaxed mt-6 pt-5 border-t border-slate-200">
                Om något av detta stämmer in på dig kan en redovisningsbyrå med ett bredare
                tjänsteutbud vara ett bättre val. Vi är hellre tydliga med det från början, än
                lovar mer än vårt arbetssätt är byggt för att leverera.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: NAVY }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Redo att komma igång?
          </h2>
          <p className="text-white/65 mb-8 text-base sm:text-lg">
            Välj ditt paket och kom igång direkt – tydlig process, fast pris, noggrant resultat.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/#packages"
              className="px-7 py-3.5 font-semibold text-navy-900 bg-white hover:bg-gray-100 rounded-full shadow transition-all duration-200 hover:scale-[1.02]"
            >
              Välj ditt paket
            </Link>
            <Link
              href="/kontakt"
              className="px-7 py-3.5 font-semibold text-white rounded-full border border-white/20 hover:bg-white/10 transition-all duration-200"
            >
              Kontakta oss
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
