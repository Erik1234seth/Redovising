'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';

export default function DownloadGuidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const bank = banks.find((b) => b.id === bankId);
  const totalSteps = 6;

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
      <div className="mb-8">
        <VideoPlayer
          videoUrl={bank.downloadVideoUrl || ''}
          title={`Så här laddar du ner kontoutdrag från ${bank.name}`}
        />
      </div>

      <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-lg p-6 mb-8">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-gold-500/20 rounded-lg flex items-center justify-center mr-4">
            <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gold-500 mb-3 text-lg">
              Viktigt att tänka på:
            </h3>
            <ul className="space-y-2 text-warm-200">
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-gold-500 mr-2 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Ladda ner kontoutdrag för hela räkenskapsåret</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-gold-500 mr-2 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Filformatet ska vara CSV eller Excel</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-gold-500 mr-2 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Se till att alla transaktioner syns tydligt</span>
              </li>
            </ul>
          </div>
        </div>
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
          className="px-8 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105"
        >
          Jag har laddat ner mina kontoutdrag →
        </button>
      </div>
    </FlowContainer>
  );
}
