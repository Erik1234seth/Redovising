'use client';

import { useState } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';

type TabType = 'ne-bilaga' | 'komplett';

export default function TutorialPage() {
  const [activeTab, setActiveTab] = useState<TabType>('ne-bilaga');
  const [selectedBank, setSelectedBank] = useState<Bank>('swedbank');

  const bank = banks.find((b) => b.id === selectedBank);

  return (
    <div className="min-h-screen bg-navy-800 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Guider och Instruktioner
          </h1>
          <p className="text-base sm:text-xl text-warm-300 px-4">
            Steg-för-steg guider för våra tjänster
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8 sm:mb-12 px-2">
          <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-lg sm:rounded-xl p-1 sm:p-1.5 inline-flex flex-col sm:flex-row w-full sm:w-auto gap-1 sm:gap-0">
            <button
              onClick={() => setActiveTab('ne-bilaga')}
              className={`px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200 ${
                activeTab === 'ne-bilaga'
                  ? 'bg-gold-500 text-navy-900 shadow-lg shadow-gold-500/20'
                  : 'text-warm-300 hover:text-white'
              }`}
            >
              NE-Bilaga (1499 kr)
            </button>
            <button
              onClick={() => setActiveTab('komplett')}
              className={`px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all duration-200 ${
                activeTab === 'komplett'
                  ? 'bg-gold-500 text-navy-900 shadow-lg shadow-gold-500/20'
                  : 'text-warm-300 hover:text-white'
              }`}
            >
              Komplett Tjänst (3499 kr)
            </button>
          </div>
        </div>

        {/* Bank Selection */}
        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
            Välj din bank
          </h2>
          <p className="text-sm sm:text-base text-warm-300 mb-4 sm:mb-6">
            Välj din bank för att se rätt instruktioner och videor
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {banks.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBank(b.id)}
                className={`p-3 sm:p-4 border-2 rounded-lg sm:rounded-xl transition-all duration-200 ${
                  selectedBank === b.id
                    ? 'border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/20'
                    : 'border-navy-600 bg-navy-800/50 hover:border-gold-500/50'
                }`}
              >
                <div className={`font-semibold text-sm sm:text-base ${selectedBank === b.id ? 'text-gold-500' : 'text-white'}`}>
                  {b.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* NE-Bilaga Tab Content */}
        {activeTab === 'ne-bilaga' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  1
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Logga in på din banks hemsida
                </h2>
              </div>
              <p className="text-sm sm:text-base text-warm-300 ml-11 sm:ml-14">
                Använd ditt BankID för att logga in på {bank?.name}s webbplats.
              </p>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  2
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Ladda ner kontoutdrag
                </h2>
              </div>
              <p className="text-sm sm:text-base text-warm-300 mb-4 sm:mb-6 ml-11 sm:ml-14">
                Följ videon nedan för att ladda ner dina kontoutdrag från {bank?.name}.
              </p>
              <div className="ml-0 sm:ml-14">
                <VideoPlayer
                  videoUrl={bank?.downloadVideoUrl || ''}
                  title={`Ladda ner kontoutdrag från ${bank?.name}`}
                />
              </div>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  3
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Ladda upp kontoutdragen
                </h2>
              </div>
              <p className="text-sm sm:text-base text-warm-300 mb-3 sm:mb-4 ml-11 sm:ml-14">
                När du har laddat ner dina kontoutdrag, ladda upp dem via vår tjänst.
              </p>
              <div className="ml-0 sm:ml-14 bg-navy-800/50 border border-navy-600 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-warm-300">
                  <strong className="text-gold-500">Tips:</strong> Se till att filerna är i CSV eller Excel-format
                  och att alla transaktioner syns tydligt.
                </p>
              </div>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  4
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Ladda upp tidigare NE-bilaga (valfritt)
                </h2>
              </div>
              <p className="text-sm sm:text-base text-warm-300 ml-11 sm:ml-14">
                Om du har fått en NE-bilaga tidigare år kan du ladda upp den så vi kan
                använda samma struktur. Detta steg är valfritt men rekommenderas.
              </p>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  5
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Bekräfta och vänta
                </h2>
              </div>
              <p className="text-sm sm:text-base text-warm-300 mb-3 sm:mb-4 ml-11 sm:ml-14">
                Efter att du bekräftat din beställning börjar vi arbeta med din NE-bilaga.
              </p>
              <div className="ml-0 sm:ml-14 bg-gold-500/10 border border-gold-500/30 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-warm-200">
                  <strong className="text-gold-500">Inom 24 timmar</strong> får du din färdiga NE-bilaga via e-post.
                  Du lämnar sedan in den själv på Skatteverkets webbplats.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Komplett Tab Content */}
        {activeTab === 'komplett' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  1
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Logga in på din banks hemsida
                </h2>
              </div>
              <div className="ml-0 sm:ml-14 space-y-3">
                <p className="text-sm sm:text-base text-warm-300">
                  Gå till {bank?.name}s hemsida och logga in med ditt BankID.
                </p>
                <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-warm-300 mb-2">
                    <strong className="text-gold-500">Tips:</strong> Se till att du har tillgång till BankID på din mobil eller dator.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  2
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Ladda ner kontoutdrag
                </h2>
              </div>
              <div className="ml-0 sm:ml-14 space-y-3 sm:space-y-4">
                <p className="text-sm sm:text-base text-warm-300">
                  Följ stegen nedan för att ladda ner dina kontoutdrag från {bank?.name}:
                </p>
                <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-3 sm:p-4">
                  <ol className="space-y-2 text-xs sm:text-sm text-warm-300 list-decimal list-inside">
                    <li>Navigera till "Konton" eller "Mina konton" i huvudmenyn</li>
                    <li>Välj det konto som du använder för din verksamhet</li>
                    <li>Leta efter alternativet "Kontoutdrag" eller "Transaktioner"</li>
                    <li>Välj tidsperiod: Hela föregående år (1 januari - 31 december)</li>
                    <li>Välj format: CSV eller Excel</li>
                    <li>Klicka på "Ladda ner" eller "Exportera"</li>
                  </ol>
                </div>
                <VideoPlayer
                  videoUrl={bank?.downloadVideoUrl || ''}
                  title={`Ladda ner kontoutdrag från ${bank?.name}`}
                />
                <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-warm-200">
                    <strong className="text-gold-500">Viktigt:</strong> Ladda ner kontoutdrag för alla konton som är kopplade till din verksamhet.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  3
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Ladda upp kontoutdragen
                </h2>
              </div>
              <div className="ml-0 sm:ml-14 space-y-3">
                <p className="text-sm sm:text-base text-warm-300">
                  När du har laddat ner dina kontoutdrag ska du ladda upp dem via vår tjänst:
                </p>
                <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-3 sm:p-4">
                  <ol className="space-y-2 text-xs sm:text-sm text-warm-300 list-decimal list-inside">
                    <li>Gå tillbaka till din beställning på vår hemsida</li>
                    <li>Klicka på "Ladda upp kontoutdrag"</li>
                    <li>Dra och släpp filerna eller klicka för att välja dem</li>
                    <li>Vänta tills uppladdningen är klar (grön bock visas)</li>
                    <li>Klicka på "Fortsätt" när alla filer är uppladdade</li>
                  </ol>
                </div>
                <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-warm-300">
                    <strong className="text-gold-500">Godkända format:</strong> CSV och Excel (.xlsx, .xls, .csv)
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  4
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Ge oss behörighet via Skatteverket
                </h2>
              </div>
              <div className="ml-0 sm:ml-14 space-y-3 sm:space-y-4">
                <p className="text-sm sm:text-base text-warm-300">
                  För att vi ska kunna lämna in din deklaration åt dig behöver du ge oss behörighet på Skatteverkets webbplats. Följ stegen nedan:
                </p>
                <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-3 sm:p-4">
                  <ol className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-warm-300 list-decimal list-inside">
                    <li>
                      <strong className="text-white">Gå till Skatteverkets hemsida</strong>
                      <p className="ml-6 mt-1 text-warm-400">Besök skatteverket.se</p>
                    </li>
                    <li>
                      <strong className="text-white">Logga in med BankID</strong>
                      <p className="ml-6 mt-1 text-warm-400">Klicka på "Logga in" och använd ditt BankID</p>
                    </li>
                    <li>
                      <strong className="text-white">Navigera till ombud och fullmakter</strong>
                      <p className="ml-6 mt-1 text-warm-400">Gå till "Mina sidor" → "Mina ombud och fullmakter"</p>
                    </li>
                    <li>
                      <strong className="text-white">Lägg till nytt ombud</strong>
                      <p className="ml-6 mt-1 text-warm-400">Klicka på "Lägg till ombud" eller "Registrera fullmakt"</p>
                    </li>
                    <li>
                      <strong className="text-white">Ange vårt organisationsnummer</strong>
                      <p className="ml-6 mt-1 text-warm-400">Organisationsnummer: XX-XXXXXX-XXXX</p>
                    </li>
                    <li>
                      <strong className="text-white">Välj behörighet</strong>
                      <p className="ml-6 mt-1 text-warm-400">Markera "Inkomstdeklaration" i listan över behörigheter</p>
                    </li>
                    <li>
                      <strong className="text-white">Bekräfta med BankID</strong>
                      <p className="ml-6 mt-1 text-warm-400">Signera fullmakten med ditt BankID</p>
                    </li>
                  </ol>
                </div>
                <VideoPlayer
                  videoUrl={bank?.accessDelegationVideoUrl || ''}
                  title="Ge behörighet via Skatteverket"
                />
                <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-warm-200">
                    <strong className="text-gold-500">Viktigt att veta:</strong> Fullmakten gäller endast för innevarande år. Du kan när som helst återkalla behörigheten på Skatteverkets webbplats.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl sm:rounded-2xl p-6 sm:p-8">
              <div className="flex items-center mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center font-bold mr-3 sm:mr-4 text-sm sm:text-base flex-shrink-0">
                  5
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">
                  Granska och godkänn
                </h2>
              </div>
              <div className="ml-0 sm:ml-14 space-y-3 sm:space-y-4">
                <p className="text-sm sm:text-base text-warm-300">
                  Efter att du bekräftat din beställning börjar vi arbeta med din NE-bilaga och deklaration.
                </p>
                <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-3 sm:p-4">
                  <h4 className="font-semibold text-white text-sm sm:text-base mb-2 sm:mb-3">Så här går det till:</h4>
                  <ol className="space-y-2 text-xs sm:text-sm text-warm-300 list-decimal list-inside">
                    <li>Vi bearbetar dina kontoutdrag och upprättar NE-bilagan</li>
                    <li>Du får en kopia via e-post för granskning (vanligtvis inom 24 timmar)</li>
                    <li>Granska NE-bilagan noggrant och kontrollera att allt stämmer</li>
                    <li>Svara på e-postmeddelandet med ditt godkännande</li>
                    <li>Vi lämnar in deklarationen åt dig på Skatteverket</li>
                    <li>Du får en slutgiltig bekräftelse när allt är klart</li>
                  </ol>
                </div>
                <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-warm-200 mb-2">
                    <strong className="text-gold-500">Innan inlämning:</strong> Du får alltid möjlighet att granska och godkänna deklarationen innan vi lämnar in den.
                  </p>
                  <p className="text-xs sm:text-sm text-warm-200">
                    <strong className="text-gold-500">Efter inlämning:</strong> Du får en bekräftelse från både oss och Skatteverket när deklarationen är inlämnad.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Info */}
        <div className="mt-8 sm:mt-12 bg-navy-900 border border-navy-700 rounded-xl sm:rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
            Varför kan vi erbjuda så låga priser?
          </h2>
          <p className="text-sm sm:text-base text-warm-300 leading-relaxed">
            Enskilda firmor kan använda <strong className="text-gold-500">förenklad redovisning</strong>, vilket
            innebär att redovisningsprocessen är mer strömlinjeformad och effektiv jämfört
            med aktiebolag. Genom att fokusera enbart på enskilda firmor har vi kunnat
            specialisera oss och automatisera stora delar av processen, vilket gör att vi
            kan erbjuda professionell service till ett betydligt lägre pris än traditionella
            redovisningsbyråer.
          </p>
        </div>
      </div>
    </div>
  );
}
