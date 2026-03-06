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
        <span className="text-sm font-semibold text-slate-500">
          Steg {currentStep} av {totalSteps}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#173b5712', color: '#173b57' }}>
          {packageType === 'ne-bilaga' ? 'NE-BILAGA' : 'KOMPLETT'}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: '#E95C63' }}
        ></div>
      </div>
    </div>
  );
}
