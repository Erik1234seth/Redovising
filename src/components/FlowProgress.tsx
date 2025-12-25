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
        <span className="px-3 py-1 bg-gold-500/10 border border-gold-500/20 rounded-full text-xs font-bold text-gold-500">
          {packageType === 'ne-bilaga' ? 'NE-BILAGA' : 'KOMPLETT'}
        </span>
      </div>
      <div className="w-full bg-navy-600 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-gold-500 to-gold-600 h-3 rounded-full transition-all duration-500 ease-out shadow-lg shadow-gold-500/20"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}
