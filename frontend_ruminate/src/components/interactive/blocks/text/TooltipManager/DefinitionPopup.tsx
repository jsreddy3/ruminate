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
          <Book size={16} className="text-library-mahogany-600" />
          <span className="text-reading-primary font-serif font-semibold">Definition</span>
        </div>
      }
      className="border-library-sage-300 shadow-deep"
      offsetY={30}
    >
      <div className="p-5 flex flex-col h-full">
        <div className="font-serif font-semibold text-reading-primary mb-2 text-xl border-b border-library-sage-200 pb-2">{term}</div>
        <div className="text-reading-secondary text-lg mt-3 flex-1 font-serif leading-relaxed">
          {isLoading ? (
            <div className="flex items-center gap-3 text-library-gold-600">
              <Loader size={18} className="animate-spin" />
              <span className="font-serif">Consulting scholarly sources...</span>
            </div>
          ) : error ? (
            <div className="text-library-mahogany-600 font-serif">{error}</div>
          ) : definition ? (
            <div className="text-reading-secondary leading-relaxed font-serif">{definition}</div>
          ) : (
            <p className="italic text-reading-muted font-serif">No definition available in current context.</p>
          )}
        </div>
        
        {/* Elegant footer with flourish */}
        <div className="pt-4 mt-4 border-t border-library-sage-200 text-base text-reading-muted relative">
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
            <div className="w-4 h-1 bg-library-gold-300 rounded-full opacity-60"></div>
          </div>
          <span className="font-sans italic">Definition derived from document context</span>
        </div>
      </div>
    </BasePopover>
  );
};

export default DefinitionPopup;
