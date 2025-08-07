import React, { useEffect, useMemo, useRef } from 'react';
import { Block } from '../../pdf/PDFViewer';
import BlockContainer from './BlockContainer';

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

  // Windowing: render only blocks within ±5 of focus
  const windowedBlocks = useMemo(() => {
    if (currentIndex === -1) return [] as Block[];
    const start = Math.max(0, currentIndex - 5);
    const end = Math.min(blocks.length, currentIndex + 6);
    return blocks.slice(start, end);
  }, [blocks, currentIndex]);

  // stable style object
  const baseStyle = useMemo(() => ({
    seamless: true as const,
    background: 'transparent',
    backgroundColor: 'transparent',
    border: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
    borderBottom: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    padding: 0,
    margin: 0,
    fontSize: '1.25rem'
  }), []);

  // Smoothly keep focused block near the top as it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = containerRef.current;
      const focused = focusedRef.current;
      if (!container || !focused) return;

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
      <div className="mx-auto max-w-[70ch] px-6 py-10 space-y-6">
        {windowedBlocks.map((block) => {
          const isFocused = block.id === currentBlockId;
          return (
            <div
              key={block.id}
              ref={isFocused ? focusedRef : undefined}
              className="transition-opacity duration-200"
              onClick={() => onBlockChange(block)}
              style={{ opacity: isFocused ? 1 : 0.88 }}
            >
              <BlockContainer
                blockId={block.id}
                blockType={block.block_type}
                htmlContent={block.html_content || ''}
                documentId={documentId}
                images={block.images}
                metadata={block.metadata}
                rabbitholeHighlights={getRabbitholeHighlightsForBlock ? getRabbitholeHighlightsForBlock(block.id) : []}
                customStyle={baseStyle}
                onRefreshRabbitholes={onRefreshRabbitholes}
                onAddTextToChat={onAddTextToChat}
                onRabbitholeClick={onRabbitholeClick}
                onCreateRabbithole={onCreateRabbithole}
                onUpdateBlockMetadata={onUpdateBlockMetadata}
                interactionEnabled={isFocused}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
} 