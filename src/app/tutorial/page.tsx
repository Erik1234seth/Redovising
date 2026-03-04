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
          <div className="space-y-4">
            <div ref={firstStepRef} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm scroll-mt-24">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>1</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Logga in på din banks hemsida</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px]">
                <p className="text-sm sm:text-base text-slate-600 mb-3">
                  Använd ditt BankID för att logga in på {bank?.name}s webbplats.
                </p>
                {bank?.websiteUrl && (
                  <a href={bank.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: CORAL }}>
                    Gå till {bank.name}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>2</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Ladda ner kontoutdrag</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px]">
                <p className="text-sm sm:text-base text-slate-600 mb-5">
                  Följ videon nedan för att ladda ner dina kontoutdrag från {bank?.name}.
                </p>
                <VideoPlayer videoUrl={bank?.downloadVideoUrl || ''} title={`Ladda ner kontoutdrag från ${bank?.name}`} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>3</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Ladda upp kontoutdragen</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px]">
                <p className="text-sm sm:text-base text-slate-600 mb-3">
                  När du har laddat ner dina kontoutdrag, ladda upp dem via vår tjänst.
                </p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <p className="text-sm text-slate-600">
                    <strong className="text-navy-800">Tips:</strong> Se till att filerna är i Excel-format och att alla transaktioner syns tydligt.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>4</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Lägg till transaktioner <span className="text-slate-400 font-normal text-base">(valfritt)</span></h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px]">
                <p className="text-sm sm:text-base text-slate-600 mb-3">
                  Lägg till transaktioner som inte syns i ditt kontoutdrag, t.ex. kontantbetalningar eller fakturor.
                </p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <p className="text-sm font-semibold text-navy-800 mb-2">För varje transaktion anger du:</p>
                  <ul className="space-y-1 text-sm text-slate-600 list-disc list-inside ml-1">
                    <li>Datum</li>
                    <li>Beskrivning (t.ex. "Kontorsmaterial", "Konsultarvode")</li>
                    <li>Belopp i kronor</li>
                    <li>Typ: Inkomst eller Utgift</li>
                  </ul>
                  <p className="text-xs text-slate-400 mt-3">Detta steg är helt valfritt och kan hoppas över.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>5</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Ladda upp tidigare NE-bilaga <span className="text-slate-400 font-normal text-base">(ej första året)</span></h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px]">
                <p className="text-sm sm:text-base text-slate-600">
                  Om du har drivit din firma tidigare år, ladda upp din senaste NE-bilaga. Hoppa över detta steg om det är ditt första år.
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>6</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Bekräfta och vänta</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px]">
                <p className="text-sm sm:text-base text-slate-600 mb-3">
                  Efter att du bekräftat din beställning börjar vi arbeta med din NE-bilaga.
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
          <div className="space-y-4">
            <div ref={firstStepRef} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm scroll-mt-24">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>1</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Logga in på din banks hemsida</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px] space-y-3">
                <p className="text-sm sm:text-base text-slate-600">Gå till {bank?.name}s hemsida och logga in med ditt BankID.</p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <p className="text-sm text-slate-600"><strong className="text-navy-800">Tips:</strong> Se till att du har tillgång till BankID på din mobil eller dator.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>2</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Ladda ner kontoutdrag</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px] space-y-4">
                <p className="text-sm sm:text-base text-slate-600">Följ stegen nedan för att ladda ner dina kontoutdrag från {bank?.name}:</p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                    <li>Navigera till "Konton" eller "Mina konton"</li>
                    <li>Välj det konto du använder för din verksamhet</li>
                    <li>Leta efter "Kontoutdrag" eller "Transaktioner"</li>
                    <li>Välj tidsperiod: Hela föregående år (1 jan – 31 dec)</li>
                    <li>Välj format: Excel</li>
                    <li>Klicka på "Ladda ner" eller "Exportera"</li>
                  </ol>
                </div>
                <VideoPlayer videoUrl={bank?.downloadVideoUrl || ''} title={`Ladda ner kontoutdrag från ${bank?.name}`} />
                <div className="border-l-4 rounded-r-xl p-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                  <p className="text-sm text-slate-700"><strong style={{ color: NAV_BG }}>Viktigt:</strong> Ladda ner kontoutdrag för alla konton kopplade till din verksamhet.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>3</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Ladda upp kontoutdragen</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px] space-y-3">
                <p className="text-sm sm:text-base text-slate-600">När du laddat ner kontoutdragen, ladda upp dem via vår tjänst:</p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                    <li>Gå tillbaka till din beställning</li>
                    <li>Klicka på "Ladda upp kontoutdrag"</li>
                    <li>Dra och släpp filer eller klicka för att välja</li>
                    <li>Vänta tills uppladdningen är klar (grön bock)</li>
                    <li>Klicka på "Fortsätt"</li>
                  </ol>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: `${NAV_BG}06`, border: `1px solid ${NAV_BG}15` }}>
                  <p className="text-sm text-slate-600"><strong className="text-navy-800">Godkända format:</strong> Excel (.xlsx, .xls)</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>4</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Lägg till transaktioner <span className="text-slate-400 font-normal text-base">(valfritt)</span></h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px] space-y-3">
                <p className="text-sm sm:text-base text-slate-600">Lägg till transaktioner utanför kontoutdraget, t.ex. kontantbetalningar.</p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <p className="text-sm font-semibold text-navy-800 mb-2">För varje transaktion anger du:</p>
                  <ul className="space-y-1 text-sm text-slate-600 list-disc list-inside ml-1">
                    <li>Datum</li>
                    <li>Beskrivning</li>
                    <li>Belopp i kronor</li>
                    <li>Typ: Inkomst eller Utgift</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>5</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Registrera oss som ombud hos Skatteverket</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px] space-y-4">
                <p className="text-sm sm:text-base text-slate-600">
                  För att vi ska kunna lämna in din deklaration behöver du registrera oss som ombud hos Skatteverket.
                </p>
                <div className="border-l-4 rounded-r-xl p-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                  <p className="text-sm text-slate-700"><strong style={{ color: NAV_BG }}>Varför?</strong> Ombud-registreringen ger oss behörighet att lämna in deklarationen åt dig. Du kan återkalla den när som helst.</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
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
                <div className="border-l-4 rounded-r-xl p-4" style={{ borderColor: CORAL, backgroundColor: `${CORAL}08` }}>
                  <p className="text-sm text-slate-700"><strong style={{ color: NAV_BG }}>Viktigt:</strong> Fullmakten gäller endast innevarande år och kan återkallas när som helst.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: NAV_BG }}>6</div>
                <h2 className="text-lg sm:text-xl font-bold text-navy-900">Granska och godkänn</h2>
              </div>
              <div className="ml-[52px] sm:ml-[56px] space-y-4">
                <p className="text-sm sm:text-base text-slate-600">
                  Efter bekräftad beställning börjar vi arbeta med din NE-bilaga och deklaration.
                </p>
                <div className="rounded-xl p-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
                  <p className="text-sm font-semibold text-navy-800 mb-3">Så här går det till:</p>
                  <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
                    <li>Vi upprättar NE-bilagan utifrån dina kontoutdrag</li>
                    <li>Du får en kopia via e-post för granskning</li>
                    <li>Granska att allt stämmer</li>
                    <li>Svara med ditt godkännande</li>
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
