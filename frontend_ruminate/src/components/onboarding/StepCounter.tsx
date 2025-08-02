import React from 'react';

interface StepCounterProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

const StepCounter: React.FC<StepCounterProps> = ({ 
  currentStep, 
  totalSteps, 
  className = ""
}) => {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        
        return (
          <div
            key={stepNumber}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isActive
                ? 'bg-library-mahogany-600 scale-125'
                : isCompleted
                ? 'bg-library-gold-400'
                : 'bg-library-sage-300'
            }`}
          />
        );
      })}
    </div>
  );
};

export default StepCounter;