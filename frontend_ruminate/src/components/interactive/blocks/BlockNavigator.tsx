import React, { useState, useEffect, useCallback } from 'react';
import BlockContainer from './BlockContainer';
import BlockNavigatorPill from './BlockNavigatorPill';
import GeneratedNoteBadges from './GeneratedNoteBadges';
import BlockContextStack from './BlockContextStack';
import ImageGallery from './ImageGallery';
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
  onAddTextToChat?: (text: string) => void;
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
  
  // View mode state - toggles between traditional view and contextual stack
  const [viewMode, setViewMode] = useState<'traditional' | 'stack' | 'seamless'>('traditional');
  
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
      {/* Enhanced header with progress bar */}
      <div className="border-b border-library-sage-200 bg-gradient-to-r from-surface-parchment to-library-cream-50 p-6 flex-shrink-0 relative">
        {/* Overlay just for header buttons during onboarding */}
        {(isOnboardingStep4 || isOnboardingStep5) && (
          <div className="absolute inset-0 z-30 pointer-events-auto bg-black/5" />
        )}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-library-gold-400 shadow-sm"></div>
            <div>
              <h2 className="text-2xl font-serif text-reading-primary font-semibold">
                Block {currentIndex + 1} of {blocks.length}
              </h2>
              <p className="text-base font-serif text-reading-muted mt-1">
                Reading Progress • {Math.round(((currentIndex + 1) / blocks.length) * 100)}% Complete
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-base font-serif text-reading-muted">View Mode:</span>
            <div className="bg-surface-paper rounded-book p-1.5 shadow-paper border border-library-sage-200">
              <button
                onClick={(isOnboardingStep4 || isOnboardingStep5) ? undefined : () => {
                  setViewMode('traditional');
                }}
                className={`px-4 py-2 text-base font-serif rounded-paper transition-all ${
                  (isOnboardingStep4 || isOnboardingStep5)
                    ? 'text-library-sage-400 cursor-not-allowed bg-library-sage-50 opacity-30'
                    : viewMode === 'traditional'
                      ? 'bg-library-gold-100 text-reading-accent shadow-sm'
                      : 'text-reading-muted hover:text-reading-secondary'
                }`}
                title={(isOnboardingStep4 || isOnboardingStep5) ? "Complete tutorial to continue" : "Traditional linear view"}
                disabled={(isOnboardingStep4 || isOnboardingStep5)}
              >
                📄 Single
              </button>
              <button
                onClick={(isOnboardingStep4 || isOnboardingStep5) ? undefined : () => {
                  setViewMode('stack');
                }}
                className={`px-4 py-2 text-base font-serif rounded-paper transition-all ${
                  (isOnboardingStep4 || isOnboardingStep5)
                    ? 'text-library-sage-400 cursor-not-allowed bg-library-sage-50 opacity-30'
                    : viewMode === 'stack'
                      ? 'bg-library-gold-100 text-reading-accent shadow-sm'
                      : 'text-reading-muted hover:text-reading-secondary'
                }`}
                title={(isOnboardingStep4 || isOnboardingStep5) ? "Complete tutorial to continue" : "Contextual stack view"}
                disabled={(isOnboardingStep4 || isOnboardingStep5)}
              >
                📚 Stack
              </button>
              <button
                onClick={(isOnboardingStep4 || isOnboardingStep5) ? undefined : () => {
                  setViewMode('seamless');
                }}
                className={`px-4 py-2 text-base font-serif rounded-paper transition-all ${
                  (isOnboardingStep4 || isOnboardingStep5)
                    ? 'text-library-sage-400 cursor-not-allowed bg-library-sage-50 opacity-30'
                    : viewMode === 'seamless'
                      ? 'bg-library-gold-100 text-reading-accent shadow-sm'
                      : 'text-reading-muted hover:text-reading-secondary'
                }`}
                title={(isOnboardingStep4 || isOnboardingStep5) ? "Complete tutorial to continue" : "Seamless continuous view"}
                disabled={(isOnboardingStep4 || isOnboardingStep5)}
              >
                🧵 Seamless
              </button>
            </div>
          </div>
        </div>
        
        {/* Visual Progress Bar */}
        <div className="w-full bg-library-sage-200 rounded-full h-3 shadow-inner mt-4">
          <div 
            className="bg-gradient-to-r from-library-gold-400 to-library-mahogany-400 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
            style={{ width: `${((currentIndex + 1) / blocks.length) * 100}%` }}
          />
        </div>
        
        {/* Progress milestones */}
        <div className="flex justify-between mt-2 text-lg font-serif text-reading-muted">
          <span>Start</span>
          <span>{Math.round(((currentIndex + 1) / blocks.length) * 100)}%</span>
          <span>Complete</span>
        </div>
      </div>

      {/* Content area - switches between views */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* Image Gallery - visible in both modes */}
        <ImageGallery 
          blocks={blocks}
          currentBlockId={currentBlock.id}
          documentId={documentId}
          onImageFetch={fetchBlockImages}
        />
        {viewMode === 'traditional' ? (
          // Traditional linear view
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <div className="border border-gray-100 rounded-md p-2 bg-white">
                <BlockContainer
                  key={currentBlock.id}
                  blockId={currentBlock.id}
                  blockType={currentBlock.block_type}
                  htmlContent={currentBlock.html_content || ''}
                  documentId={documentId}
                  images={currentBlock.images}
                  metadata={currentBlock.metadata}
                  rabbitholeHighlights={getRabbitholeHighlightsForBlock ? getRabbitholeHighlightsForBlock(currentBlock.id) : []}
                  customStyle={{ backgroundColor: 'white', fontSize: '1.4rem' }}
                  onRefreshRabbitholes={onRefreshRabbitholes}
                  onAddTextToChat={onAddTextToChat}
                  onRabbitholeClick={onRabbitholeClick}
                  onCreateRabbithole={onCreateRabbithole}
                  onUpdateBlockMetadata={onUpdateBlockMetadata}
                  onTextSelectionForOnboarding={onTextSelectionForOnboarding}
                  isOnboardingStep5={isOnboardingStep5}
                  isOnboardingStep6={isOnboardingStep6}
                  onCreateChatForOnboarding={onCreateChatForOnboarding}
                />
              </div>
            </div>
            
            {/* Traditional navigation controls */}
            <div className="relative h-20 border-t border-library-sage-200 bg-gradient-to-r from-surface-parchment to-library-cream-50 flex-shrink-0">
              {/* Overlay for navigation controls during onboarding */}
              {(isOnboardingStep4 || isOnboardingStep5) && (
                <div className="absolute inset-0 z-30 pointer-events-auto bg-black/5" />
              )}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                <BlockNavigatorPill
                  currentIndex={currentIndex}
                  totalBlocks={blocks.length}
                  onPrevious={(isOnboardingStep4 || isOnboardingStep5) ? undefined : goToPrevBlock}
                  onNext={(isOnboardingStep4 || isOnboardingStep5) ? undefined : goToNextBlock}
                  disabled={(isOnboardingStep4 || isOnboardingStep5)}
                />
                
                {/* Generated note badges next to the progress bar */}
                <GeneratedNoteBadges
                  annotations={currentBlock.metadata?.annotations}
                  onViewConversation={(conversationId) => {
                    // Check if this is the main conversation or a rabbithole
                    if (conversationId === mainConversationId && onSwitchToMainChat) {
                      // Switch to main chat tab
                      onSwitchToMainChat();
                    } else if (onRabbitholeClick) {
                      // Open as rabbithole conversation
                      onRabbitholeClick(conversationId, '', 0, 0);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ) : viewMode === 'stack' ? (
          // Contextual stack view
          <div className="flex flex-col h-full overflow-hidden">
            <BlockContextStack
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
              onCreateRabbithole={onCreateRabbithole}
              onRefreshRabbitholes={onRefreshRabbitholes}
              onUpdateBlockMetadata={onUpdateBlockMetadata}
              getRabbitholeHighlightsForBlock={getRabbitholeHighlightsForBlock}
            />
          </div>
        ) : (
          // Seamless continuous view
          <div className="flex flex-col h-full overflow-hidden">
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
              onCreateRabbithole={onCreateRabbithole}
              onRefreshRabbitholes={onRefreshRabbitholes}
              onUpdateBlockMetadata={onUpdateBlockMetadata}
              getRabbitholeHighlightsForBlock={getRabbitholeHighlightsForBlock}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  );
} 