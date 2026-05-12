import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const steps = [
  {
    number: 1,
    action: 'Logga in på Zettle',
    detail: 'Gå till Zettles webbportal och logga in med dina uppgifter.',
  },
  {
    number: 2,
    action: 'Gå till Rapporter → Översikt',
    detail: 'I vänstermenyn hittar du "Rapporter". Klicka där och välj "Översikt" — det är härifrån du når all försäljningsdata och bokföringsinformation.',
  },
  {
    number: 3,
    action: 'Välj datumintervall',
    detail: 'Välj den period du vill exportera — en månad, ett kvartal, eller ett specifikt intervall vi bett om. Exempel: 1 januari – 31 januari.',
  },
  {
    number: 4,
    action: 'Klicka på "Exportera"',
    detail: 'Knappen finns uppe på sidan, synlig när du har valt din period.',
  },
  {
    number: 5,
    action: 'Välj "Rådata Excel"',
    detail: null,
    highlight: 'Välj "Rådata Excel" — inte PDF. Rådata-exporten innehåller mest information och fungerar bäst för bokföring.',
  },
  {
    number: 6,
    action: 'Maila filen till oss',
    detail: 'Excel-filen laddas ner till din dator. Skicka den till oss via e-post så tar vi hand om resten.',
  },
];

export default function ZettleGuidePage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="py-14 sm:py-20 text-center px-4" style={{ backgroundColor: NAV_BG }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Kassasystem</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Exportera från Zettle
        </h1>
        <p className="text-white/65 text-base sm:text-lg">Hämta dina försäljningsdata direkt ur Zettles webbportal</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">

        {/* Intro card */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong style={{ color: NAV_BG }}>Zettle by PayPal</strong> har en inbyggd rapportfunktion som samlar all din försäljning, moms och transaktionsdata på ett ställe. Genom att exportera rådata som Excel-fil får vi precis det vi behöver — utan att du behöver plocka ihop något manuellt.
          </p>
        </div>

        {/* Steps */}
        <div>
          <h2 className="text-xl font-extrabold mb-6" style={{ color: NAV_BG }}>Steg för steg</h2>
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.number} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0"
                    style={{ backgroundColor: NAV_BG }}
                  >
                    {step.number}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 my-2" style={{ backgroundColor: '#e5e7eb' }} />
                  )}
                </div>
                <div className="pb-7 flex-1">
                  <p className="font-bold text-slate-800 leading-snug">{step.action}</p>
                  {step.detail && (
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{step.detail}</p>
                  )}
                  {step.highlight && (
                    <div className="mt-2 rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}18` }}>
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: NAV_BG }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-slate-700 leading-relaxed">{step.highlight}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Send + warning */}
        <div className="space-y-4">
          <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: NAV_BG }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="font-bold text-sm mb-1" style={{ color: NAV_BG }}>Skicka Excel-filen till oss via e-post</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Maila filen direkt till oss. Vi tar emot den, går igenom transaktionerna och bokför allt — du behöver inte göra något mer.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-6 sm:p-8 bg-amber-50" style={{ border: '1px solid #FCD34D' }}>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold text-sm mb-1 text-amber-800">Lägg inte in dessa transaktioner i kalkylarket</p>
                <p className="text-sm text-amber-700 leading-relaxed">
                  Zettle-exporten ersätter kalkylarket för de försäljningar som gått via Zettle. Om du lägger in dem manuellt i kalkylarket också bokförs de dubbelt. Skicka antingen Excel-filen <em>eller</em> fyll i kalkylarket — aldrig båda för samma transaktioner.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="pt-2">
          <Link
            href="/tutorial"
            className="text-sm font-semibold underline underline-offset-2"
            style={{ color: NAV_BG }}
          >
            ← Tillbaka till guider
          </Link>
        </div>

      </div>
    </div>
  );
}
