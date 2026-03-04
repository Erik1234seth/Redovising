'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function DownloadGuidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;
  useTrackStep('download-guide', packageType, bankId, user?.id);

  const bank = banks.find((b) => b.id === bankId);

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
      router.push(`/auth/login?redirect=/flow/${packageType}/download-guide?bank=${bankId}`);
    }
  }, [user, loading, router, packageType, bankId]);

  if (!bank) {
    return <div>Bank hittades inte</div>;
  }

  const handleContinue = () => {
    router.push(`/flow/${packageType}/upload-statement?bank=${bankId}`);
  };

  return (
    <FlowContainer
      title="Ladda ner dina kontoutdrag"
      description={`Följ videon nedan för att ladda ner dina kontoutdrag från ${bank.name}.`}
      currentStep={2}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="mb-6">
        <a
          href={bank.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center font-semibold transition-colors hover:opacity-80"
          style={{ color: CORAL }}
        >
          Gå till {bank.name}
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <div className="mb-8">
        <VideoPlayer
          videoUrl={bank.downloadVideoUrl || ''}
          title={`Så här laddar du ner kontoutdrag från ${bank.name}`}
        />
      </div>

      {/* Info box */}
      <div className="rounded-r-lg p-6 mb-8 border-l-4" style={{ backgroundColor: `${NAV_BG}08`, borderLeftColor: NAV_BG }}>
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: `${NAV_BG}15` }}>
            <svg className="w-5 h-5" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold mb-3 text-lg" style={{ color: NAV_BG }}>
              Viktigt att tänka på:
            </h3>
            <ul className="space-y-2 text-slate-700">
              {[
                'Ladda ner kontoutdrag för hela räkenskapsåret',
                'Filformatet ska vara Excel',
                'Se till att alla transaktioner syns tydligt',
              ].map((point) => (
                <li key={point} className="flex items-start">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
          className="px-6 py-3 text-white rounded-xl font-bold transition-all duration-200 hover:opacity-90 text-sm sm:text-base w-full sm:w-auto"
          style={{ backgroundColor: NAV_BG }}
        >
          Fortsätt →
        </button>
      </div>
    </FlowContainer>
  );
}
