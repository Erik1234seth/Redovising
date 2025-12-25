'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';

export default function BankSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const packageType = params.package as string;
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  const totalSteps = packageType === 'ne-bilaga' ? 5 : 5;

  const handleContinue = () => {
    if (selectedBank) {
      router.push(`/flow/${packageType}/download-guide?bank=${selectedBank}`);
    }
  };

  return (
    <FlowContainer
      title="Välj din bank"
      description="Vi behöver veta vilken bank du använder för att visa rätt instruktioner."
      currentStep={1}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {banks.map((bank) => (
          <button
            key={bank.id}
            onClick={() => setSelectedBank(bank.id)}
            className={`group relative p-6 rounded-xl transition-all duration-200 text-left ${
              selectedBank === bank.id
                ? 'bg-gradient-to-br from-gold-500/20 to-gold-600/10 border-2 border-gold-500 shadow-lg shadow-gold-500/20'
                : 'bg-navy-800/50 border-2 border-navy-600 hover:border-gold-500/50 hover:bg-navy-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-1 ${
                  selectedBank === bank.id ? 'text-gold-500' : 'text-white'
                }`}>
                  {bank.name}
                </h3>
                <p className="text-sm text-warm-400">
                  Klicka för att välja
                </p>
              </div>
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                selectedBank === bank.id
                  ? 'bg-gold-500 shadow-lg shadow-gold-500/50'
                  : 'bg-navy-700 border border-navy-600 group-hover:border-gold-500/50'
              }`}>
                {selectedBank === bank.id ? (
                  <svg
                    className="w-6 h-6 text-navy-900"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6 text-warm-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-navy-600">
        <button
          onClick={() => router.back()}
          className="text-warm-300 hover:text-white font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedBank}
          className={`px-8 py-3 rounded-xl font-bold transition-all duration-200 ${
            selectedBank
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
