import React from 'react';
import { Search, ArrowDown } from 'lucide-react';

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
        Great! Now try "Create chat"
      </h3>
      <p className="text-reading-secondary text-sm mb-4">
        Click the highlighted button to start a conversation about your selected text.
      </p>
      
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <ArrowDown className="w-4 h-4 text-library-gold-600" />
          <div className="px-2 py-1 bg-library-gold-100 border border-library-gold-400 rounded flex items-center gap-1">
            <Search className="w-3 h-3 text-library-mahogany-600" />
            <span className="text-xs font-serif text-reading-primary">Create chat</span>
          </div>
        </div>
      </div>
    </div>
  );
};