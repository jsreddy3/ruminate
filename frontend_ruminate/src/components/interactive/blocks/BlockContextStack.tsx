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
  
  // Calculate transform to keep focused block at consistent position
  const [contentTransform, setContentTransform] = useState<string>('translateY(0px)');
  
  // Dynamic block range based on container height
  const [visibleBlockRange, setVisibleBlockRange] = useState(2); // Default to showing 2 blocks before/after
  
  // Calculate optimal block range based on container height
  const calculateOptimalBlockRange = useMemo(() => {
    if (!containerRef.current) return 2;
    
    const containerHeight = containerRef.current.clientHeight;
    const minHeight = 400; // Minimum height threshold
    const maxHeight = 800; // Maximum height threshold
    
    // Calculate range based on available height
    if (containerHeight < minHeight) {
      return 1; // Show fewer blocks when space is limited
    } else if (containerHeight > maxHeight) {
      return 3; // Show more blocks when we have lots of space
    } else {
      return 2; // Default range
    }
  }, [containerRef.current?.clientHeight]);
  
  // Update block range based on container height
  useEffect(() => {
    const updateBlockRange = () => {
      const newRange = calculateOptimalBlockRange;
      setVisibleBlockRange(newRange);
    };
    
    // Initial calculation
    updateBlockRange();
    
    // Recalculate on resize
    const resizeObserver = new ResizeObserver(updateBlockRange);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [calculateOptimalBlockRange]);

  // Update transform when focused block changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (focusedBlockRef.current && containerRef.current) {
        const container = containerRef.current;
        const focusedBlock = focusedBlockRef.current;
        
        // Target position: 30% from top of viewport
        const containerHeight = container.clientHeight;
        const targetPosition = containerHeight * 0.3;
        
        // Get focused block's current position
        const blockTop = focusedBlock.offsetTop;
        
        // Calculate how much to translate content to put focused block at target position
        const translateY = targetPosition - blockTop;
        
        console.log('Transform calculation:', {
          containerHeight,
          targetPosition,
          blockTop,
          translateY,
          visibleBlockRange
        });
        
        setContentTransform(`translateY(${translateY}px)`);
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [currentIndex, currentBlockId, visibleBlockRange]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with form inputs
      }
      
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        const nextIndex = currentIndex + direction;
        
        if (nextIndex >= 0 && nextIndex < blocks.length) {
          onBlockChange(blocks[nextIndex]);
        }
      }
    };

    // Only add listener when container is focused or contains focused element
    if (containerRef.current) {
      containerRef.current.addEventListener('keydown', handleKeyDown);
      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('keydown', handleKeyDown);
        }
      };
    }
  }, [currentIndex, blocks, onBlockChange]);

  if (blocks.length === 0) {
    return (
      <div className="h-full bg-orange-200 p-8">
        <h2 className="text-black text-xl">NO BLOCKS FOUND</h2>
        <p className="text-black">blocks.length = {blocks.length}</p>
      </div>
    );
  }

  console.log('BlockContextStack render:', { 
    blocksLength: blocks.length, 
    currentIndex, 
    currentBlockId 
  });
  

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className={`bg-gradient-to-b from-surface-paper to-library-cream-50 overflow-y-auto overflow-x-hidden focus:outline-none ${className}`}
      style={{ 
        height: '100%',
        minHeight: '300px',  // Ensure minimum space for at least current block
        maxHeight: '90vh'    // Limit maximum height to 90% of viewport
      }}>
      {/* Content area that gets transformed to keep focused block at consistent position */}
      <div 
        className="py-6 px-4 space-y-4 w-full transition-transform duration-500 ease-out min-h-full"
        style={{ 
          transform: contentTransform,
          overflowX: 'hidden'
        }}
      >
        {Array.from({ length: visibleBlockRange * 2 + 1 }, (_, i) => i - visibleBlockRange).map(offset => {
          const blockIndex = currentIndex + offset;
          if (blockIndex < 0 || blockIndex >= blocks.length) return null;
          
          const block = blocks[blockIndex];
          const isCurrent = offset === 0;
          const opacity = isCurrent ? 1.0 : Math.abs(offset) === 1 ? 0.7 : 0.5;
          
          console.log('Rendering block:', { offset, blockIndex, blockId: block.id, isCurrent });
          
          return (
            <div
              key={block.id}
              ref={isCurrent ? focusedBlockRef : undefined}
              className={`transition-all duration-300 cursor-pointer rounded-journal border ${
                isCurrent 
                  ? 'bg-surface-paper border-library-gold-300 shadow-book' 
                  : 'bg-surface-parchment border-library-sage-200 hover:border-library-gold-200 hover:shadow-paper'
              } w-full overflow-hidden`}
              style={{ 
                opacity
              }}
              onClick={() => onBlockChange(block)}
            >
              {/* Block content using the same renderer as linear view */}
              <div className="p-4">
                <BlockContainer
                  key={block.id}
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Reading position indicator with scroll hint */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-surface-parchment/95 backdrop-blur-sm px-4 py-2 rounded-book shadow-paper border border-library-gold-200">
        <div className="flex items-center gap-4 text-sm text-reading-secondary">
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-library-cream-100 rounded text-xs font-mono">↑</kbd>
            <span className="font-serif text-xs">Previous</span>
          </div>
          <div className="w-px h-4 bg-library-sage-300"></div>
          <span className="font-serif text-xs font-medium">
            Reading {currentIndex + 1} of {blocks.length}
          </span>
          <div className="w-px h-4 bg-library-sage-300"></div>
          <div className="flex items-center gap-1">
            <span className="font-serif text-xs">Next</span>
            <kbd className="px-2 py-1 bg-library-cream-100 rounded text-xs font-mono">↓</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}