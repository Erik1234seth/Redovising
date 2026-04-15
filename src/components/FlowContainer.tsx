'use client';

import { ReactNode, useEffect } from 'react';
import FlowProgress from './FlowProgress';
import { packages } from '@/data/packages';

interface FlowContainerProps {
  children: ReactNode;
  title: string;
  description?: string;
  currentStep: number;
  totalSteps: number;
  packageType: string;
  hideProgress?: boolean;
}

export default function FlowContainer({
  children,
  title,
  description,
  currentStep,
  totalSteps,
  packageType,
  hideProgress = false,
}: FlowContainerProps) {
  // Scroll to top when entering a flow step
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const pkg = packages.find((p) => p.id === packageType);

  return (
    <div className="min-h-screen bg-navy-800 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Package context chip */}
        {pkg && (
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold bg-[#E95C63]/15 text-[#E95C63] border border-[#E95C63]/25">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Beställning: {pkg.name} — {pkg.price.toLocaleString('sv')} kr
            </span>
          </div>
        )}

        {!hideProgress && (
          <FlowProgress
            currentStep={currentStep}
            totalSteps={totalSteps}
            packageType={packageType}
          />
        )}

        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-2xl shadow-2xl p-4 sm:p-8 md:p-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            {title}
          </h1>
          {description && (
            <p className="text-lg text-warm-300 mb-8">
              {description}
            </p>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
