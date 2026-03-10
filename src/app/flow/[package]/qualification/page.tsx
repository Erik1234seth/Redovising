'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { useAuth } from '@/contexts/AuthContext';

interface QualificationAnswers {
  hasSeparateAccount: boolean | null;
  hasEmployees: boolean | null;
  hasTaxPayments: boolean | null;
  isFirstYear: boolean | null;
}

export default function QualificationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  useTrackStep('qualification', packageType, undefined, user?.id);
  const [answers, setAnswers] = useState<QualificationAnswers>({
    hasSeparateAccount: null,
    hasEmployees: null,
    hasTaxPayments: null,
    isFirstYear: null,
  });

  const totalSteps = 9;

  useEffect(() => {
    if (packageType !== 'komplett' && packageType !== 'ne-bilaga') {
      router.push(`/flow/${packageType}/bank-selection`);
    }
  }, [packageType, router]);

  const handleAnswer = (question: keyof QualificationAnswers, value: boolean) => {
    setAnswers(prev => ({ ...prev, [question]: value }));
  };

  const allQuestionsAnswered = Object.values(answers).every(v => v !== null);

  const handleContinue = () => {
    sessionStorage.setItem(`qualificationAnswers_${packageType}`, JSON.stringify(answers));
    router.push(`/flow/${packageType}/book-meeting`);
  };

  return (
    <FlowContainer
      title="Några snabba frågor"
      description="För att vi ska kunna hjälpa dig på bästa sätt behöver vi veta lite mer om din verksamhet."
      currentStep={1}
      totalSteps={totalSteps}
      packageType={packageType}
      hideProgress={true}
    >
      <div className="space-y-6 mb-8">
        {/* Question 1 */}
        <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-5">
          <p className="text-white font-medium mb-4">
            Har du ett separat bankkonto för din enskilda firma?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('hasSeparateAccount', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasSeparateAccount === true
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('hasSeparateAccount', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasSeparateAccount === false
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Nej
            </button>
          </div>
        </div>

        {/* Question 2 */}
        <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-5">
          <p className="text-white font-medium mb-4">
            Har du anställda i din enskilda firma?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('hasEmployees', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasEmployees === true
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('hasEmployees', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasEmployees === false
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Nej
            </button>
          </div>
        </div>

        {/* Question 3 */}
        <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-5">
          <p className="text-white font-medium mb-4">
            Har du gjort inbetalningar till Skatteverket som berör årets verksamhet?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('hasTaxPayments', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasTaxPayments === true
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('hasTaxPayments', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasTaxPayments === false
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Nej
            </button>
          </div>
        </div>

        {/* Question 4 */}
        <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-5">
          <p className="text-white font-medium mb-4">
            Är detta ditt första år med enskild firma?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('isFirstYear', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.isFirstYear === true
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('isFirstYear', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.isFirstYear === false
                  ? 'bg-[#E95C63] text-white'
                  : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
              }`}
            >
              Nej
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-navy-600">
        <button
          onClick={() => router.push('/')}
          className="text-warm-300 hover:text-white font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!allQuestionsAnswered}
          className={`px-8 py-3 rounded-xl font-bold transition-all duration-200 ${
            allQuestionsAnswered
              ? 'bg-[#E95C63] hover:bg-[#d04e55] text-white shadow-lg hover:scale-105'
              : 'bg-navy-600 text-navy-400 cursor-not-allowed'
          }`}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
