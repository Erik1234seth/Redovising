const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const APP_URL = 'https://app.enklabokslut.se/integrationer';

type Step = { number: number; action: string; detail: string; highlight?: string };

const steps: Step[] = [
  {
    number: 1,
    action: 'Logga in i Enkla Bokslut',
    detail: 'Gå till app.enklabokslut.se och logga in på ditt konto.',
  },
  {
    number: 2,
    action: 'Öppna Integrationer',
    detail: 'Under Integrationer hittar du allt du kan koppla: kassa, webbutik och bank.',
  },
  {
    number: 3,
    action: 'Skriv in din butiks adress',
    detail: 'Fyll i din Shopify-adress, till exempel din-butik.myshopify.com. Du hittar den i Shopify under Inställningar → Domäner.',
  },
  {
    number: 4,
    action: 'Klicka på "Koppla Shopify"',
    detail: 'Du skickas vidare till Shopify. Logga in och godkänn att appen Enkla Bokslut installeras i din butik.',
    highlight: 'Vi får bara läsa. Vi kan inte ändra ordrar, produkter eller priser, och vi kan inte flytta pengar.',
  },
  {
    number: 5,
    action: 'Klart, försäljningen hämtas direkt',
    detail: 'När du kommer tillbaka hämtar vi all försäljning sedan årets början. Efter det hämtas nya ordrar automatiskt varje morgon.',
  },
];

const bokfors = [
  'Försäljning per momssats (25, 12 och 6 %)',
  'Betalsätt, till exempel Shopify Payments, PayPal och Klarna',
  'Returer och återbetalningar',
  'Shopify Payments avgifter',
  'Utbetalningar från Shopify till ditt bankkonto',
];

export default function ShopifyGuidePage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="py-14 sm:py-20 text-center px-4" style={{ backgroundColor: NAV_BG }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Kassasystem</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Koppla Shopify
        </h1>
        <p className="text-white/65 text-base sm:text-lg">Din butiks försäljning bokförs automatiskt, varje dag</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">

        {/* Intro card */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            Har du en webbutik i <strong style={{ color: NAV_BG }}>Shopify</strong> kan du koppla den direkt till Enkla Bokslut. Du behöver inte exportera eller maila något: vi hämtar butikens försäljning och bokför varje dag som en dagskassa. Det tar ungefär en minut att koppla.
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
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{step.detail}</p>
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

          <a
            href={APP_URL}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: CORAL }}
          >
            Koppla Shopify nu
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>

        {/* What gets booked */}
        <div>
          <h2 className="text-xl font-extrabold mb-4" style={{ color: NAV_BG }}>Det här bokför vi åt dig</h2>
          <ul className="space-y-2.5">
            {bokfors.map((rad) => (
              <li key={rad} className="flex items-start gap-3 text-sm text-slate-600">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {rad}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500 mt-4 leading-relaxed">
            Varje dag med försäljning blir en egen verifikation. Du ser dem under Bokföring och kan när som helst hämta om manuellt från Integrationer.
          </p>
        </div>
      </div>
    </div>
  );
}
