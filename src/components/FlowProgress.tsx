interface FlowProgressProps {
  currentStep: number;
  totalSteps: number;
  packageType: string;
}

export default function FlowProgress({ currentStep, totalSteps, packageType }: FlowProgressProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-8">
      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: '#E95C63' }}
        />
      </div>
    </div>
  );
}
