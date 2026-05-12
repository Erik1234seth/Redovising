import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const steps = [
  {
    number: 1,
    action: 'Logga in på Shopify',
    detail: 'Gå till Settings → Payments',
  },
  {
    number: 2,
    action: 'Klicka på "View payouts"',
    detail: null,
  },
  {
    number: 3,
    action: 'Klicka på "View transactions"',
    detail: null,
  },
  {
    number: 4,
    action: 'Klicka på "Export"',
    detail: null,
  },
  {
    number: 5,
    action: 'Välj datumintervall och CSV-format',
    detail: 'Se till att du väljer hela räkenskapsåret du vill redovisa.',
  },
  {
    number: 6,
    action: 'Klicka på "Export balance transactions"',
    detail: 'En CSV-fil laddas nu ner till din dator.',
  },
];

const includes = [
  'Försäljning',
  'Moms',
  'Refunds',
  'Shopify-avgifter',
  'Utbetalningar',
];

export default function ShopifyGuidePage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="py-14 sm:py-20 text-center px-4" style={{ backgroundColor: NAV_BG }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Kassasystem</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Exportera från Shopify
        </h1>
        <p className="text-white/65 text-base sm:text-lg">Så här hämtar du dina transaktioner ur Shopify Payments</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">

        {/* Why this method */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: CORAL }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm mb-0.5" style={{ color: NAV_BG }}>Rekommenderad metod — Shopify Payments-export</p>
              <p className="text-sm text-slate-500">Den här rapporten innehåller allt vi behöver för att bokföra din verksamhet:</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 ml-10">
            {includes.map((item) => (
              <span
                key={item}
                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ backgroundColor: `${NAV_BG}10`, color: NAV_BG }}
              >
                {item}
              </span>
            ))}
          </div>
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
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result / CTA */}
        <div className="space-y-4">
          <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: NAV_BG }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="font-bold text-sm mb-1" style={{ color: NAV_BG }}>Skicka CSV-filen till oss via e-post</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  När filen är nedladdad mailar du den direkt till oss. Vi tar emot den, går igenom transaktionerna och bokför allt — du behöver inte göra något mer.
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
                  Shopify-exporten ersätter kalkylarket för de transaktioner som kommer via Shopify Payments. Om du lägger in dem manuellt i kalkylarket också riskerar vi att bokföra dem dubbelt. Skicka antingen CSV-filen <em>eller</em> fyll i kalkylarket — aldrig båda för samma transaktioner.
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
