'use client';

import VideoPlayer from '@/components/VideoPlayer';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function OmbudPage() {
  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="py-14 sm:py-20 text-center" style={{ backgroundColor: NAV_BG }}>
        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
          Komplett-paketet
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Registrera oss som ombud
        </h1>
        <p className="text-white/65 text-base sm:text-lg">
          Tar bara ett par minuter — vi sköter resten
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">

        {/* Intro */}
        <div className="border-l-4 rounded-r-xl p-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
          <p className="text-sm text-slate-700">
            <strong style={{ color: NAV_BG }}>Varför?</strong> Ombud-registreringen ger oss behörighet att lämna in deklarationen åt dig. Du kan återkalla den när som helst.
          </p>
        </div>

        {/* Steps */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold mb-5" style={{ color: NAV_BG }}>Så här gör du</h2>
          <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
            <ol className="space-y-3 text-sm text-slate-600 list-decimal list-inside">
              <li><strong className="text-slate-800">Gå till Skatteverkets hemsida</strong> – skatteverket.se</li>
              <li><strong className="text-slate-800">Logga in med BankID</strong></li>
              <li><strong className="text-slate-800">Gå till</strong> "Mina sidor" → "Mina ombud och fullmakter"</li>
              <li><strong className="text-slate-800">Lägg till ombud</strong> – klicka "Lägg till ombud"</li>
              <li><strong className="text-slate-800">Ange organisationsnummer:</strong> XX-XXXXXX-XXXX</li>
              <li><strong className="text-slate-800">Välj behörighet:</strong> Inkomstdeklaration</li>
              <li><strong className="text-slate-800">Bekräfta med BankID</strong></li>
            </ol>
          </div>
          <VideoPlayer videoUrl="/videos/ombudny.mp4" title="Registrera ombud hos Skatteverket" />
        </div>

        {/* Note */}
        <div className="border-l-4 rounded-r-xl p-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
          <p className="text-sm text-slate-700">
            <strong style={{ color: NAV_BG }}>Viktigt:</strong> Fullmakten gäller endast innevarande år och kan återkallas när som helst.
          </p>
        </div>

      </div>
    </div>
  );
}
