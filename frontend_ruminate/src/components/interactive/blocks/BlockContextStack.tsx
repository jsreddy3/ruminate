import React from 'react';
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
    <div className={`h-full bg-gradient-to-b from-surface-paper to-library-cream-50 overflow-y-auto ${className}`}>
      {/* Show 5 blocks: 2 before, current, 2 after - for natural reading flow */}
      <div className="py-8 px-6 space-y-6 max-w-4xl mx-auto">
        {[-2, -1, 0, 1, 2].map(offset => {
          const blockIndex = currentIndex + offset;
          if (blockIndex < 0 || blockIndex >= blocks.length) return null;
          
          const block = blocks[blockIndex];
          const isCurrent = offset === 0;
          const opacity = isCurrent ? 1.0 : offset === -1 || offset === 1 ? 0.7 : 0.5;
          
          console.log('Rendering block:', { offset, blockIndex, blockId: block.id, isCurrent });
          
          return (
            <div
              key={block.id}
              className={`transition-all duration-300 cursor-pointer rounded-journal border ${
                isCurrent 
                  ? 'bg-surface-paper border-library-gold-300 shadow-book' 
                  : 'bg-surface-parchment border-library-sage-200 hover:border-library-gold-200 hover:shadow-paper'
              }`}
              style={{ opacity }}
              onClick={() => onBlockChange(block)}
            >
              {/* Block header */}
              <div className="flex items-center justify-between p-4 border-b border-library-sage-200 bg-gradient-to-r from-surface-parchment to-library-cream-50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isCurrent ? 'bg-library-gold-400' : 'bg-library-sage-400'
                  }`} />
                  <span className="text-sm font-serif text-reading-secondary">
                    {block.block_type}
                  </span>
                  {isCurrent && (
                    <span className="text-xs bg-library-gold-100 text-reading-accent px-2 py-1 rounded-paper font-serif">
                      Currently Reading
                    </span>
                  )}
                </div>
                <div className="text-xs text-reading-muted font-serif">
                  Block {blockIndex + 1} of {blocks.length}
                  {block.page_number && ` • Page ${block.page_number}`}
                </div>
              </div>

              {/* Block content using the same renderer as linear view */}
              <div className="p-6">
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
                
                {/* Navigation hint for context blocks */}
                {!isCurrent && (
                  <div className="mt-4 pt-3 border-t border-library-sage-200 flex items-center justify-between">
                    <span className="text-xs text-reading-muted font-serif">
                      Click to focus this block
                    </span>
                    <span className="text-xs text-reading-muted font-serif">
                      {offset > 0 ? '↓ Next' : '↑ Previous'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reading position indicator */}
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