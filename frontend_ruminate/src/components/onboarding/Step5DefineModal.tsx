import React from 'react';
import { Search, ArrowDown } from 'lucide-react';
import StepCounter from './StepCounter';

interface Step5DefineModalProps {
  isVisible: boolean;
  onComplete: () => void;
}

export const Step5DefineModal: React.FC<Step5DefineModalProps> = ({
  isVisible,
  onComplete
}) => {
  if (!isVisible) return null;

  return (
    <div className="text-center p-4">
      <div className="w-12 h-12 mx-auto bg-library-gold-100 rounded-full flex items-center justify-center mb-4">
        <Search className="w-6 h-6 text-library-mahogany-600" />
      </div>
      <h3 className="text-lg font-serif font-semibold text-reading-primary mb-3">
        Click "create chat" to enter a focused conversation about the selected text.
      </h3>
    </div>
  );
};