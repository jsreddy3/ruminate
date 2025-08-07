import React, { useEffect, useMemo, useRef } from 'react';
import { Block } from '../../pdf/PDFViewer';
import BlockContainer from './BlockContainer';
import { useBlockImages } from '../../../hooks/useBlockImages';

interface BlockSeamlessViewProps {
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

export default function BlockSeamlessView({
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
}: BlockSeamlessViewProps) {
  const currentIndex = useMemo(() => blocks.findIndex(b => b.id === currentBlockId), [blocks, currentBlockId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);

  const { fetchBlockImages } = useBlockImages(documentId);

  // Smoothly keep focused block near the top as it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = containerRef.current;
      const focused = focusedRef.current;
      if (!container || !focused) return;

      // Aim to place focused block ~15% from the top
      const viewport = container.clientHeight;
      const targetTop = viewport * 0.15;
      const blockTop = focused.offsetTop;
      const scrollTop = blockTop - targetTop;
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(timer);
  }, [currentIndex, currentBlockId]);

  if (blocks.length === 0) return null;

  return (
    <div ref={containerRef} className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 ${className}`}>
      {/* Minimal spacing between blocks for seamless reading */}
      <div className="px-6 py-8 space-y-3">
        {blocks.map((block) => {
          const isFocused = block.id === currentBlockId;
          return (
            <div
              key={block.id}
              ref={isFocused ? focusedRef : undefined}
              className={`transition-colors duration-200 rounded-none`}
              onClick={() => onBlockChange(block)}
              style={{
                // Subtle background only for focused block
                backgroundColor: isFocused ? 'rgba(255, 249, 231, 0.35)' : 'transparent',
              }}
            >
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
                  fontSize: '1.25rem',
                }}
                onRefreshRabbitholes={onRefreshRabbitholes}
                onAddTextToChat={onAddTextToChat}
                onRabbitholeClick={onRabbitholeClick}
                onCreateRabbithole={onCreateRabbithole}
                onUpdateBlockMetadata={onUpdateBlockMetadata}
                // Only the focused block is interactive
                interactionEnabled={isFocused}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
} 