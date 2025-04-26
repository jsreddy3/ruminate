import React, { useState, useEffect } from 'react';
import BlockContainer from './BlockContainer';
import { Block } from '../../../components/pdf/PDFViewer';

interface BlockNavigatorProps {
  blocks: Block[];
  currentBlockId?: string;
  documentId: string;
  onBlockChange?: (block: Block) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateAgentChat?: (text: string, startOffset: number, endOffset: number) => void;
  onRefreshRabbitholes?: (refreshFn: () => void) => void;
  onAddTextToChat?: (text: string) => void;
}

export default function BlockNavigator({
  blocks,
  currentBlockId,
  documentId,
  onBlockChange,
  onRabbitholeClick,
  onCreateAgentChat,
  onRefreshRabbitholes,
  onAddTextToChat
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
    <div className="flex flex-col h-full">
      {/* Navigation controls */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex space-x-2">
          <button
            onClick={goToPrevBlock}
            disabled={currentIndex === 0}
            className={`p-1.5 rounded ${
              currentIndex === 0 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Previous block"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          
          <button
            onClick={goToNextBlock}
            disabled={currentIndex === blocks.length - 1}
            className={`p-1.5 rounded ${
              currentIndex === blocks.length - 1 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Next block"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          Block {currentIndex + 1} of {blocks.length}
          {currentBlock.block_type && 
            <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
              {currentBlock.block_type}
            </span>
          }
        </div>
      </div>
      
      {/* Block content */}
      <div className="flex-grow overflow-auto p-3">
        <div className="border border-gray-100 rounded-md p-2 bg-white h-full">
          <BlockContainer
            key={currentBlock.id}
            blockId={currentBlock.id}
            blockType={currentBlock.block_type}
            htmlContent={currentBlock.html_content || ''}
            documentId={documentId}
            images={currentBlock.images}
            customStyle={{ backgroundColor: 'white' }}
            onRefreshRabbitholes={onRefreshRabbitholes}
            onAddTextToChat={onAddTextToChat}
            onRabbitholeClick={onRabbitholeClick}
            onCreateAgentChat={onCreateAgentChat}
          />
        </div>
      </div>
    </div>
  );
} 