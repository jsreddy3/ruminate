import React, { useRef, useEffect, useState } from 'react';
import { X, Book, Loader } from 'lucide-react';
import { documentApi } from '@/services/api/document';

interface DefinitionPopupProps {
  isVisible: boolean;
  position: { x: number, y: number };
  term: string;
  documentId: string;
  blockId: string;
  onClose: () => void;
}

const DefinitionPopup: React.FC<DefinitionPopupProps> = ({
  isVisible,
  position,
  term,
  documentId,
  blockId,
  onClose
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [definition, setDefinition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Fetch definition when popup becomes visible
  useEffect(() => {
    if (!isVisible || !term || !documentId || !blockId) return;
    
    const fetchDefinition = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await documentApi.getTermDefinition(documentId, blockId, term);
        setDefinition(result.definition);
      } catch (err) {
        console.error('Failed to fetch definition:', err);
        setError('Failed to load definition. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDefinition();
  }, [isVisible, term, documentId, blockId]);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // Position logic - ensure it's visible within viewport
  const adjustPosition = () => {
    // Basic position - start at the selection point
    let x = position.x;
    let y = position.y + 30; // Position below the selection
    
    // Approximate dimensions
    const width = 320;
    const height = 180;
    
    // Keep within horizontal bounds
    if (x + width > window.innerWidth) {
      x = window.innerWidth - width - 20;
    }
    if (x < 20) {
      x = 20;
    }
    
    // Keep within vertical bounds - if not enough space below, show above
    if (y + height > window.innerHeight) {
      y = position.y - height - 10; // Position above the selection
    }
    
    return { x, y };
  };

  const { x, y } = adjustPosition();

  return (
    <div
      ref={popupRef}
      className="fixed bg-white rounded-lg shadow-xl border border-indigo-200 z-50 animate-fadeIn"
      style={{
        width: '320px',
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-200 bg-indigo-50">
        <div className="flex items-center gap-2">
          <Book size={16} className="text-indigo-600" />
          <h3 className="font-medium text-indigo-900">Definition</h3>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="font-medium text-slate-900 mb-1">{term}</div>
        <div className="text-slate-700 text-sm mt-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader size={16} className="animate-spin" />
              <span>Loading definition...</span>
            </div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : definition ? (
            <div className="text-slate-700 leading-relaxed">{definition}</div>
          ) : (
            <p className="italic text-slate-500">No definition available.</p>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 rounded-b-lg">
        Definition based on document context
      </div>
    </div>
  );
};

export default DefinitionPopup;
