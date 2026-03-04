'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { Bank } from '@/types';
import { uploadFile } from '@/lib/uploadFile';
import { useAuth } from '@/contexts/AuthContext';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function UploadPreviousPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;
  useTrackStep('upload-previous', packageType, bankId, user?.id);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');

  const totalSteps = 9;

  // Protect route - require authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/upload-previous?bank=${bankId}`);
    }
  }, [user, loading, router, packageType, bankId]);

  useEffect(() => {
    const id = sessionStorage.getItem('tempOrderId');
    if (id) setOrderId(id);
  }, []);

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    setUploadError('');
    setUploading(true);

    try {
      const result = await uploadFile(file, orderId, 'previous', user?.id || null, null, null);
      if (result.error) {
        setUploadError(result.error);
        setSelectedFile(null);
      } else {
        sessionStorage.setItem('previousFileUrl', result.url);
        sessionStorage.setItem('previousFilePath', result.path);
        if (result.fileId) sessionStorage.setItem('previousFileId', result.fileId);
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

  const handleContinue = () => {
    if (packageType === 'komplett') {
      router.push(`/flow/${packageType}/delegation-guide?bank=${bankId}`);
    } else {
      router.push(`/flow/${packageType}/contact-info?bank=${bankId}`);
    }
  };

  const uploadZoneStyle = uploading
    ? { borderColor: NAV_BG, backgroundColor: `${NAV_BG}08`, transform: 'scale(1.02)' }
    : selectedFile
    ? { borderColor: `${NAV_BG}50`, backgroundColor: `${NAV_BG}05` }
    : { borderColor: '#e5e7eb', backgroundColor: '#ffffff' };

  return (
    <FlowContainer
      title="Ladda upp tidigare NE-bilaga"
      description="Ladda upp din senaste NE-bilaga för att vi ska kunna följa samma struktur som tidigare år."
      currentStep={6}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${NAV_BG}15` }}>
            <svg className="w-5 h-5" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold mb-2" style={{ color: NAV_BG }}>Var hittar jag min NE-bilaga?</h3>
            <p className="text-sm text-slate-600">
              Du hittar din tidigare NE-bilaga på{' '}
              <a href="https://www.skatteverket.se" target="_blank" rel="noopener noreferrer"
                className="font-medium underline hover:opacity-80" style={{ color: CORAL }}>
                skatteverket.se
              </a>
              . Logga in med BankID och gå till dina tidigare inlämnade deklarationer.
            </p>
          </div>
        </div>
      </div>

      <div className="border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-all duration-200" style={uploadZoneStyle}>
        {uploading ? (
          <div>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 animate-pulse border-2"
              style={{ backgroundColor: `${NAV_BG}15`, borderColor: NAV_BG }}>
              <svg className="w-8 h-8 animate-spin" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: NAV_BG }}>Laddar upp fil...</h3>
            <p className="text-slate-500">Vänta medan filen laddas upp</p>
          </div>
        ) : selectedFile ? (
          <div>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 border-2"
              style={{ backgroundColor: `${NAV_BG}15`, borderColor: NAV_BG }}>
              <svg className="w-8 h-8" style={{ color: NAV_BG }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: NAV_BG }}>Fil uppladdad!</h3>
            <p className="text-slate-600 mb-4">{selectedFile.name}</p>
            <button
              onClick={() => { setSelectedFile(null); sessionStorage.removeItem('previousFileUrl'); sessionStorage.removeItem('previousFilePath'); }}
              className="font-semibold hover:opacity-80 transition-opacity" style={{ color: NAV_BG }}
            >
              Välj en annan fil
            </button>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-gray-100 border-2 border-gray-200 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: NAV_BG }}>Ladda upp tidigare NE-bilaga</h3>
            <p className="text-slate-400 mb-4">Ladda upp din fil</p>
            <label className="inline-block px-6 py-3 text-white rounded-xl font-bold cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: NAV_BG }}>
              Välj fil från dator
              <input type="file" onChange={handleFileSelect} accept=".pdf,.xlsx,.xls" className="hidden" />
            </label>
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

      <div className="rounded-r-xl p-6 mb-8 mt-8 border-l-4" style={{ backgroundColor: `${NAV_BG}08`, borderLeftColor: NAV_BG }}>
        <h3 className="font-semibold mb-2" style={{ color: NAV_BG }}>Varför behöver vi detta?</h3>
        <p className="text-sm text-slate-600">
          Genom att få tillgång till din tidigare NE-bilaga kan vi säkerställa att
          vi följer samma struktur och kategorisering som du använt tidigare. Detta
          gör processen smidigare och mer konsekvent år efter år.
        </p>
      </div>

      <div className="flex justify-between items-center">
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
            <button onClick={handleContinue} className="text-slate-400 hover:text-slate-700 font-semibold transition-colors">
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
