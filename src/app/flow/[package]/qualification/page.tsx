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
      <div className="space-y-4 mb-8">
        {/* Question 1 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="font-semibold mb-4" style={{ color: '#173b57' }}>
            Har du ett separat bankkonto för din enskilda firma?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('hasSeparateAccount', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasSeparateAccount === true
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.hasSeparateAccount === true ? { backgroundColor: '#E95C63' } : {}}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('hasSeparateAccount', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasSeparateAccount === false
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.hasSeparateAccount === false ? { backgroundColor: '#E95C63' } : {}}
            >
              Nej
            </button>
          </div>
        </div>

        {/* Question 2 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="font-semibold mb-4" style={{ color: '#173b57' }}>
            Har du anställda i din enskilda firma?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('hasEmployees', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasEmployees === true
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.hasEmployees === true ? { backgroundColor: '#E95C63' } : {}}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('hasEmployees', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasEmployees === false
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.hasEmployees === false ? { backgroundColor: '#E95C63' } : {}}
            >
              Nej
            </button>
          </div>
        </div>

        {/* Question 3 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="font-semibold mb-4" style={{ color: '#173b57' }}>
            Har du gjort inbetalningar till Skatteverket som berör årets verksamhet?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('hasTaxPayments', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasTaxPayments === true
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.hasTaxPayments === true ? { backgroundColor: '#E95C63' } : {}}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('hasTaxPayments', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.hasTaxPayments === false
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.hasTaxPayments === false ? { backgroundColor: '#E95C63' } : {}}
            >
              Nej
            </button>
          </div>
        </div>

        {/* Question 4 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="font-semibold mb-4" style={{ color: '#173b57' }}>
            Är detta ditt första år med enskild firma?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleAnswer('isFirstYear', true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.isFirstYear === true
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.isFirstYear === true ? { backgroundColor: '#E95C63' } : {}}
            >
              Ja
            </button>
            <button
              onClick={() => handleAnswer('isFirstYear', false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                answers.isFirstYear === false
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:border-gray-300'
              }`}
              style={answers.isFirstYear === false ? { backgroundColor: '#E95C63' } : {}}
            >
              Nej
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-100">
        <button
          onClick={() => router.push('/')}
          className="text-slate-400 hover:text-slate-700 font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!allQuestionsAnswered}
          className={`px-8 py-3 rounded-xl font-bold transition-all duration-200 text-white ${
            allQuestionsAnswered
              ? 'hover:scale-105 shadow-sm'
              : 'opacity-40 cursor-not-allowed'
          }`}
          style={{ backgroundColor: allQuestionsAnswered ? '#173b57' : '#173b57' }}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
