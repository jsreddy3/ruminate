import React, { useRef, useEffect, useState } from 'react';
import { X, Book, Loader, GripVertical, Maximize2 } from 'lucide-react';
import { documentApi } from '@/services/api/document';
import { Rnd } from 'react-rnd';

interface DefinitionPopupProps {
  isVisible: boolean;
  position: { x: number, y: number };
  term: string;
  textStartOffset: number;
  textEndOffset: number;
  documentId: string;
  blockId: string;
  savedDefinition?: string; // If provided, show this instead of fetching
  onClose: () => void;
  onDefinitionSaved?: (term: string, definition: string, startOffset: number, endOffset: number, fullResponse?: any) => void; // Callback when a new definition is saved
}

const DefinitionPopup: React.FC<DefinitionPopupProps> = ({
  isVisible,
  position,
  term,
  textStartOffset,
  textEndOffset,
  documentId,
  blockId,
  savedDefinition,
  onClose,
  onDefinitionSaved
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

  // Fetch definition when popup becomes visible (only if not a saved definition)
  useEffect(() => {
    if (!isVisible) return;
    
    // If we have a saved definition, use it directly
    if (savedDefinition) {
      setDefinition(savedDefinition);
      setIsLoading(false);
      setError(null);
      return;
    }
    
    // Otherwise fetch from API
    if (!term || !documentId || !blockId) return;
    
    const fetchDefinition = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await documentApi.getTermDefinition(documentId, blockId, term, textStartOffset, textEndOffset);
        setDefinition(result.definition);
        
        // Notify parent that a new definition was saved
        if (onDefinitionSaved) {
          onDefinitionSaved(term, result.definition, textStartOffset, textEndOffset, result);
        }
      } catch (err) {
        console.error('Failed to fetch definition:', err);
        setError('Failed to load definition. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDefinition();
  }, [isVisible, term, documentId, blockId, savedDefinition]); // Removed onDefinitionSaved to prevent infinite loop

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

  if (!isVisible) {
    console.log('[DefinitionPopup] Not visible, returning null');
    return null;
  }

  console.log('[DefinitionPopup] Rendering with term:', term, 'at position:', position);

  // Calculate initial position - ensure it's visible within viewport
  const getInitialPosition = () => {
    let x = position.x;
    let y = position.y + 30; // Position below the selection
    
    // Keep within bounds with default size
    const defaultWidth = 320;
    const defaultHeight = 200;
    
    if (x + defaultWidth > window.innerWidth) {
      x = window.innerWidth - defaultWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }
    
    if (y + defaultHeight > window.innerHeight) {
      y = position.y - defaultHeight - 10; // Position above the selection
    }
    
    return { x, y };
  };

  const { x, y } = getInitialPosition();

  return (
    <Rnd
      default={{
        x: x,
        y: y,
        width: 320,
        height: 'auto',
      }}
      minWidth={280}
      minHeight={150}
      maxWidth={600}
      maxHeight={500}
      bounds="window"
      dragHandleClassName="definition-popup-handle"
      className="definition-popup"
      style={{
        zIndex: 50,
      }}
      resizeHandleStyles={{
        bottom: {
          bottom: -4,
          height: 8,
          cursor: 'ns-resize',
          background: 'transparent',
        },
        right: {
          right: -4,
          width: 8,
          cursor: 'ew-resize',
          background: 'transparent',
        },
        bottomRight: {
          bottom: -4,
          right: -4,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          background: 'transparent',
        },
      }}
      resizeHandleClasses={{
        bottom: 'hover:bg-indigo-400/30 transition-colors',
        right: 'hover:bg-indigo-400/30 transition-colors',
        bottomRight: 'hover:bg-indigo-400/30 transition-colors rounded-br-lg',
      }}
    >
      <div
        ref={popupRef}
        className="bg-white rounded-lg shadow-xl border border-indigo-200 h-full flex flex-col animate-fadeIn overflow-hidden"
        style={{
          // Add a subtle inner border on hover to indicate resizability
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
      {/* Header - draggable */}
      <div className="definition-popup-handle px-4 py-2 flex items-center justify-between border-b border-slate-200 bg-indigo-50 rounded-t-lg cursor-move group">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-indigo-400 group-hover:text-indigo-600 transition-colors" />
          <Book size={16} className="text-indigo-600" />
          <h3 className="font-medium text-indigo-900 select-none">Definition</h3>
          <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2">(drag to move)</span>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Content - scrollable */}
      <div className="p-4 flex-1 overflow-y-auto">
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
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 rounded-b-lg flex items-center justify-between">
        <span>Definition based on document context</span>
        <Maximize2 size={12} className="text-slate-400 rotate-45" />
      </div>
      </div>
    </Rnd>
  );
};

export default DefinitionPopup;
