'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';

export default function UploadPreviousPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasNoPrevious, setHasNoPrevious] = useState(false);

  const bank = banks.find((b) => b.id === bankId);
  const totalSteps = 5;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setHasNoPrevious(false);
    }
  };

  const handleContinue = () => {
    router.push(`/flow/${packageType}/confirmation?bank=${bankId}`);
  };

  return (
    <FlowContainer
      title="Ladda upp tidigare NE-bilaga (om tillämpligt)"
      description="Om du har fått en NE-bilaga tidigare år, ladda upp den här så vi kan använda samma struktur."
      currentStep={4}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="mb-8">
        <VideoPlayer
          videoUrl={bank?.downloadVideoUrl || ''}
          title={`Så här hittar du din tidigare NE-bilaga i ${bank?.name}`}
        />
      </div>

      <div className="border-2 border-dashed border-trust-300 rounded-lg p-12 text-center bg-trust-50 mb-6">
        {selectedFile ? (
          <div>
            <svg
              className="w-16 h-16 text-green-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-trust-900 mb-2">
              Fil uppladdad!
            </h3>
            <p className="text-trust-600 mb-4">{selectedFile.name}</p>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Välj en annan fil
            </button>
          </div>
        ) : (
          <div>
            <svg
              className="w-16 h-16 text-trust-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h3 className="text-lg font-semibold text-trust-900 mb-2">
              Ladda upp tidigare NE-bilaga
            </h3>
            <p className="text-trust-600 mb-4">PDF-format föredras</p>
            <label className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold cursor-pointer transition-colors">
              Välj fil från dator
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf"
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      <div className="text-center mb-8">
        <p className="text-trust-700 mb-3">Har du ingen tidigare NE-bilaga?</p>
        <label className="flex items-center justify-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasNoPrevious}
            onChange={(e) => {
              setHasNoPrevious(e.target.checked);
              if (e.target.checked) {
                setSelectedFile(null);
              }
            }}
            className="w-5 h-5 text-primary-600 border-trust-300 rounded focus:ring-primary-500"
          />
          <span className="text-trust-700">
            Jag har ingen tidigare NE-bilaga (första året som enskild firma)
          </span>
        </label>
      </div>

      <div className="bg-primary-50 border-l-4 border-primary-600 p-6 mb-8">
        <h3 className="font-semibold text-primary-900 mb-2">
          Varför behöver vi detta?
        </h3>
        <p className="text-sm text-primary-800">
          Genom att få tillgång till din tidigare NE-bilaga kan vi säkerställa att
          vi följer samma struktur och kategorisering som du använt tidigare. Detta
          gör processen smidigare och mer konsekvent år efter år.
        </p>
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
          disabled={!selectedFile && !hasNoPrevious}
          className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
            selectedFile || hasNoPrevious
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
