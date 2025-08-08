import React, { useState, useEffect, useCallback } from 'react';
import BlockSeamlessView from './BlockSeamlessView';
import { Block } from '../../pdf/PDFViewer';
import { useBlockImages } from '../../../hooks/useBlockImages';

interface BlockNavigatorProps {
  blocks: Block[];
  currentBlockId?: string;
  documentId: string;
  getRabbitholeHighlightsForBlock?: (blockId: string) => any[];
  onBlockChange?: (block: Block) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onRefreshRabbitholes?: (refreshFn: () => void) => void;
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  onSwitchToMainChat?: () => void;
  onTextSelectionForOnboarding?: () => void;
  isOnboardingStep4?: boolean;
  isOnboardingStep5?: boolean;
  isOnboardingStep6?: boolean;
  isOnboardingStep7?: boolean;
  isOnboardingStep8?: boolean;
  onCreateChatForOnboarding?: () => void;
  mainConversationId?: string;
}

export default function BlockNavigator({
  blocks,
  currentBlockId, 
  documentId,
  getRabbitholeHighlightsForBlock,
  onBlockChange,
  onRabbitholeClick,
  onCreateRabbithole,
  onRefreshRabbitholes,
  onAddTextToChat,
  onUpdateBlockMetadata,
  onSwitchToMainChat,
  onTextSelectionForOnboarding,
  isOnboardingStep4,
  isOnboardingStep5,
  isOnboardingStep6,
  isOnboardingStep7,
  isOnboardingStep8,
  onCreateChatForOnboarding,
  mainConversationId
}: BlockNavigatorProps) {
  // Track current index
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Image fetching hook
  const { fetchBlockImages } = useBlockImages(documentId);
  
  
  // Update index when currentBlockId changes from outside (e.g., when user clicks in PDF)
  useEffect(() => {
    if (currentBlockId && blocks.length > 0) {
      const index = blocks.findIndex(block => block.id === currentBlockId);
      if (index !== -1) {
        setCurrentIndex(index);
        const currentBlock = blocks[index];
      }
    }
  }, [currentBlockId, blocks]);
  
  // If blocks change and currentIndex is out of bounds, reset to 0
  useEffect(() => {
    if (blocks.length > 0 && currentIndex >= blocks.length) {
      setCurrentIndex(0);
    }
  }, [blocks, currentIndex]);
  
  // Handle navigation
  const goToNextBlock = useCallback(() => {
    if (isOnboardingStep4) return; // Disable during onboarding step 4
    if (currentIndex < blocks.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      const newBlock = blocks[newIndex];
      if (onBlockChange) {
        onBlockChange(newBlock);
      }
    }
  }, [currentIndex, blocks.length, blocks, onBlockChange, isOnboardingStep4]);
  
  const goToPrevBlock = useCallback(() => {
    if (isOnboardingStep4) return; // Disable during onboarding step 4
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      const newBlock = blocks[newIndex];
      if (onBlockChange) {
        onBlockChange(newBlock);
      }
    }
  }, [currentIndex, blocks, onBlockChange, isOnboardingStep4]);

  // Add keyboard navigation
  useEffect(() => {
    if (isOnboardingStep4) return; // Disable keyboard navigation during onboarding
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle arrow keys if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.contentEditable === 'true' ||
          target.closest('[contenteditable="true"]')) {
        return;
      }
      
      // Only handle arrow keys when the component is focused/active
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        goToPrevBlock();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        goToNextBlock();
      }
    };

    // Add event listener when component mounts
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToPrevBlock, goToNextBlock, isOnboardingStep4]); // Include the functions in dependencies
  
  // If no blocks available, show empty state
  if (blocks.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        No blocks available. Please wait for document processing to complete.
      </div>
    );
  }
  
  // Get current block
  const currentBlock = blocks[currentIndex];
  
  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Full overlay for step 5 - only allow tooltip interactions */}
      {isOnboardingStep5 && (
        <div 
          className="absolute inset-0 z-40 pointer-events-auto bg-black/10" 
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.preventDefault()}
          onClick={(e) => e.preventDefault()}
        />
      )}
      
      <div className={`h-full flex flex-col overflow-hidden transition-all duration-300 ${
        isOnboardingStep5 ? 'opacity-70' : ''
      }`}>
      {/* Minimal progress bar */}
      <div className="p-3 flex-shrink-0">
        <div className="w-full relative group">
          {/* Percentage tooltip on hover */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
            <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {Math.round(((currentIndex + 1) / blocks.length) * 100)}%
            </div>
            {/* Arrow pointing down */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-library-sage-200 rounded-full h-2 shadow-inner overflow-hidden">
            <div 
              className="bg-gradient-to-r from-library-gold-400 to-library-mahogany-400 h-2 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${((currentIndex + 1) / blocks.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Seamless continuous view */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <BlockSeamlessView
          blocks={blocks}
          currentBlockId={currentBlock.id}
          documentId={documentId}
          onBlockChange={(block) => {
            const newIndex = blocks.findIndex(b => b.id === block.id);
            if (newIndex !== -1) {
              setCurrentIndex(newIndex);
              if (onBlockChange) {
                onBlockChange(block);
              }
            }
          }}
          onAddTextToChat={onAddTextToChat}
          onRabbitholeClick={onRabbitholeClick}
          onRefreshRabbitholes={onRefreshRabbitholes}
          onUpdateBlockMetadata={onUpdateBlockMetadata}
          getRabbitholeHighlightsForBlock={getRabbitholeHighlightsForBlock}
        />
      </div>
      </div>
    </div>
  );
} 