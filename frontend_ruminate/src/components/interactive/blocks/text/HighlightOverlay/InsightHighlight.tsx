import React from 'react';
import { X } from 'lucide-react';

interface InsightHighlightProps {
  insight: string;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Component for displaying an insight when a highlight is clicked
 */
const InsightHighlight: React.FC<InsightHighlightProps> = ({ 
  insight, 
  isVisible, 
  onClose 
}) => {
  if (!isVisible || !insight) return null;
  
  return (
    <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white rounded-lg border border-neutral-200 shadow-lg z-10">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">{insight}</div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-700"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default InsightHighlight;
