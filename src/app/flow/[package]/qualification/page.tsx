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
  isMomspliktig: boolean | null;
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
    isMomspliktig: null,
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
      title="Berätta lite om din firma"
      description="Vi behöver veta detta för att upprätta rätt bokslut åt dig."
      currentStep={1}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="bg-navy-800/50 border border-navy-600 rounded-xl divide-y divide-navy-600 mb-8">
        {([
          { key: 'hasSeparateAccount', label: 'Separat bankkonto för firman?' },
          { key: 'hasEmployees', label: 'Har du anställda?' },
          { key: 'hasTaxPayments', label: 'Inbetalningar till Skatteverket i år?' },
          { key: 'isFirstYear', label: 'Första året med enskild firma?' },
          { key: 'isMomspliktig', label: 'Är du momspliktig?' },
        ] as { key: keyof QualificationAnswers; label: string }[]).map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4 gap-4">
            <p className="text-white font-medium text-sm">{label}</p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleAnswer(key, true)}
                className={`py-1.5 px-5 rounded-lg font-semibold text-sm transition-all ${
                  answers[key] === true
                    ? 'bg-[#E95C63] text-white'
                    : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
                }`}
              >
                Ja
              </button>
              <button
                onClick={() => handleAnswer(key, false)}
                className={`py-1.5 px-5 rounded-lg font-semibold text-sm transition-all ${
                  answers[key] === false
                    ? 'bg-[#E95C63] text-white'
                    : 'bg-navy-700 text-warm-300 hover:bg-navy-600 border border-navy-600'
                }`}
              >
                Nej
              </button>
            </div>
          </div>
        ))}
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
