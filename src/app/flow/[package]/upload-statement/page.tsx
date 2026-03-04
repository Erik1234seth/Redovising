'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { Bank } from '@/types';
import { uploadFile, generateOrderId } from '@/lib/uploadFile';
import { useAuth } from '@/contexts/AuthContext';

const NAV_BG = '#173b57';

export default function UploadStatementPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;
  useTrackStep('upload-statement', packageType, bankId, user?.id);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
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
      router.push(`/auth/login?redirect=/flow/${packageType}/upload-statement?bank=${bankId}`);
    }
  }, [user, loading, router, packageType, bankId]);

  // Generate or retrieve order ID
  useEffect(() => {
    let id = sessionStorage.getItem('tempOrderId');
    if (!id) {
      id = generateOrderId();
      sessionStorage.setItem('tempOrderId', id);
    }
    setOrderId(id);
  }, []);

  const handleFileUpload = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (bankId === 'nordea' && !isCSV) {
      setUploadError('Nordea kräver CSV-format. Ladda ner kontoutdraget som CSV från Nordeas internetbank.');
      return;
    }

    if (bankId !== 'nordea' && !isExcel) {
      setUploadError('Vänligen ladda upp en Excel-fil (.xlsx eller .xls).');
      return;
    }

    setSelectedFile(file);
    setUploadError('');
    setUploading(true);

    try {
      const result = await uploadFile(file, orderId, 'statement', user?.id || null, null, null);

      if (result.error) {
        setUploadError(result.error);
        setSelectedFile(null);
      } else {
        sessionStorage.setItem('statementFileUrl', result.url);
        sessionStorage.setItem('statementFilePath', result.path);
        if (result.fileId) {
          sessionStorage.setItem('statementFileId', result.fileId);
        }
      }
    } catch (error) {
      setUploadError('Ett oväntat fel uppstod vid uppladdning.');
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && orderId) handleFileUpload(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && orderId) handleFileUpload(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleContinue = () => {
    if (selectedFile && !uploading) {
      router.push(`/flow/${packageType}/review-transactions?bank=${bankId}`);
    }
  };

  const uploadZoneClass = isDragging
    ? 'border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-all duration-200 scale-[1.02]'
    : 'border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-all duration-200';

  const uploadZoneStyle = isDragging
    ? { borderColor: NAV_BG, backgroundColor: `${NAV_BG}08` }
    : selectedFile
    ? { borderColor: `${NAV_BG}50`, backgroundColor: `${NAV_BG}05` }
    : { borderColor: '#e5e7eb', backgroundColor: '#ffffff' };

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
        className={uploadZoneClass}
        style={uploadZoneStyle}
      >
        {uploading ? (
          <div>
            <div className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-6 animate-pulse border-2"
              style={{ backgroundColor: `${NAV_BG}15`, borderColor: NAV_BG }}>
              <svg className="w-10 h-10 animate-spin" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: NAV_BG }}>Laddar upp fil...</h3>
            <p className="text-slate-500">Vänta medan filen laddas upp</p>
          </div>
        ) : selectedFile ? (
          <div>
            <div className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-6 border-2"
              style={{ backgroundColor: `${NAV_BG}15`, borderColor: NAV_BG }}>
              <svg className="w-10 h-10" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: NAV_BG }}>Fil uppladdad!</h3>
            <p className="text-slate-600 mb-4 font-medium">{selectedFile.name}</p>
            <p className="text-sm text-slate-400 mb-4">{(selectedFile.size / 1024).toFixed(2)} KB</p>
            <button
              onClick={() => {
                setSelectedFile(null);
                sessionStorage.removeItem('statementFileUrl');
                sessionStorage.removeItem('statementFilePath');
              }}
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: NAV_BG }}
            >
              Välj en annan fil
            </button>
          </div>
        ) : (
          <div>
            <div className="w-20 h-20 bg-gray-100 border-2 border-gray-200 rounded-xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: NAV_BG }}>Dra och släpp din fil här</h3>
            <p className="text-slate-400 mb-6">eller</p>
            <label className="inline-block px-8 py-3 text-white rounded-xl font-bold cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: NAV_BG }}>
              Välj fil från dator
              <input
                type="file"
                onChange={handleFileSelect}
                accept={bankId === 'nordea' ? '.csv' : '.xlsx,.xls'}
                className="hidden"
              />
            </label>
            <p className="text-sm text-slate-400 mt-6">
              {bankId === 'nordea' ? 'Godkänt filformat: CSV (.csv)' : 'Godkända filformat: Excel (.xlsx, .xls)'}
            </p>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-red-500 mb-1">Uppladdning misslyckades</h4>
              <p className="text-sm text-red-400">{uploadError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mr-4" style={{ backgroundColor: `${NAV_BG}10` }}>
            <svg className="w-5 h-5" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold mb-2" style={{ color: NAV_BG }}>Säkerhet och integritet</h3>
            <p className="text-sm text-slate-600">
              Dina filer krypteras och hanteras säkert enligt GDPR. Vi använder endast
              informationen för att upprätta din NE-bilaga och raderar all data efter
              att tjänsten är slutförd.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-8">
        <button
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-800 font-semibold transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <div className="flex items-center gap-4">
          {!selectedFile && !uploading && (
            <button
              onClick={() => router.push(`/flow/${packageType}/add-transactions?bank=${bankId}`)}
              className="text-slate-400 hover:text-slate-700 font-semibold transition-colors"
            >
              Hoppa över
            </button>
          )}
          <button
            onClick={handleContinue}
            disabled={!selectedFile || uploading}
            className="px-8 py-3 rounded-xl font-bold transition-all duration-200 text-white"
            style={selectedFile && !uploading
              ? { backgroundColor: NAV_BG }
              : { backgroundColor: '#d1d5db', color: '#9ca3af', cursor: 'not-allowed' }}
          >
            {uploading ? 'Laddar upp...' : 'Fortsätt →'}
          </button>
        </div>
      </div>
    </FlowContainer>
  );
}
