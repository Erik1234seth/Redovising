'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import FlowContainer from '@/components/FlowContainer';
import { packages } from '@/data/packages';

export default function ReviewAndAcceptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const packageType = params.package as string;
  const bank = searchParams.get('bank') || '';
  const email = searchParams.get('email') || '';
  const name = searchParams.get('name') || '';
  const phone = searchParams.get('phone') || '';
  const company = searchParams.get('company') || '';

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [invoiceAccepted, setInvoiceAccepted] = useState(false);

  const packageInfo = packages.find((p) => p.id === packageType);
  const totalSteps = 8;

  const handleContinue = () => {
    if (termsAccepted && invoiceAccepted) {
      const queryParams = new URLSearchParams({
        bank,
        email,
        name,
        phone,
        company,
      });
      router.push(`/flow/${packageType}/confirmation?${queryParams.toString()}`);
    }
  };

  return (
    <FlowContainer
      title="Granska och godkänn"
      description="Granska din beställning och godkänn villkoren innan vi går vidare."
      currentStep={8}
      totalSteps={totalSteps}
      packageType={packageType}
    >
      {/* Order Summary */}
      <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 sm:p-8 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
          Sammanfattning av din beställning
        </h2>
        <div className="space-y-3 text-warm-300">
          <div className="flex justify-between items-center pb-3 border-b border-navy-600">
            <span className="font-semibold">Paket:</span>
            <span className="text-gold-500 font-bold">{packageInfo?.name}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-navy-600">
            <span className="font-semibold">Pris:</span>
            <span className="text-gold-500 font-bold text-xl">{packageInfo?.price} kr</span>
          </div>
          {name && (
            <div className="flex justify-between items-center">
              <span>Kontakt:</span>
              <span className="text-white">{name}</span>
            </div>
          )}
          {email && (
            <div className="flex justify-between items-center">
              <span>E-post:</span>
              <span className="text-white">{email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-xl p-6 sm:p-8 mb-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Godkännande
        </h3>

        <div className="space-y-4">
          {/* Terms checkbox */}
          <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 text-gold-500 bg-navy-700 border-navy-600 rounded focus:ring-gold-500 focus:ring-offset-navy-800 flex-shrink-0"
              />
              <div>
                <span className="text-warm-200 group-hover:text-white font-medium block">
                  Jag bekräftar att all information jag har lämnat är korrekt
                </span>
                <span className="text-sm text-warm-400 mt-1 block">
                  Kontoutdrag, kontaktuppgifter och eventuella manuella transaktioner är korrekta.
                </span>
              </div>
            </label>
          </div>

          {/* Invoice checkbox */}
          <div className="bg-navy-800/50 border border-navy-600 rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={invoiceAccepted}
                onChange={(e) => setInvoiceAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 text-gold-500 bg-navy-700 border-navy-600 rounded focus:ring-gold-500 focus:ring-offset-navy-800 flex-shrink-0"
              />
              <div>
                <span className="text-warm-200 group-hover:text-white font-medium block">
                  Jag godkänner att faktura skickas när arbetet är klart
                </span>
                <span className="text-sm text-warm-400 mt-1 block">
                  Du kommer få en faktura på <strong className="text-gold-500">{packageInfo?.price} kr</strong> via e-post när din {packageInfo?.name.toLowerCase()} är färdig och levererad.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Important Information */}
      <div className="bg-gold-500/10 border-l-4 border-gold-500 rounded-r-xl p-6 mb-6">
        <h3 className="font-bold text-gold-500 mb-3 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Viktigt att veta
        </h3>
        <ul className="space-y-2 text-sm text-warm-200">
          <li className="flex items-start">
            <svg className="w-4 h-4 text-gold-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Betalning sker efter att arbetet är klart och levererat</span>
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-gold-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Du får en faktura via e-post med betalningsinstruktioner</span>
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-gold-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Vi börjar arbeta med din beställning direkt efter godkännande</span>
          </li>
          <li className="flex items-start">
            <svg className="w-4 h-4 text-gold-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Kontakta oss vid frågor på info@enklabokslut.se</span>
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-6 border-t border-navy-600">
        <button
          onClick={() => router.back()}
          className="text-warm-300 hover:text-white font-semibold transition-colors flex items-center justify-center sm:justify-start py-3 sm:py-0"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tillbaka
        </button>
        <button
          onClick={handleContinue}
          disabled={!termsAccepted || !invoiceAccepted}
          className={`px-8 py-3 rounded-xl font-bold transition-all duration-200 w-full sm:w-auto ${
            termsAccepted && invoiceAccepted
              ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-900 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105'
              : 'bg-navy-600 text-navy-400 cursor-not-allowed'
          }`}
        >
          Godkänn och slutför beställning →
        </button>
      </div>
    </FlowContainer>
  );
}
