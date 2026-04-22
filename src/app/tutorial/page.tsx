'use client';

import { useState } from 'react';
import Link from 'next/link';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

function StepSection({ number, label, title, children }: {
  number: number;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-5 sm:gap-7">
      <div className="flex flex-col items-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0"
          style={{ backgroundColor: NAV_BG }}
        >
          {number}
        </div>
        <div className="w-px flex-1 mt-3" style={{ backgroundColor: '#e5e7eb' }} />
      </div>
      <div className="pb-12 flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CORAL }}>{label}</p>
        <h2 className="text-lg sm:text-xl font-bold mb-4" style={{ color: NAV_BG }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function TutorialPage() {
  const [selectedBank, setSelectedBank] = useState<Bank>('swedbank');
  const bank = banks.find((b) => b.id === selectedBank);

  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="py-14 sm:py-20 text-center" style={{ backgroundColor: NAV_BG }}>
        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: CORAL }}>Guider</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3">
          Steg-för-steg instruktioner
        </h1>
        <p className="text-white/65 text-base sm:text-lg">Så här fungerar ditt abonnemang i praktiken</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        {/* Intro note */}
        <div className="rounded-2xl p-5 mb-12" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}15` }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong style={{ color: NAV_BG }}>Hej och välkommen.</strong> Nedan hittar du en genomgång av hur vi jobbar tillsammans. Vi går igenom allt i ditt introsamtal, men den här sidan finns alltid att gå tillbaka till.
          </p>
        </div>

        {/* Steps */}
        <div>

          {/* Step 1 */}
          <StepSection number={1} label="Kom igång" title="Introsamtal och mall">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-4">
              När du börjar som kund bokar vi ett kort introsamtal. Vi går igenom hur du fyller i kalkylarket, svarar på frågor och ser till att du känner dig trygg med processen innan vi sätter igång.
            </p>
            <div className="rounded-xl p-4" style={{ backgroundColor: `${CORAL}08`, border: `1px solid ${CORAL}25` }}>
              <p className="text-sm text-slate-700">
                Du får vår mall — ett Excel- eller Google Kalkylark — skickat till dig. Det är det enda dokument du behöver för din löpande bokföring.
              </p>
            </div>
          </StepSection>

          {/* Step 2 */}
          <StepSection number={2} label="Varje månad" title="Fyll i dina transaktioner">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5">
              Varje månad (eller kvartal om du föredrar det) fyller du i dina transaktioner i kalkylarket och delar det med oss. Det tar vanligtvis bara några minuter.
            </p>
            <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
              <p className="text-sm font-semibold mb-4" style={{ color: NAV_BG }}>Varje rad är en transaktion med fyra kolumner:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                {['Datum', 'Beskrivning', 'Belopp', 'Momsprocent'].map((col) => (
                  <div key={col} className="rounded-lg py-2.5 px-2 font-semibold text-white" style={{ backgroundColor: NAV_BG }}>
                    {col}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Exempel: <span className="font-mono">2025-03-01 | Faktura kund A | 15 000 | 25%</span>
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: `${CORAL}08`, border: `1px solid ${CORAL}25` }}>
              <p className="text-sm text-slate-700">
                <strong style={{ color: NAV_BG }}>Tips:</strong> Är du osäker på momssatsen på en transaktion? Lämna en kommentar i cellen så kollar vi upp det.
              </p>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              Vill du läsa mer om hur du skickar in? <Link href="/sa-skickar-du-in" className="font-semibold underline underline-offset-2" style={{ color: NAV_BG }}>Se vår guide här →</Link>
            </p>
          </StepSection>

          {/* Step 3 */}
          <StepSection number={3} label="Vi sköter resten" title="Löpande bokföring hos oss">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-4">
              När vi får in dina transaktioner bokför vi dem löpande. Du behöver inte hålla koll på deadlines eller påminna oss — vi hör av oss om något saknas eller är oklart.
            </p>
            <div className="space-y-3">
              {[
                'Vi bokför alla transaktioner i enlighet med god redovisningssed',
                'Vi hör av oss om vi har frågor kring specifika transaktioner',
                'Du kan alltid kontakta oss om du undrar något',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${CORAL}25` }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: CORAL }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </StepSection>

          {/* Step 4 */}
          <StepSection number={4} label="Vid årets slut" title="NE-bilaga och momsredovisning klar">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-4">
              Eftersom vi bokfört löpande hela året är allt underlag redan på plats när det är dags för bokslut. Din NE-bilaga och momsredovisning upprättas utan stress.
            </p>
            <div className="rounded-xl p-4" style={{ backgroundColor: `${CORAL}08`, border: `1px solid ${CORAL}25` }}>
              <p className="text-sm text-slate-700">
                Du får din färdiga NE-bilaga skickad till dig och kan granska den innan vi lämnar in. Deklarationen ska lämnas in i <strong style={{ color: NAV_BG }}>maj</strong> året efter.
              </p>
            </div>
          </StepSection>

          {/* Step 5 — ombud, optional */}
          <StepSection number={5} label="Valfritt" title="Vill du att vi lämnar in åt dig?">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-5">
              Om du vill att vi sköter inlämningen till Skatteverket åt dig behöver du registrera oss som ombud. Det tar ett par minuter och görs en gång.
            </p>

            {/* Bank selector for ombud video */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-5">
              <p className="text-sm font-semibold mb-3" style={{ color: NAV_BG }}>Välj din bank för att se rätt instruktionsvideo</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {banks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBank(b.id)}
                    className="p-2.5 border-2 rounded-xl text-xs font-semibold transition-all duration-200"
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

            <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: `${NAV_BG}08`, border: `1px solid ${NAV_BG}20` }}>
              <ol className="space-y-2.5 text-sm text-slate-600 list-decimal list-inside">
                <li>Gå till <strong className="text-slate-800">skatteverket.se</strong> och logga in med BankID</li>
                <li>Gå till <strong className="text-slate-800">"Mina sidor" → "Mina ombud och fullmakter"</strong></li>
                <li>Klicka på <strong className="text-slate-800">"Lägg till ombud"</strong></li>
                <li>Ange vårt organisationsnummer och välj behörighet <strong className="text-slate-800">Inkomstdeklaration</strong></li>
                <li>Bekräfta med BankID</li>
              </ol>
            </div>

            {bank?.accessDelegationVideoUrl && (
              <VideoPlayer videoUrl={bank.accessDelegationVideoUrl} title="Registrera ombud hos Skatteverket" />
            )}

            <p className="text-sm text-slate-500 mt-4">
              Mer detaljer om ombudsregistrering finns på <Link href="/ombud" className="font-semibold underline underline-offset-2" style={{ color: NAV_BG }}>vår ombudssida →</Link>
            </p>
          </StepSection>

          {/* Last step — no line below */}
          <div className="flex gap-5 sm:gap-7">
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: CORAL }}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="pb-4 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: CORAL }}>Klart</p>
              <h2 className="text-lg sm:text-xl font-bold mb-3" style={{ color: NAV_BG }}>Din bokföring är i ordning</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Det var allt. Fortsätt skicka in transaktioner löpande och vi håller din bokföring uppdaterad året runt.
              </p>
            </div>
          </div>

        </div>

        {/* Warning box */}
        <div className="mt-10 bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-800 mb-2">Viktigt att tänka på</h3>
              <div className="space-y-2 text-sm text-amber-700 leading-relaxed">
                <p><strong>Du ansvarar för att underlagen stämmer.</strong> Vi bokför utifrån det du skickar in, men du är ansvarig för att ha kvitton och fakturor till alla transaktioner.</p>
                <p><strong>Vi hör av oss om något är oklart.</strong> Om vi har frågor om en specifik transaktion kontaktar vi dig via e-post.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Why low price */}
        <div className="mt-6 rounded-2xl p-6 sm:p-8" style={{ backgroundColor: NAV_BG }}>
          <h3 className="text-lg font-bold text-white mb-3">Varför kan vi erbjuda så låga priser?</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Enskilda firmor kan använda <strong className="text-white">förenklad redovisning</strong>, vilket gör processen mer effektiv jämfört med aktiebolag. Genom att fokusera enbart på enskilda firmor och ta emot strukturerad data i ett fast format har vi automatiserat stora delar av processen — och delar den besparingen med dig.
          </p>
        </div>

      </div>
    </div>
  );
}
