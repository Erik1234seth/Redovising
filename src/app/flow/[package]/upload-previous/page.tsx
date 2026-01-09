'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import VideoPlayer from '@/components/VideoPlayer';
import { banks } from '@/data/banks';
import { Bank } from '@/types';
import { uploadFile } from '@/lib/uploadFile';
import { useAuth } from '@/contexts/AuthContext';

export default function UploadPreviousPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const packageType = params.package as string;
  const bankId = searchParams.get('bank') as Bank;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasNoPrevious, setHasNoPrevious] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');

  const bank = banks.find((b) => b.id === bankId);
  const totalSteps = 6;

  // Get order ID from sessionStorage
  useEffect(() => {
    const id = sessionStorage.getItem('tempOrderId');
    if (id) {
      setOrderId(id);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    setUploadError('');
    setUploading(true);
    setHasNoPrevious(false);

    try {
      const result = await uploadFile(
        file,
        orderId,
        'previous',
        user?.id || null,
        null, // Guest email (not available yet on this page)
        null  // Guest name (not available yet on this page)
      );

      if (result.error) {
        setUploadError(result.error);
        setSelectedFile(null);
      } else {
        // Store file info in sessionStorage
        sessionStorage.setItem('previousFileUrl', result.url);
        sessionStorage.setItem('previousFilePath', result.path);
        if (result.fileId) {
          sessionStorage.setItem('previousFileId', result.fileId);
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
    if (file && orderId) {
      handleFileUpload(file);
    }
  };

  const handleContinue = () => {
    if (hasNoPrevious) {
      // Clear any previously uploaded file
      sessionStorage.removeItem('previousFileUrl');
      sessionStorage.removeItem('previousFilePath');
    }
    router.push(`/flow/${packageType}/contact-info?bank=${bankId}`);
  };

  return (
    <FlowContainer
      title="Ladda upp tidigare NE-bilaga (om tillämpligt)"
      description="Om du har fått en NE-bilaga tidigare år, ladda upp den här så vi kan använda samma struktur."
      currentStep={5}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      <div className="mb-8">
        <VideoPlayer
          videoUrl={bank?.downloadVideoUrl || ''}
          title={`Så här hittar du din tidigare NE-bilaga i ${bank?.name}`}
        />
      </div>

      <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
        uploading
          ? 'border-gold-500 bg-gold-500/10 scale-[1.02]'
          : selectedFile
          ? 'border-gold-500/50 bg-gold-500/5'
          : 'border-navy-600 bg-navy-800/30 hover:border-gold-500/30 hover:bg-navy-800/50'
      }`}>
        {uploading ? (
          <div>
            <div className="w-16 h-16 bg-gold-500/20 border-2 border-gold-500 rounded-xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <svg
                className="w-8 h-8 text-gold-500 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Laddar upp fil...
            </h3>
            <p className="text-warm-300">Vänta medan filen laddas upp</p>
          </div>
        ) : selectedFile ? (
          <div>
            <div className="w-16 h-16 bg-gold-500/20 border-2 border-gold-500 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gold-500"
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
            <h3 className="text-lg font-bold text-white mb-2">
              Fil uppladdad!
            </h3>
            <p className="text-warm-300 mb-4">{selectedFile.name}</p>
            <button
              onClick={() => {
                setSelectedFile(null);
                sessionStorage.removeItem('previousFileUrl');
                sessionStorage.removeItem('previousFilePath');
              }}
              className="text-gold-500 hover:text-gold-400 font-semibold"
            >
              Välj en annan fil
            </button>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-navy-700 border-2 border-navy-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-warm-400"
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
            <h3 className="text-lg font-bold text-white mb-2">
              Ladda upp tidigare NE-bilaga
            </h3>
            <p className="text-warm-400 mb-4">CSV, Excel eller PDF</p>
            <label className="inline-block px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 rounded-xl font-bold cursor-pointer transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105">
              Välj fil från dator
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.csv,.xlsx,.xls"
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mt-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-red-400 mb-1">Uppladdning misslyckades</h4>
              <p className="text-sm text-red-300">{uploadError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-8 mt-8">
        <p className="text-warm-300 mb-3">Har du ingen tidigare NE-bilaga?</p>
        <label className="flex items-center justify-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasNoPrevious}
            onChange={(e) => {
              setHasNoPrevious(e.target.checked);
              if (e.target.checked) {
                setSelectedFile(null);
                sessionStorage.removeItem('previousFileUrl');
                sessionStorage.removeItem('previousFilePath');
              }
            }}
            className="w-5 h-5 text-gold-500 bg-navy-800 border-navy-600 rounded focus:ring-gold-500"
          />
          <span className="text-warm-300">
            Jag har ingen tidigare NE-bilaga (första året som enskild firma)
          </span>
        </label>
      </div>

      <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-xl p-6 mb-8">
        <h3 className="font-semibold text-gold-500 mb-2">
          Varför behöver vi detta?
        </h3>
        <p className="text-sm text-warm-300">
          Genom att få tillgång till din tidigare NE-bilaga kan vi säkerställa att
          vi följer samma struktur och kategorisering som du använt tidigare. Detta
          gör processen smidigare och mer konsekvent år efter år.
        </p>
      </div>

      <div className="flex justify-between items-center">
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
          disabled={(!selectedFile && !hasNoPrevious) || uploading}
          className={`px-8 py-3 rounded-xl font-bold transition-all duration-200 ${
            (selectedFile || hasNoPrevious) && !uploading
              ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105'
              : 'bg-navy-600 text-navy-400 cursor-not-allowed'
          }`}
        >
          {uploading ? 'Laddar upp...' : 'Fortsätt →'}
        </button>
      </div>
    </FlowContainer>
  );
}
