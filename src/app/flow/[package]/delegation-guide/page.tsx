'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';

export default function DelegationGuidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const [hasCompleted, setHasCompleted] = useState(false);

  const bank = banks.find((b) => b.id === bankId);
  const totalSteps = 5;

  const handleContinue = () => {
    if (hasCompleted) {
      router.push(`/flow/${packageType}/confirmation?bank=${bankId}`);
    }
  };

  return (
    <FlowContainer
      title="Ge oss behörighet via Skatteverket"
      description="För att vi ska kunna lämna in din deklaration behöver du ge oss behörighet via Skatteverket."
      currentStep={4}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="mb-8">
        <VideoPlayer
          videoUrl={bank?.accessDelegationVideoUrl || ''}
          title="Så här ger du oss behörighet via Skatteverket"
        />
      </div>

      <div className="bg-primary-50 border-l-4 border-primary-600 p-6 mb-8">
        <h3 className="font-semibold text-primary-900 mb-3">
          Steg för steg:
        </h3>
        <ol className="space-y-3 text-primary-800">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
              1
            </span>
            <span>Logga in på Skatteverkets webbplats med BankID</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
              2
            </span>
            <span>Gå till "Mina ombud och fullmakter"</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
              3
            </span>
            <span>Klicka på "Lägg till ombud"</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
              4
            </span>
            <span>Ange vårt organisationsnummer: <strong>XX-XXXXXX-XXXX</strong></span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold mr-3">
              5
            </span>
            <span>Välj behörigheten "Inkomstdeklaration" och bekräfta</span>
          </li>
        </ol>
      </div>

      <div className="bg-trust-50 border border-trust-200 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-trust-900 mb-3 flex items-center">
          <svg
            className="w-6 h-6 text-primary-600 mr-2"
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
          Säkerhet och kontroll
        </h3>
        <ul className="space-y-2 text-sm text-trust-700">
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
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
            <span>Du kan när som helst återkalla behörigheten via Skatteverket</span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
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
            <span>Vi kan endast lämna in deklarationen - ingen annan åtkomst</span>
          </li>
          <li className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
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
            <span>Du får en kopia på allt vi lämnar in innan det skickas</span>
          </li>
        </ul>
      </div>

      <div className="mb-8">
        <label className="flex items-start space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={hasCompleted}
            onChange={(e) => setHasCompleted(e.target.checked)}
            className="mt-1 w-5 h-5 text-primary-600 border-trust-300 rounded focus:ring-primary-500"
          />
          <span className="text-trust-700 group-hover:text-trust-900">
            Jag bekräftar att jag har gett Redovisningsbyrån behörighet via Skatteverket
            att lämna in min inkomstdeklaration
          </span>
        </label>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="text-trust-600 hover:text-trust-900 font-medium"
        >
          ← Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!hasCompleted}
          className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
            hasCompleted
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-trust-300 text-trust-500 cursor-not-allowed'
          }`}
        >
          Fortsätt
        </button>
      </div>
    </FlowContainer>
  );
}
