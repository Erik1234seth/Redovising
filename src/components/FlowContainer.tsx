import { ReactNode } from 'react';
import FlowProgress from './FlowProgress';

interface FlowContainerProps {
  children: ReactNode;
  title: string;
  description?: string;
  currentStep: number;
  totalSteps: number;
  packageType: string;
}

export default function FlowContainer({
  children,
  title,
  description,
  currentStep,
  totalSteps,
  packageType,
}: FlowContainerProps) {
  return (
    <div className="min-h-screen bg-navy-800 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <FlowProgress
          currentStep={currentStep}
          totalSteps={totalSteps}
          packageType={packageType}
        />

        <div className="bg-navy-700/50 backdrop-blur-sm border border-navy-600 rounded-2xl shadow-2xl p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
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
