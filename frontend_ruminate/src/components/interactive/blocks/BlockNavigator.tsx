import React, { useState, useEffect } from 'react';
import BlockContainer from './BlockContainer';
import BlockNavigatorPill from './BlockNavigatorPill';
import GeneratedNoteBadges from './GeneratedNoteBadges';
import BlockContextStack from './BlockContextStack';
import { Block } from '../../pdf/PDFViewer';

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
  mainConversationId
}: BlockNavigatorProps) {
  // Track current index
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // View mode state - toggles between traditional view and contextual stack
  const [viewMode, setViewMode] = useState<'traditional' | 'stack'>('traditional');
  
  // Update index when currentBlockId changes from outside (e.g., when user clicks in PDF)
  useEffect(() => {
    if (currentBlockId && blocks.length > 0) {
      const index = blocks.findIndex(block => block.id === currentBlockId);
      if (index !== -1) {
        setCurrentIndex(index);
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
  const goToNextBlock = () => {
    if (currentIndex < blocks.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      if (onBlockChange) {
        onBlockChange(blocks[newIndex]);
      }
    }
  };
  
  const goToPrevBlock = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      if (onBlockChange) {
        onBlockChange(blocks[newIndex]);
      }
    }
  };

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [currentIndex, blocks.length]); // Re-bind when currentIndex or blocks change
  
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
    <div className="h-full flex flex-col">
      {/* View mode toggle */}
      <div className="flex items-center justify-between p-4 border-b border-library-sage-200 bg-gradient-to-r from-surface-parchment to-library-cream-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-library-gold-400"></div>
          <span className="text-sm font-serif text-reading-secondary">
            Block {currentIndex + 1} of {blocks.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-serif text-reading-muted">View:</span>
          <div className="bg-surface-paper rounded-book p-1 shadow-paper border border-library-sage-200">
            <button
              onClick={() => {
                console.log('Switching to traditional view');
                setViewMode('traditional');
              }}
              className={`px-3 py-1.5 text-xs font-serif rounded-paper transition-all ${
                viewMode === 'traditional'
                  ? 'bg-library-gold-100 text-reading-accent shadow-sm'
                  : 'text-reading-muted hover:text-reading-secondary'
              }`}
              title="Traditional linear view"
            >
              📄 Single
            </button>
            <button
              onClick={() => {
                console.log('Switching to stack view');
                setViewMode('stack');
              }}
              className={`px-3 py-1.5 text-xs font-serif rounded-paper transition-all ${
                viewMode === 'stack'
                  ? 'bg-library-gold-100 text-reading-accent shadow-sm'
                  : 'text-reading-muted hover:text-reading-secondary'
              }`}
              title="Contextual stack view"
            >
              📚 Stack
            </button>
          </div>
        </div>
      </div>

      {/* Content area - switches between views */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'traditional' ? (
          // Traditional linear view
          <>
            <div className="flex-1 overflow-auto p-4 h-full">
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
                  customStyle={{ backgroundColor: 'white' }}
                  onRefreshRabbitholes={onRefreshRabbitholes}
                  onAddTextToChat={onAddTextToChat}
                  onRabbitholeClick={onRabbitholeClick}
                  onCreateRabbithole={onCreateRabbithole}
                  onUpdateBlockMetadata={onUpdateBlockMetadata}
                />
              </div>
            </div>
            
            {/* Traditional navigation controls */}
            <div className="relative h-20 border-t border-library-sage-200 bg-gradient-to-r from-surface-parchment to-library-cream-50">
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                <BlockNavigatorPill
                  currentIndex={currentIndex}
                  totalBlocks={blocks.length}
                  onPrevious={goToPrevBlock}
                  onNext={goToNextBlock}
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
          </>
        ) : (
          // Contextual stack view
          <div className="h-full">
            <BlockContextStack
              blocks={blocks}
              currentBlockId={currentBlock.id}
              documentId={documentId}
              onBlockChange={(block) => {
                console.log('BlockContextStack onBlockChange called:', block);
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
  );
} 