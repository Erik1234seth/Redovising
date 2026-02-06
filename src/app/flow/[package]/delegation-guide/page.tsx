'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function DelegationGuidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const [hasCompleted, setHasCompleted] = useState(false);

  const bank = banks.find((b) => b.id === bankId);
  // Komplett always has 9 steps
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

      <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-xl p-6 mb-8">
        <h3 className="font-bold text-gold-500 mb-3 text-lg">
          Varför behöver jag göra detta?
        </h3>
        <p className="text-sm sm:text-base text-warm-200">
          Genom att registrera oss som ombud får vi behörighet att lämna in din inkomstdeklaration direkt till Skatteverket åt dig.
          Du behåller full kontroll och kan när som helst återkalla behörigheten på Skatteverkets webbplats.
        </p>
      </div>

      <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 sm:p-8 mb-8">
        <h3 className="font-semibold text-white mb-4 text-lg">
          Steg för steg - Registrera ombud:
        </h3>
        <ol className="space-y-4 text-warm-200">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              1
            </span>
            <div>
              <strong className="text-white block mb-1">Gå till Skatteverkets hemsida</strong>
              <span className="text-sm text-warm-300">Besök skatteverket.se</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              2
            </span>
            <div>
              <strong className="text-white block mb-1">Sök efter "ombud"</strong>
              <span className="text-sm text-warm-300">Skriv "ombud" i sökfältet på hemsidan</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              3
            </span>
            <div>
              <strong className="text-white block mb-1">Välj "Ombud för en privatperson"</strong>
              <span className="text-sm text-warm-300">Klicka på länken i sökresultatet</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              4
            </span>
            <div>
              <strong className="text-white block mb-1">Logga in med e-legitimation</strong>
              <span className="text-sm text-warm-300">Använd BankID eller annan e-legitimation för att logga in</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              5
            </span>
            <div>
              <strong className="text-white block mb-1">Välj "Utse person som ombud"</strong>
              <span className="text-sm text-warm-300">Klicka på alternativet för att utse ett nytt ombud</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              6
            </span>
            <div>
              <strong className="text-white block mb-1">Välj din enskilda firma</strong>
              <span className="text-sm text-warm-300">Välj den firma du vill ge oss behörighet för</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              7
            </span>
            <div>
              <strong className="text-white block mb-1">Ange personnumret vi skickar till dig</strong>
              <span className="text-sm text-warm-300">Du får ett personnummer via e-post som du skriver in i rutan</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              8
            </span>
            <div>
              <strong className="text-white block mb-1">Välj behörighet "Deklarationsombud"</strong>
              <span className="text-sm text-warm-300">Markera deklarationsombud i listan över behörigheter</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              9
            </span>
            <div>
              <strong className="text-white block mb-1">Valfritt: Sätt ett slutdatum</strong>
              <span className="text-sm text-warm-300">Om du vill kan du ange ett "till och med"-datum. Se till att det är efter deklarationens deadline. Om du sätter ett slutdatum behöver du ge ett nytt medgivande till nästa år.</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              10
            </span>
            <div>
              <strong className="text-white block mb-1">Granska och godkänn</strong>
              <span className="text-sm text-warm-300">Kontrollera att uppgifterna stämmer och klicka i bekräftelserutan</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              11
            </span>
            <div>
              <strong className="text-white block mb-1">Skriv under och skicka in</strong>
              <span className="text-sm text-warm-300">Klicka på "Skriv under och skicka in"</span>
            </div>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold-500 text-navy-900 flex items-center justify-center text-sm font-bold mr-4">
              12
            </span>
            <div>
              <strong className="text-white block mb-1">Godkänn med BankID</strong>
              <span className="text-sm text-warm-300">Signera med BankID. När det är klart ser du en bekräftelse på att allt är registrerat.</span>
            </div>
          </li>
        </ol>
      </div>

      <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 sm:p-8 mb-8">
        <h3 className="font-semibold text-white mb-4 flex items-center text-lg">
          <svg
            className="w-6 h-6 text-gold-500 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Din säkerhet och kontroll
        </h3>
        <ul className="space-y-3 text-sm text-warm-200">
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Du kan när som helst återkalla behörigheten via Skatteverkets webbplats</span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Vi kan endast lämna in deklarationen - ingen annan åtkomst till dina uppgifter</span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Du får alltid en kopia på allt vi lämnar in innan det skickas till Skatteverket</span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Fullmakten gäller endast för innevarande år</span>
          </li>
        </ul>
      </div>

      <div className="mb-8 bg-navy-800/50 border border-navy-600 rounded-xl p-6">
        <label className="flex items-start space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={hasCompleted}
            onChange={(e) => setHasCompleted(e.target.checked)}
            className="mt-1 w-5 h-5 text-gold-500 bg-navy-700 border-navy-600 rounded focus:ring-gold-500 focus:ring-offset-navy-800"
          />
          <span className="text-warm-200 group-hover:text-white font-medium">
            Jag bekräftar att jag har registrerat er som ombud hos Skatteverket och givit behörighet att lämna in min inkomstdeklaration
          </span>
        </label>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-6 border-t border-navy-600">
        <button
          onClick={() => router.back()}
          className="text-warm-300 hover:text-white font-semibold transition-colors flex items-center justify-center sm:justify-start py-3 sm:py-0"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!hasCompleted}
          className={`px-8 py-3 rounded-xl font-bold transition-all duration-200 w-full sm:w-auto ${
            hasCompleted
              ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105'
              : 'bg-navy-600 text-navy-400 cursor-not-allowed'
          }`}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
