'use client';

import { ReactNode, useEffect } from 'react';
import FlowProgress from './FlowProgress';

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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {!hideProgress && (
          <FlowProgress
            currentStep={currentStep}
            totalSteps={totalSteps}
            packageType={packageType}
          />
        )}

        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 sm:p-8 md:p-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" style={{ color: '#173b57' }}>
            {title}
          </h1>
          {description && (
            <p className="text-lg text-slate-500 mb-8">
              {description}
            </p>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
