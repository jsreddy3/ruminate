import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Block } from '../../pdf/PDFViewer';
import BlockContainer from './BlockContainer';

interface BlockContextStackProps {
  blocks: Block[];
  currentBlockId: string;
  documentId: string;
  onBlockChange: (block: Block) => void;
  onAddTextToChat?: (text: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onRefreshRabbitholes?: (refreshFn: () => void) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  getRabbitholeHighlightsForBlock?: (blockId: string) => any[];
  className?: string;
}

export default function BlockContextStack({
  blocks,
  currentBlockId,
  documentId,
  onBlockChange,
  onAddTextToChat,
  onRabbitholeClick,
  onCreateRabbithole,
  onRefreshRabbitholes,
  onUpdateBlockMetadata,
  getRabbitholeHighlightsForBlock,
  className = ''
}: BlockContextStackProps) {
  
  // Find current block index
  const currentIndex = blocks.findIndex(block => block.id === currentBlockId);
  
  // Refs for container and focused block
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedBlockRef = useRef<HTMLDivElement>(null);
  
  // Check if this is the first showable text block
  const isFirstShowableTextBlock = useMemo(() => {
    // Find all text-based blocks before current
    const textBlockTypes = ['text', 'paragraph', 'section_header', 'title', 'subtitle', 'caption'];
    for (let i = 0; i < currentIndex; i++) {
      const blockType = blocks[i].block_type.toLowerCase();
      if (textBlockTypes.some(type => blockType.includes(type))) {
        return false; // Found a text block before current
      }
    }
    return true; // No text blocks before current
  }, [blocks, currentIndex]);
  
  

  // Update scroll position when focused block changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (focusedBlockRef.current && containerRef.current) {
        const container = containerRef.current;
        const focusedBlock = focusedBlockRef.current;
        
        // Get container height and focused block position
        const containerHeight = container.clientHeight;
        const blockOffsetTop = focusedBlock.offsetTop;
        
        // Calculate where we want the block to be
        let targetPosition;
        if (isFirstShowableTextBlock) {
          // For first text block, position at top with small padding
          targetPosition = 40;
        } else {
          // For other blocks, center at 40% from top
          targetPosition = containerHeight * 0.4;
        }
        
        // Scroll the container so the block appears at target position
        const scrollTarget = blockOffsetTop - targetPosition;
        
        container.scrollTo({
          top: scrollTarget,
          behavior: 'auto'
        });
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentIndex, currentBlockId, isFirstShowableTextBlock]);


  if (blocks.length === 0) {
    return (
      <div className="h-full bg-orange-200 p-8">
        <h2 className="text-black text-xl">NO BLOCKS FOUND</h2>
        <p className="text-black">blocks.length = {blocks.length}</p>
      </div>
    );
  }
  

  return (
    <div 
      ref={containerRef}
      className={`flex-1 bg-gradient-to-b from-surface-paper to-library-cream-50 overflow-y-auto overflow-x-hidden min-h-0 ${className}`}>
      {/* Content area with padding for scrolling */}
      <div 
        className="px-4 space-y-4 w-full"
        style={{ 
          overflowX: 'hidden',
          paddingTop: '40vh',  // Space to allow scrolling above first block
          paddingBottom: '60vh' // Space to allow scrolling below last block
        }}
      >
        {blocks.map((block, blockIndex) => {
          const offset = blockIndex - currentIndex;
          const isCurrent = offset === 0;
          const isAboveCurrent = offset < 0;
          const isBelowCurrent = offset > 0;
          
          // Only render blocks within 3 positions of current for performance
          const distance = Math.abs(offset);
          if (distance > 3) return null;
          
          // Calculate opacity based on distance from current
          const opacity = isCurrent ? 1.0 : 
                         distance === 1 ? 0.7 : 
                         distance === 2 ? 0.5 : 0.3;
          
          return (
            <div
              key={block.id}
              ref={isCurrent ? focusedBlockRef : undefined}
              className={`transition-all duration-300 cursor-pointer rounded-journal border ${
                isCurrent 
                  ? 'bg-surface-paper border-library-gold-300 shadow-book' 
                  : 'bg-surface-parchment border-library-sage-200 hover:border-library-gold-200 hover:shadow-paper'
              } w-full overflow-hidden flex flex-col`}
              style={{ 
                opacity,
                maxHeight: isCurrent ? '50vh' : '25vh'
              }}
              onClick={() => onBlockChange(block)}
            >
              {/* Block content using the same renderer as linear view */}
              <div className={`p-4 ${
                isCurrent ? 'overflow-y-auto flex-1' : 
                isAboveCurrent ? 'overflow-y-hidden flex-1 flex flex-col justify-end' : 
                'overflow-y-hidden flex-shrink-0'
              }`}>
                {isAboveCurrent && !isCurrent ? (
                  // For blocks above current, wrap in a div to allow bottom alignment
                  <div className="overflow-y-auto max-h-full">
                    <BlockContainer
                      blockId={block.id}
                      blockType={block.block_type}
                      htmlContent={block.html_content || ''}
                      documentId={documentId}
                      images={block.images}
                      metadata={block.metadata}
                      rabbitholeHighlights={getRabbitholeHighlightsForBlock ? getRabbitholeHighlightsForBlock(block.id) : []}
                      customStyle={{ 
                        backgroundColor: 'transparent',
                        fontSize: Math.abs(offset) === 1 ? '1.1rem' : '1rem'
                      }}
                      onRefreshRabbitholes={onRefreshRabbitholes}
                      onAddTextToChat={onAddTextToChat}
                      onRabbitholeClick={onRabbitholeClick}
                      onCreateRabbithole={onCreateRabbithole}
                      onUpdateBlockMetadata={onUpdateBlockMetadata}
                    />
                  </div>
                ) : (
                  // For current and below blocks, render normally
                  <BlockContainer
                    blockId={block.id}
                    blockType={block.block_type}
                    htmlContent={block.html_content || ''}
                    documentId={documentId}
                    images={block.images}
                    metadata={block.metadata}
                    rabbitholeHighlights={getRabbitholeHighlightsForBlock ? getRabbitholeHighlightsForBlock(block.id) : []}
                    customStyle={{ 
                      backgroundColor: 'transparent',
                      fontSize: isCurrent 
                        ? '1.4rem'   // Center block: significantly bigger for focus
                        : Math.abs(offset) === 1 
                          ? '1.1rem' // 1 away: slightly bigger than normal
                          : '1rem'   // 2 away: normal size (smallest)
                    }}
                    onRefreshRabbitholes={onRefreshRabbitholes}
                    onAddTextToChat={onAddTextToChat}
                    onRabbitholeClick={onRabbitholeClick}
                    onCreateRabbithole={onCreateRabbithole}
                    onUpdateBlockMetadata={onUpdateBlockMetadata}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}