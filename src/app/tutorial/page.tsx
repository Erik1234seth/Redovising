'use client';

import { useState, useRef } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

type TabType = 'ne-bilaga' | 'komplett';

function StepCard({ number, title, children, ref: forwardedRef }: {
  number: number;
  title: string;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={forwardedRef} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm scroll-mt-24">
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
          style={{ backgroundColor: NAV_BG }}
        >
          {number}
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-navy-900">{title}</h2>
      </div>
      <div className="ml-[52px] sm:ml-[56px]">{children}</div>
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
      {children}
    </div>
  );
}

function HighlightBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-4 rounded-r-xl p-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: CORAL }}>{label}</p>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

export default function TutorialPage() {
  const [activeTab, setActiveTab] = useState<TabType>('ne-bilaga');
  const [selectedBank, setSelectedBank] = useState<Bank>('swedbank');
  const firstStepRef = useRef<HTMLDivElement>(null);

  const bank = banks.find((b) => b.id === selectedBank);

  const handleBankSelect = (bankId: Bank) => {
    setSelectedBank(bankId);
    if (window.innerWidth < 768) {
      setTimeout(() => {
        firstStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="py-14 sm:py-20 text-center" style={{ backgroundColor: NAV_BG }}>
        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
          Guider
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Steg-för-steg instruktioner
        </h1>
        <p className="text-white/65 text-base sm:text-lg">
          Allt du behöver veta, förklarat på ett enkelt sätt
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* ── Package explanations ── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="rounded-2xl p-6 border border-gray-200 bg-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CORAL }}>NE-Bilaga — 1 999 kr</p>
            <h2 className="text-lg font-bold mb-2" style={{ color: NAV_BG }}>Vad ingår?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Vi upprättar din <strong>NE-bilaga</strong> — det dokument som visar resultatet av din enskilda firma och som bifogas din inkomstdeklaration. Du lämnar sedan in den själv hos Skatteverket.
            </p>
          </div>
          <div className="rounded-2xl p-6 border border-gray-200 bg-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CORAL }}>Komplett — 3 499 kr</p>
            <h2 className="text-lg font-bold mb-2" style={{ color: NAV_BG }}>Vad ingår?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Vi gör allt — bokföring, NE-bilaga <strong>och</strong> lämnar in deklarationen åt dig hos Skatteverket. Du behöver bara registrera oss som ombud, vilket tar ett par minuter.
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-5 mb-10" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}15` }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong style={{ color: NAV_BG }}>Stegen nedan är för dig som är osäker</strong> på hur du hämtar ditt kontoutdrag från banken eller registrerar ombud hos Skatteverket. Välj ditt paket, så hör vi av oss med personliga instruktioner.
          </p>
        </div>

        {/* ── Tab nav ── */}
        <div className="flex justify-center mb-10">
          <div className="bg-gray-100 rounded-xl p-1.5 grid grid-cols-2 sm:inline-flex gap-1 w-full sm:w-auto">
            {([
              { id: 'ne-bilaga', label: 'NE-Bilaga', price: '1 999 kr' },
              { id: 'komplett', label: 'Komplett', price: '3 499 kr' },
            ] as const).map(({ id, label, price }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                style={activeTab === id
                  ? { backgroundColor: NAV_BG, color: '#fff', boxShadow: '0 2px 8px rgba(23,59,87,0.25)' }
                  : { color: '#64748b' }
                }
              >
                {label} <span className="opacity-70 ml-1 text-xs">{price}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Bank selection ── */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-lg font-bold text-navy-900 mb-1">Välj din bank</h2>
          <p className="text-sm text-slate-500 mb-5">Välj din bank för att se rätt instruktioner och videor</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {banks.map((b) => (
              <button
                key={b.id}
                onClick={() => handleBankSelect(b.id)}
                className="p-3 sm:p-4 border-2 rounded-xl transition-all duration-200 font-semibold text-sm"
                style={selectedBank === b.id
                  ? { borderColor: NAV_BG, backgroundColor: `${NAV_BG}0d`, color: NAV_BG }
                  : { borderColor: '#e5e7eb', backgroundColor: 'white', color: '#374151' }
                }
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── NE-Bilaga steps ── */}
        {activeTab === 'ne-bilaga' && (
          <div ref={firstStepRef} className="space-y-8">

            {/* --- Kontoutdrag --- */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: CORAL }}>Kontoutdrag</p>
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Ladda ner kontoutdrag från din bank</h2>
                  <div className="border-l-4 rounded-r-xl p-4 mb-5" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                    <p className="text-sm text-slate-700">
                      I instruktionsmailet kommer vi be dig om dina kontoutdrag. Nedan hittar du instruktioner för hur du hämtar dem från din bank.
                    </p>
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 mb-3">
                    Logga in på {bank?.name}s webbplats med BankID och ladda ner kontoutdrag för hela föregående år i Excel-format.
                  </p>
                  {bank?.websiteUrl && (
                    <a href={bank.websiteUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline mb-5" style={{ color: CORAL }}>
                      Gå till {bank.name}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <VideoPlayer videoUrl={bank?.downloadVideoUrl || ''} title={`Ladda ner kontoutdrag från ${bank?.name}`} />
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Lägg till transaktioner som saknas <span className="text-slate-400 font-normal text-base">(valfritt)</span></h2>
                  <p className="text-sm sm:text-base text-slate-600 mb-4">
                    Om du har betalningar eller inkomster som inte syns i kontoutdraget — t.ex. kontantbetalningar eller Swish-transaktioner på ett privat konto — kan du lägga till dem direkt i Excel-filen.
                  </p>
                  <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                    <p className="text-sm font-semibold mb-3" style={{ color: NAV_BG }}>Öppna Excel-filen och lägg till en ny rad med:</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      {['Datum', 'Beskrivning / namn', 'Belopp (kr)'].map((col) => (
                        <div key={col} className="rounded-lg py-2 px-3 font-medium text-white text-xs" style={{ backgroundColor: NAV_BG }}>{col}</div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Exempel: <span className="font-mono">2025-03-15 | Kontant betalning kund | 1500</span></p>
                  </div>
                  <p className="text-xs text-slate-400">Är du osäker på om en transaktion ska vara med? Lägg med den ändå — vi hör av oss om något är oklart.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Maila kontoutdragen till oss</h2>
                  <p className="text-sm sm:text-base text-slate-600 mb-3">
                    Skicka filen som bilaga till den e-postadress vi angett i vårt mail till dig.
                  </p>
                  <div className="rounded-xl p-3" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
                    <p className="text-sm text-slate-600"><strong className="text-navy-800">Format:</strong> Excel (.xlsx, .xls)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Klart --- */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: CORAL }}>Sedan sköter vi resten</p>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Vi gör klart din NE-bilaga</h2>
                <p className="text-sm sm:text-base text-slate-600 mb-3">
                  När vi fått dina kontoutdrag upprättar vi NE-bilagan och skickar den till dig via e-post.
                </p>
                <div className="border-l-4 rounded-r-xl p-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                  <p className="text-sm text-slate-700">
                    Du får din färdiga NE-bilaga via e-post <strong style={{ color: NAV_BG }}>så snart som möjligt</strong>. Du lämnar sedan in den själv på Skatteverkets webbplats.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── Komplett steps ── */}
        {activeTab === 'komplett' && (
          <div ref={firstStepRef} className="space-y-8">

            {/* --- Kontoutdrag --- */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: CORAL }}>Kontoutdrag</p>
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Ladda ner kontoutdrag från din bank</h2>
                  <div className="border-l-4 rounded-r-xl p-4 mb-5" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                    <p className="text-sm text-slate-700">
                      I instruktionsmailet kommer vi be dig om dina kontoutdrag. Nedan hittar du instruktioner för hur du hämtar dem från din bank.
                    </p>
                  </div>
                  <p className="text-sm sm:text-base text-slate-600 mb-4">
                    Logga in på {bank?.name}s webbplats med BankID och ladda ner kontoutdrag för hela föregående år i Excel-format.
                  </p>
                  {bank?.websiteUrl && (
                    <a href={bank.websiteUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline mb-5" style={{ color: CORAL }}>
                      Gå till {bank.name}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <VideoPlayer videoUrl={bank?.downloadVideoUrl || ''} title={`Ladda ner kontoutdrag från ${bank?.name}`} />
                  <div className="border-l-4 rounded-r-xl p-4 mt-4" style={{ borderColor: NAV_BG, backgroundColor: `${NAV_BG}06` }}>
                    <p className="text-sm text-slate-600"><strong className="text-navy-800">Viktigt:</strong> Ladda ner kontoutdrag för alla konton kopplade till din verksamhet.</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Lägg till transaktioner som saknas <span className="text-slate-400 font-normal text-base">(valfritt)</span></h2>
                  <p className="text-sm sm:text-base text-slate-600 mb-4">
                    Om du har betalningar eller inkomster som inte syns i kontoutdraget — t.ex. kontantbetalningar eller Swish-transaktioner på ett privat konto — kan du lägga till dem direkt i Excel-filen.
                  </p>
                  <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                    <p className="text-sm font-semibold mb-3" style={{ color: NAV_BG }}>Öppna Excel-filen och lägg till en ny rad med:</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      {['Datum', 'Beskrivning / namn', 'Belopp (kr)'].map((col) => (
                        <div key={col} className="rounded-lg py-2 px-3 font-medium text-white text-xs" style={{ backgroundColor: NAV_BG }}>{col}</div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Exempel: <span className="font-mono">2025-03-15 | Kontant betalning kund | 1500</span></p>
                  </div>
                  <p className="text-xs text-slate-400">Är du osäker på om en transaktion ska vara med? Lägg med den ändå — vi hör av oss om något är oklart.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Maila kontoutdragen till oss</h2>
                  <p className="text-sm sm:text-base text-slate-600 mb-3">
                    Skicka filen som bilaga till den e-postadress vi angett i vårt mail till dig.
                  </p>
                  <div className="rounded-xl p-3" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
                    <p className="text-sm text-slate-600"><strong className="text-navy-800">Format:</strong> Excel (.xlsx, .xls)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Ombud --- */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: CORAL }}>Ombud hos Skatteverket</p>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Registrera oss som ombud</h2>
                <p className="text-sm sm:text-base text-slate-600 mb-4">
                  För att vi ska kunna lämna in din deklaration behöver du registrera oss som ombud hos Skatteverket. Det tar bara ett par minuter.
                </p>
                <div className="border-l-4 rounded-r-xl p-4 mb-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                  <p className="text-sm text-slate-700"><strong style={{ color: NAV_BG }}>Varför?</strong> Ombud-registreringen ger oss behörighet att lämna in deklarationen åt dig. Du kan återkalla den när som helst.</p>
                </div>
                <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <ol className="space-y-3 text-sm text-slate-600 list-decimal list-inside">
                    <li><strong className="text-navy-800">Gå till Skatteverkets hemsida</strong> – skatteverket.se</li>
                    <li><strong className="text-navy-800">Logga in med BankID</strong></li>
                    <li><strong className="text-navy-800">Gå till</strong> "Mina sidor" → "Mina ombud och fullmakter"</li>
                    <li><strong className="text-navy-800">Lägg till ombud</strong> – klicka "Lägg till ombud"</li>
                    <li><strong className="text-navy-800">Ange organisationsnummer:</strong> XX-XXXXXX-XXXX</li>
                    <li><strong className="text-navy-800">Välj behörighet:</strong> Inkomstdeklaration</li>
                    <li><strong className="text-navy-800">Bekräfta med BankID</strong></li>
                  </ol>
                </div>
                <VideoPlayer videoUrl={bank?.accessDelegationVideoUrl || ''} title="Ge behörighet via Skatteverket" />
                <div className="border-l-4 rounded-r-xl p-4 mt-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                  <p className="text-sm text-slate-700"><strong style={{ color: NAV_BG }}>Viktigt:</strong> Fullmakten gäller endast innevarande år och kan återkallas när som helst.</p>
                </div>
              </div>
            </div>

            {/* --- Klart --- */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: CORAL }}>Sedan sköter vi resten</p>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Vi sköter resten</h2>
                <p className="text-sm sm:text-base text-slate-600 mb-4">
                  När vi fått dina kontoutdrag och ombud-registreringen klar tar vi hand om allt.
                </p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                    <li>Vi upprättar NE-bilagan utifrån dina kontoutdrag</li>
                    <li>Du får en kopia via e-post för granskning</li>
                    <li>Granska att allt stämmer och svara med ditt godkännande</li>
                    <li>Vi lämnar in deklarationen åt dig</li>
                    <li>Du får slutgiltig bekräftelse</li>
                  </ol>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── Warning box ── */}
        <div className="mt-10 bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-800 mb-3">Viktigt att tänka på</h2>
              <div className="space-y-2 text-sm text-amber-700 leading-relaxed">
                <p><strong>Du ansvarar för dina underlag.</strong> Vi utgår från dina kontoutdrag, men du är ansvarig för att ha underlag för alla transaktioner.</p>
                <p>Spara kvitton och fakturor – vid en granskning från Skatteverket kan du behöva visa upp dessa.</p>
                <p><strong>Vi hör av oss om något är oklart.</strong> Om vi har frågor om specifika transaktioner kontaktar vi dig via e-post.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Why low prices ── */}
        <div className="mt-6 rounded-2xl p-6 sm:p-8" style={{ backgroundColor: NAV_BG }}>
          <h2 className="text-lg font-bold text-white mb-3">Varför kan vi erbjuda så låga priser?</h2>
          <p className="text-sm text-white/65 leading-relaxed">
            Enskilda firmor kan använda <strong className="text-white">förenklad redovisning</strong>, vilket gör processen mer effektiv jämfört med aktiebolag. Genom att fokusera enbart på enskilda firmor har vi automatiserat stora delar av processen – och kan därför erbjuda professionell service till ett betydligt lägre pris.
          </p>
        </div>
      </div>
    </div>
  );
}
