import React, { useRef, useEffect, useState } from 'react';
import { Book, Loader } from 'lucide-react';
import { documentApi } from '@/services/api/document';
import BasePopover from '../../../../common/BasePopover';

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
  const [definition, setDefinition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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



  return (
    <BasePopover
      isVisible={isVisible}
      position={position}
      onClose={onClose}
      draggable={true}
      resizable={true}
      initialWidth={320}
      initialHeight="auto"
      minWidth={280}
      minHeight={150}
      maxWidth={600}
      maxHeight={500}
      title={
        <div className="flex items-center gap-2">
          <Book size={16} className="text-indigo-600" />
          <span className="text-indigo-900 font-medium">Definition</span>
        </div>
      }
      className="border-indigo-200 shadow-xl"
      offsetY={30}
    >
      <div className="p-4 flex flex-col h-full">
        <div className="font-medium text-slate-900 mb-1">{term}</div>
        <div className="text-slate-700 text-sm mt-2 flex-1">
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
        
        {/* Footer */}
        <div className="pt-3 mt-3 border-t border-slate-200 text-xs text-slate-500">
          <span>Definition based on document context</span>
        </div>
      </div>
    </BasePopover>
  );
};

export default DefinitionPopup;
