'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';

export default function DelegationGuidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;
  useTrackStep('delegation-guide', packageType, bankId, user?.id);

  const [hasCompleted, setHasCompleted] = useState(false);

  const bank = banks.find((b) => b.id === bankId);
  const totalSteps = 9;

  // Protect route - require authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/delegation-guide?bank=${bankId}`);
    }
  }, [user, loading, router, packageType, bankId]);

  const handleContinue = () => {
    if (hasCompleted) {
      router.push(`/flow/${packageType}/contact-info?bank=${bankId}`);
    }
  };

  const steps = [
    { title: 'Gå till Skatteverkets hemsida', desc: 'Besök skatteverket.se' },
    { title: 'Sök efter "ombud"', desc: 'Skriv "ombud" i sökfältet på hemsidan' },
    { title: 'Välj "Ombud för en privatperson"', desc: 'Klicka på länken i sökresultatet' },
    { title: 'Logga in med e-legitimation', desc: 'Använd BankID eller annan e-legitimation för att logga in' },
    { title: 'Välj "Utse person som ombud"', desc: 'Klicka på alternativet för att utse ett nytt ombud' },
    { title: 'Välj din enskilda firma', desc: 'Välj den firma du vill ge oss behörighet för' },
    { title: 'Ange personnumret vi skickar till dig', desc: 'Du får ett personnummer via e-post som du skriver in i rutan' },
    { title: 'Välj behörighet "Deklarationsombud"', desc: 'Markera deklarationsombud i listan över behörigheter' },
    { title: 'Valfritt: Sätt ett slutdatum', desc: 'Om du vill kan du ange ett "till och med"-datum. Se till att det är efter deklarationens deadline. Om du sätter ett slutdatum behöver du ge ett nytt medgivande till nästa år.' },
    { title: 'Granska och godkänn', desc: 'Kontrollera att uppgifterna stämmer och klicka i bekräftelserutan' },
    { title: 'Skriv under och skicka in', desc: 'Klicka på "Skriv under och skicka in"' },
    { title: 'Godkänn med BankID', desc: 'Signera med BankID. När det är klart ser du en bekräftelse på att allt är registrerat.' },
  ];

  return (
    <FlowContainer
      title="Registrera oss som ombud hos Skatteverket"
      description="För att vi ska kunna lämna in din deklaration åt dig behöver du registrera oss som ombud hos Skatteverket."
      currentStep={6}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="mb-8">
        <VideoPlayer
          videoUrl="/videos/ombudny.mp4"
          title="Så här registrerar du oss som ombud hos Skatteverket"
        />
      </div>

      {/* Info box */}
      <div className="rounded-r-xl p-6 mb-8 border-l-4" style={{ backgroundColor: `${NAV_BG}08`, borderLeftColor: NAV_BG }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: NAV_BG }}>
          Varför behöver jag göra detta?
        </h3>
        <p className="text-sm sm:text-base text-slate-700">
          Genom att registrera oss som ombud får vi behörighet att lämna in din inkomstdeklaration direkt till Skatteverket åt dig.
          Du behåller full kontroll och kan när som helst återkalla behörigheten på Skatteverkets webbplats.
        </p>
      </div>

      {/* Steps */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 sm:p-8 mb-8">
        <h3 className="font-semibold mb-4 text-lg" style={{ color: NAV_BG }}>
          Steg för steg - Registrera ombud:
        </h3>
        <ol className="space-y-4 text-slate-700">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-4 text-white"
                style={{ backgroundColor: NAV_BG }}>
                {i + 1}
              </span>
              <div>
                <strong className="text-slate-800 block mb-1">{step.title}</strong>
                <span className="text-sm text-slate-500">{step.desc}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Security info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 sm:p-8 mb-8">
        <h3 className="font-semibold mb-4 flex items-center text-lg" style={{ color: NAV_BG }}>
          <svg className="w-6 h-6 mr-2" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Din säkerhet och kontroll
        </h3>
        <ul className="space-y-3 text-sm text-slate-600">
          {[
            'Du kan när som helst återkalla behörigheten via Skatteverkets webbplats',
            'Vi kan endast lämna in deklarationen - ingen annan åtkomst till dina uppgifter',
            'Du får alltid en kopia på allt vi lämnar in innan det skickas till Skatteverket',
            'Fullmakten gäller endast för innevarande år',
          ].map((point) => (
            <li key={point} className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Confirmation checkbox */}
      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-6">
        <label className="flex items-start space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={hasCompleted}
            onChange={(e) => setHasCompleted(e.target.checked)}
            className="mt-1 w-5 h-5 rounded flex-shrink-0"
            style={{ accentColor: NAV_BG }}
          />
          <span className="text-slate-700 group-hover:text-slate-900 font-medium">
            Jag bekräftar att jag har registrerat er som ombud hos Skatteverket och givit behörighet att lämna in min inkomstdeklaration
          </span>
        </label>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-800 font-semibold transition-colors flex items-center justify-center sm:justify-start py-3 sm:py-0"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!hasCompleted}
          className="px-8 py-3 rounded-xl font-bold transition-all duration-200 w-full sm:w-auto text-white"
          style={hasCompleted
            ? { backgroundColor: NAV_BG }
            : { backgroundColor: '#d1d5db', color: '#9ca3af', cursor: 'not-allowed' }}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
