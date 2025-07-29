import React, { useState, useEffect } from 'react';
import BlockContainer from './BlockContainer';
import BlockNavigatorPill from './BlockNavigatorPill';
import GeneratedNoteBadges from './GeneratedNoteBadges';
import { Block } from '../../../components/pdf/PDFViewer';

interface BlockNavigatorProps {
  blocks: Block[];
  currentBlockId?: string;
  documentId: string;
  onBlockChange?: (block: Block) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onRefreshRabbitholes?: (refreshFn: () => void) => void;
  onAddTextToChat?: (text: string) => void;
  onBlockMetadataUpdate?: () => void;
}

export default function BlockNavigator({
  blocks,
  currentBlockId,
  documentId,
  onBlockChange,
  onRabbitholeClick,
  onCreateRabbithole,
  onRefreshRabbitholes,
  onAddTextToChat,
  onBlockMetadataUpdate
}: BlockNavigatorProps) {
  // Track current index
  const [currentIndex, setCurrentIndex] = useState(0);
  
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
      {/* Block content - takes available space */}
      <div className="flex-1 overflow-auto p-4 relative">
        <div className="border border-gray-100 rounded-md p-2 bg-white">
          <BlockContainer
            key={currentBlock.id}
            blockId={currentBlock.id}
            blockType={currentBlock.block_type}
            htmlContent={currentBlock.html_content || ''}
            documentId={documentId}
            images={currentBlock.images}
            metadata={currentBlock.metadata}
            customStyle={{ backgroundColor: 'white' }}
            onRefreshRabbitholes={onRefreshRabbitholes}
            onAddTextToChat={onAddTextToChat}
            onRabbitholeClick={onRabbitholeClick}
            onCreateRabbithole={onCreateRabbithole}
            onBlockMetadataUpdate={onBlockMetadataUpdate}
          />
        </div>
        
      </div>
      
      {/* Spacer and floating pill container with note badges */}
      <div className="relative h-20">
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
            onViewConversation={onRabbitholeClick ? (conversationId) => {
              // Find the rabbithole with this conversation ID and trigger click
              onRabbitholeClick(conversationId, '', 0, 0);
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
} 