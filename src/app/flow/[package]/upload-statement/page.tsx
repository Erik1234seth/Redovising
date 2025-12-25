'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { Bank } from '@/types';

export default function UploadStatementPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalSteps = packageType === 'ne-bilaga' ? 5 : 5;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleContinue = () => {
    if (selectedFile) {
      // I framtiden: Ladda upp filen till servern här
      if (packageType === 'ne-bilaga') {
        router.push(`/flow/${packageType}/upload-previous?bank=${bankId}`);
      } else {
        router.push(`/flow/${packageType}/delegation-guide?bank=${bankId}`);
      }
    }
  };

  return (
    <FlowContainer
      title="Ladda upp dina kontoutdrag"
      description="Ladda upp de kontoutdrag du just laddade ner från din bank."
      currentStep={3}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
          isDragging
            ? 'border-gold-500 bg-gold-500/10 scale-[1.02]'
            : selectedFile
            ? 'border-gold-500/50 bg-gold-500/5'
            : 'border-navy-600 bg-navy-800/30 hover:border-gold-500/30 hover:bg-navy-800/50'
        }`}
      >
        {selectedFile ? (
          <div>
            <div className="w-20 h-20 bg-gold-500/20 border-2 border-gold-500 rounded-xl flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-gold-500"
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
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Fil uppladdad!
            </h3>
            <p className="text-warm-300 mb-4 font-medium">{selectedFile.name}</p>
            <p className="text-sm text-warm-400 mb-4">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-gold-500 hover:text-gold-400 font-semibold transition-colors"
            >
              Välj en annan fil
            </button>
          </div>
        ) : (
          <div>
            <div className="w-20 h-20 bg-navy-700 border-2 border-navy-600 rounded-xl flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-warm-400"
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
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Dra och släpp din fil här
            </h3>
            <p className="text-warm-400 mb-6">eller</p>
            <label className="inline-block px-8 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-xl font-bold cursor-pointer transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105">
              Välj fil från dator
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.xlsx,.xls"
                className="hidden"
              />
            </label>
            <p className="text-sm text-warm-500 mt-6">
              Godkända filformat: PDF, Excel (.xlsx, .xls)
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 bg-navy-800/50 border border-navy-600 rounded-xl p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 bg-gold-500/10 rounded-lg flex items-center justify-center mr-4">
            <svg className="w-5 h-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white mb-2">
              Säkerhet och integritet
            </h3>
            <p className="text-sm text-warm-300">
              Dina filer krypteras och hanteras säkert enligt GDPR. Vi använder endast
              informationen för att upprätta din NE-bilaga och raderar all data efter
              att tjänsten är slutförd.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-navy-600 mt-8">
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
          disabled={!selectedFile}
          className={`px-8 py-3 rounded-xl font-bold transition-all duration-200 ${
            selectedFile
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
