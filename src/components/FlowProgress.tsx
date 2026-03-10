interface FlowProgressProps {
  currentStep: number;
  totalSteps: number;
  packageType: string;
}

export default function FlowProgress({ currentStep, totalSteps, packageType }: FlowProgressProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-warm-300">
          Steg {currentStep} av {totalSteps}
        </span>
        <span className="px-3 py-1 bg-navy-800/10 border border-navy-800/20 rounded-full text-xs font-bold text-navy-800">
          {packageType === 'ne-bilaga' ? 'NE-BILAGA' : 'KOMPLETT'}
        </span>
      </div>
      <div className="w-full bg-navy-600 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-navy-700 to-navy-500 h-3 rounded-full transition-all duration-500 ease-out shadow-lg shadow-navy-700/20"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}
