'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { useTrackStep } from '@/hooks/useTrackStep';
import { packages } from '@/data/packages';
import { useAuth } from '@/contexts/AuthContext';

const CORAL = '#E95C63';
const NAV_BG = '#173b57';

export default function ReviewAndAcceptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const packageType = params.package as string;
  const bank = searchParams.get('bank') || '';
  useTrackStep('review-and-accept', packageType, bank, user?.id);
  const email = searchParams.get('email') || '';
  const name = searchParams.get('name') || '';
  const phone = searchParams.get('phone') || '';
  const company = searchParams.get('company') || '';

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [invoiceAccepted, setInvoiceAccepted] = useState(false);

  const packageInfo = packages.find((p) => p.id === packageType);

  const [totalSteps, setTotalSteps] = useState(9);
  const currentStep = totalSteps - 1;

  useEffect(() => {
    const answersStr = sessionStorage.getItem(`qualificationAnswers_${packageType}`);
    if (answersStr) {
      const answers = JSON.parse(answersStr);
      setTotalSteps(packageType !== 'komplett' && answers.isFirstYear === true ? 8 : 9);
    } else {
      setTotalSteps(9);
    }
  }, [packageType]);

  // Protect route - require authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/auth/login?redirect=/flow/${packageType}/review-and-accept?bank=${bank}`);
    }
  }, [user, loading, router, packageType, bank]);

  const handleContinue = () => {
    if (termsAccepted && invoiceAccepted) {
      const queryParams = new URLSearchParams({ bank, email, name, phone, company });
      router.push(`/flow/${packageType}/confirmation?${queryParams.toString()}`);
    }
  };

  return (
    <FlowContainer
      title="Granska och godkänn"
      description="Granska din beställning och godkänn villkoren innan vi går vidare."
      currentStep={currentStep}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      {/* Order Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 sm:p-8 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: NAV_BG }}>
          Sammanfattning av din beställning
        </h2>
        <div className="space-y-3 text-slate-600">
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="font-semibold">Paket:</span>
            <span className="font-bold" style={{ color: NAV_BG }}>{packageInfo?.name}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="font-semibold">Pris:</span>
            <span className="font-bold text-xl" style={{ color: NAV_BG }}>{packageInfo?.price} kr</span>
          </div>
          {name && (
            <div className="flex justify-between items-center">
              <span>Kontakt:</span>
              <span className="text-slate-800 font-medium">{name}</span>
            </div>
          )}
          {email && (
            <div className="flex justify-between items-center">
              <span>E-post:</span>
              <span className="text-slate-800 font-medium">{email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 sm:p-8 mb-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: NAV_BG }}>Godkännande</h3>

        <div className="space-y-4">
          {[
            {
              checked: termsAccepted,
              onChange: setTermsAccepted,
              label: 'Jag bekräftar att all information jag har lämnat är korrekt',
              sublabel: 'Kontoutdrag, kontaktuppgifter och eventuella extra transaktioner är korrekta.',
            },
            {
              checked: invoiceAccepted,
              onChange: setInvoiceAccepted,
              label: 'Jag godkänner att faktura skickas när arbetet är klart',
              sublabel: `Du kommer få en faktura på ${packageInfo?.price} kr via e-post när din ${packageInfo?.name.toLowerCase()} är färdig och levererad.`,
            },
          ].map(({ checked, onChange, label, sublabel }, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onChange(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded flex-shrink-0"
                  style={{ accentColor: NAV_BG }}
                />
                <div>
                  <span className="text-slate-700 group-hover:text-slate-900 font-medium block">{label}</span>
                  <span className="text-sm text-slate-400 mt-1 block">{sublabel}</span>
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Important Information */}
      <div className="rounded-r-xl p-6 mb-6 border-l-4" style={{ backgroundColor: `${NAV_BG}08`, borderLeftColor: NAV_BG }}>
        <h3 className="font-bold mb-3 flex items-center" style={{ color: NAV_BG }}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Viktigt att veta
        </h3>
        <ul className="space-y-2 text-sm text-slate-700">
          {[
            'Betalning sker efter att arbetet är klart och levererat',
            'Du får en faktura via e-post med betalningsinstruktioner',
            'Vi börjar arbeta med din beställning direkt efter godkännande',
            'Kontakta oss vid frågor på erik@enklabokslut.se',
          ].map((point) => (
            <li key={point} className="flex items-start">
              <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" style={{ color: CORAL }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Navigation */}
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
          disabled={!termsAccepted || !invoiceAccepted}
          className="px-8 py-3 rounded-xl font-bold transition-all duration-200 w-full sm:w-auto text-white"
          style={termsAccepted && invoiceAccepted
            ? { backgroundColor: NAV_BG }
            : { backgroundColor: '#d1d5db', color: '#9ca3af', cursor: 'not-allowed' }}
        >
          Godkänn och slutför beställning →
        </button>
      </div>
    </FlowContainer>
  );
}
