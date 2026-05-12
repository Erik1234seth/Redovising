import Link from 'next/link';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

const lagerExamples = ['Kläder', 'Smycken', 'Hudvårdsprodukter', 'Elektronik', 'Livsmedel', 'Reservdelar', 'E-handelsprodukter'];
const notLager = ['Datorer', 'Mobiltelefoner', 'Kontorsmaterial', 'Verktyg', 'Programvaror'];
const noLagerBusiness = ['Tjänsteförsäljning', 'Konsultverksamhet', 'Coaching', 'Frilans', 'Digitala produkter'];

export default function LagerPage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="py-14 sm:py-20 text-center px-4" style={{ backgroundColor: NAV_BG }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Bokslut</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Lager i enskild firma
        </h1>
        <p className="text-white/65 text-base sm:text-lg max-w-xl mx-auto">Behöver du ange ett lagervärde? Den här guiden hjälper dig ta reda på det.</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">

        {/* Why we ask */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong style={{ color: NAV_BG }}>Varför frågar vi om lager?</strong> Om du har varor kvar i verksamheten vid årets slut kan dessa behöva tas upp i bokslutet och på NE-bilagan. För många enskilda firmor är detta dock inte aktuellt — den här guiden hjälper dig avgöra om det gäller dig.
          </p>
        </div>

        {/* Step 1 */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>
              1
            </div>
            <h2 className="text-xl font-extrabold" style={{ color: NAV_BG }}>Har du varor kvar för försäljning?</h2>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Du har lager om du vid årets slut har produkter kvar som är avsedda att säljas vidare.
          </p>

          {/* Lager vs inte lager */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl p-5" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: NAV_BG }}>Räknas som lager</p>
              <ul className="space-y-2">
                {lagerExamples.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: NAV_BG }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-5 bg-gray-50" style={{ border: '1px solid #e5e7eb' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Räknas normalt inte som lager</p>
              <p className="text-xs text-slate-400 mb-3">Dessa är istället inventarier eller förbrukningsmaterial:</p>
              <ul className="space-y-2">
                {notLager.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-slate-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* No inventory businesses */}
          <div className="rounded-2xl p-5 sm:p-6" style={{ backgroundColor: `${CORAL}08`, border: `1px solid ${CORAL}20` }}>
            <p className="text-sm font-bold mb-3" style={{ color: NAV_BG }}>Dessa verksamheter har vanligtvis inget lager</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {noLagerBusiness.map((item) => (
                <span key={item} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-slate-600" style={{ border: '1px solid #e5e7eb' }}>
                  {item}
                </span>
              ))}
            </div>
            <p className="text-sm text-slate-600">
              Driver du en sådan verksamhet räcker det att meddela oss: <strong style={{ color: NAV_BG }}>"Inget lager."</strong>
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: '#e5e7eb' }} />

        {/* Step 2 */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>
              2
            </div>
            <h2 className="text-xl font-extrabold" style={{ color: NAV_BG }}>Om du har lager — så värderar du det</h2>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Om du har varor kvar vid årets slut behöver vi ett uppskattat lagervärde per den <strong style={{ color: NAV_BG }}>31 december</strong>. Det behöver inte vara exakt, men det ska vara rimligt uppskattat.
          </p>

          {/* Valuation rule */}
          <div className="rounded-2xl p-5 sm:p-6 mb-5" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
            <div className="flex items-start gap-4">
              <div>
                <p className="text-sm font-bold mb-3" style={{ color: NAV_BG }}>Värdera efter inköpspris — inte försäljningspris</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: `${NAV_BG}10` }}>
                    <p className="text-xs font-bold mb-1" style={{ color: NAV_BG }}>Använd</p>
                    <p className="text-sm text-slate-700">Vad du <em>betalade</em> för varan</p>
                  </div>
                  <div className="rounded-xl p-3 text-center bg-gray-50" style={{ border: '1px solid #e5e7eb' }}>
                    <p className="text-xs font-bold mb-1 text-slate-400">Använd inte</p>
                    <p className="text-sm text-slate-400">Vad du <em>säljer</em> varan för</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Example calculation */}
          <div className="rounded-2xl p-5 sm:p-6 mb-5" style={{ backgroundColor: `${CORAL}08`, border: `1px solid ${CORAL}20` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: CORAL }}>Exempel</p>
            <div className="space-y-2 text-sm text-slate-700 mb-4">
              <p>Du har kvar <strong>10 tröjor</strong> vid årets slut.</p>
              <p>Inköpspris: <strong>200 kr/styck</strong></p>
            </div>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: NAV_BG }}>
              <span className="text-white/60 text-sm font-mono">10 × 200 kr</span>
              <span className="text-white/40">=</span>
              <span className="text-white font-extrabold text-base">2 000 kr i lagervärde</span>
            </div>
          </div>

          {/* Estimate is fine */}
          <div className="rounded-2xl p-5 sm:p-6 mb-5" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
            <p className="text-sm font-bold mb-2" style={{ color: NAV_BG }}>Vet du inte exakt? En uppskattning räcker.</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Det är helt okej att skriva något i stil med: <em>"Cirka 15 000 kr i produkter kvar vid årets slut."</em> För de flesta enskilda firmor med förenklat årsbokslut är det mer än tillräckligt.
            </p>
          </div>

          {/* Shopify/Amazon tip */}
          <div className="rounded-2xl p-5 sm:p-6" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
            <p className="text-sm font-bold mb-2" style={{ color: NAV_BG }}>Använder du Shopify, Amazon eller liknande?</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Du kan ofta hitta underlaget direkt i systemet — leta efter lageröversikt, inventory reports eller produktöversikt. Där framgår vanligtvis antal produkter kvar och ibland även ett uppskattat lagervärde.
            </p>
            <p className="text-sm text-slate-600">Skärmdump eller export från systemet fungerar utmärkt som underlag.</p>
          </div>
        </div>

        {/* What to send */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: NAV_BG }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="font-bold text-sm mb-2" style={{ color: NAV_BG }}>Det här skickar du till oss</p>
              <ul className="space-y-1.5">
                {[
                  'Uppskattat lagervärde per 31 december',
                  'Export eller skärmdump från ditt system (om möjligt)',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: NAV_BG }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: NAV_BG }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: CORAL }}>Sammanfattning</p>
          <p className="text-white/80 text-sm mb-5">Du behöver bara ta ställning till två frågor:</p>
          <div className="space-y-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-white text-sm font-semibold mb-1">Har du produkter kvar som ska säljas vidare?</p>
              <p className="text-white/55 text-sm">Om nej → meddela oss "Inget lager" — klart.</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-white text-sm font-semibold mb-1">Om ja — vad kostade de att köpa in?</p>
              <p className="text-white/55 text-sm">Uppskatta totalt inköpsvärde per 31 december och skicka till oss.</p>
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
