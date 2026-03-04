'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { useAuth } from '@/contexts/AuthContext';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

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

  // Redirect if not komplett or ne-bilaga
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
    router.push(`/flow/${packageType}/method-selection`);
  };

  const questions: { key: keyof QualificationAnswers; label: string }[] = [
    { key: 'hasSeparateAccount', label: 'Har du ett separat bankkonto för din enskilda firma?' },
    { key: 'hasEmployees', label: 'Har du anställda i din enskilda firma?' },
    { key: 'hasTaxPayments', label: 'Har du gjort inbetalningar till Skatteverket som berör årets verksamhet?' },
    { key: 'isFirstYear', label: 'Är detta ditt första år med enskild firma?' },
  ];

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
        {questions.map(({ key, label }) => (
          <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <p className="text-slate-800 font-medium mb-4">{label}</p>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => handleAnswer(key, val)}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all border ${
                    answers[key] === val
                      ? 'text-white border-transparent'
                      : 'bg-white text-slate-600 border-gray-200 hover:border-slate-300'
                  }`}
                  style={answers[key] === val ? { backgroundColor: NAV_BG } : {}}
                >
                  {val ? 'Ja' : 'Nej'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <button
          onClick={() => router.push('/')}
          className="text-slate-500 hover:text-slate-800 font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!allQuestionsAnswered}
          className="px-8 py-3 rounded-xl font-bold transition-all duration-200 text-white"
          style={allQuestionsAnswered ? { backgroundColor: NAV_BG } : { backgroundColor: '#d1d5db', color: '#9ca3af', cursor: 'not-allowed' }}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
