'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { banks } from '@/data/banks';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';

export default function BankSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  useTrackStep('bank-selection', packageType, undefined, user?.id);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  const [totalSteps, setTotalSteps] = useState(9);

  useEffect(() => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    if (answersStr) {
      const answers = JSON.parse(answersStr);
      if (packageType !== 'komplett' && answers.isFirstYear === true) {
        setTotalSteps(8);
        return;
      }
    }
    setTotalSteps(9);
  }, [packageType]);

  // Protect route - require authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/bank-selection`);
    }
  }, [user, loading, router, packageType]);

  const handleContinue = () => {
    if (selectedBank) {
      router.push(`/flow/${packageType}/download-guide?bank=${selectedBank}`);
    }
  };

  return (
    <FlowContainer
      title="Välj din bank"
      description="Vi behöver veta vilken bank du använder för att visa rätt instruktioner."
      currentStep={packageType === 'komplett' || packageType === 'ne-bilaga' ? 2 : 1}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {banks.map((bank) => (
          <button
            key={bank.id}
            onClick={() => setSelectedBank(bank.id)}
            className={`group relative p-6 rounded-xl transition-all duration-200 text-left border-2 bg-white ${
              selectedBank === bank.id ? '' : 'border-gray-200 hover:border-slate-300'
            }`}
            style={selectedBank === bank.id ? { borderColor: NAV_BG, backgroundColor: `${NAV_BG}06` } : {}}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-1 ${selectedBank === bank.id ? '' : 'text-slate-800'}`}
                  style={selectedBank === bank.id ? { color: NAV_BG } : {}}>
                  {bank.name}
                </h3>
                <p className="text-sm text-slate-400">
                  Klicka för att välja
                </p>
              </div>
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all"
                style={selectedBank === bank.id
                  ? { backgroundColor: NAV_BG }
                  : { backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }}
              >
                {selectedBank === bank.id ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Contact option for unlisted banks */}
        <Link
          href="/kontakt"
          className="md:col-span-2 group relative p-6 rounded-xl transition-all duration-200 text-left bg-white border-2 border-gray-200 hover:border-amber-400/60 hover:bg-amber-50/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1 text-slate-800 group-hover:text-amber-600 transition-colors">
                Min bank finns inte här
              </h3>
              <p className="text-sm text-slate-400">
                Kontakta oss för hjälp - nämn gärna vilken bank du har
              </p>
            </div>
            <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all bg-gray-100 border border-gray-200 group-hover:border-amber-400/50 group-hover:bg-amber-50">
              <svg className="w-6 h-6 text-slate-400 group-hover:text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <button
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-800 font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedBank}
          className="px-8 py-3 rounded-xl font-bold transition-all duration-200 text-white"
          style={selectedBank
            ? { backgroundColor: NAV_BG }
            : { backgroundColor: '#d1d5db', color: '#9ca3af', cursor: 'not-allowed' }}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
