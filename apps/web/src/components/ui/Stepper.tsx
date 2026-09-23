import React from 'react';

interface StepperProps {
  currentStep: number;
  totalSteps: number;
  stepTitles?: string[];
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  totalSteps,
  stepTitles,
  className = '',
}) => {
  const percentage = Math.min(Math.max((currentStep / totalSteps) * 100, 0), 100);

  return (
    <div className={`w-full space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-title">
          {stepTitles && stepTitles[currentStep - 1]
            ? stepTitles[currentStep - 1]
            : `Bước ${currentStep}`}
        </span>
        <span className="font-mono text-text-secondary font-medium">
          {currentStep}/{totalSteps}
        </span>
      </div>

      <div className="w-full h-1.5 bg-border-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {stepTitles && (
        <div className="hidden sm:grid grid-cols-4 gap-2 pt-1">
          {stepTitles.map((title, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div
                key={title}
                className={`text-[11px] font-medium transition-colors ${
                  isCurrent
                    ? 'text-primary font-semibold'
                    : isCompleted
                    ? 'text-body'
                    : 'text-text-muted'
                }`}
              >
                {stepNum}. {title}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
