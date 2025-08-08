import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Block } from '../../pdf/PDFViewer';
import BlockContainer from './BlockContainer';
import { TextInteractionProvider } from './text/TextInteractionContext';
import GlobalTextOverlay from './text/GlobalTextOverlay';
import { createRabbithole, RabbitholeHighlight } from '../../../services/rabbithole';

interface BlockSeamlessViewProps {
  blocks: Block[];
  currentBlockId: string;
  documentId: string;
  onBlockChange: (block: Block) => void;
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
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
  onRefreshRabbitholes,
  onUpdateBlockMetadata,
  getRabbitholeHighlightsForBlock,
  className = ''
}: BlockSeamlessViewProps) {
  const currentIndex = useMemo(() => blocks.findIndex(b => b.id === currentBlockId), [blocks, currentBlockId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);

  // Local, optimistic highlights per block
  const [localHighlights, setLocalHighlights] = useState<Record<string, RabbitholeHighlight[]>>({});

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

  // Centralized creation logic that always uses the correct block context
  const handleCreateRabbithole = useCallback(async (
    docId: string,
    blockId: string,
    text: string,
    start: number,
    end: number
  ) => {
    try {
      const conversationId = await createRabbithole({
        document_id: docId,
        block_id: blockId,
        selected_text: text,
        start_offset: start,
        end_offset: end,
        type: 'rabbithole'
      });

      // Optimistic underline for this block
      setLocalHighlights(prev => ({
        ...prev,
        [blockId]: [
          ...(prev[blockId] || []),
          {
            id: conversationId,
            selected_text: text,
            text_start_offset: start,
            text_end_offset: end,
            created_at: new Date().toISOString(),
            conversation_id: conversationId
          }
        ]
      }));

      // Optimistic metadata update for this block
      if (onUpdateBlockMetadata) {
        const b = blocks.find(b => b.id === blockId);
        const currentIds = b?.metadata?.rabbithole_conversation_ids || [];
        onUpdateBlockMetadata(blockId, {
          rabbithole_conversation_ids: [...currentIds, conversationId]
        });
      }

      // Open conversation UI if handler provided
      onRabbitholeClick?.(conversationId, text, start, end);
    } catch (e) {
      console.error('[Seamless] Failed to create rabbithole conversation', e);
    }
  }, [blocks, onRabbitholeClick, onUpdateBlockMetadata]);

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
    <TextInteractionProvider>
      <div ref={containerRef} className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 ${className}`}>
        <div className="mx-auto max-w-[70ch] px-6 py-10 space-y-6">
          {windowedBlocks.map((block) => {
            const isFocused = block.id === currentBlockId;
            const baseHighlights = (getRabbitholeHighlightsForBlock ? getRabbitholeHighlightsForBlock(block.id) : []) as RabbitholeHighlight[];
            const optimistic = localHighlights[block.id] || [];
            const combinedHighlights = baseHighlights.concat(optimistic);
            return (
              <div
                key={block.id}
                ref={isFocused ? focusedRef : undefined}
                className="transition-opacity duration-200"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  // If clicking a highlight or an active overlay element, don't change focus
                  if (target.closest('.rabbithole-highlight, .definition-highlight, .annotation-highlight, .selection-tooltip, .definition-popup')) {
                    return;
                  }
                  // If there is an active text selection, don't change focus (let selection tooltip open)
                  const sel = window.getSelection?.();
                  if (sel && !sel.isCollapsed) {
                    return;
                  }
                  onBlockChange(block);
                }}
                style={{ opacity: isFocused ? 1 : 0.88 }}
              >
                <BlockContainer
                  blockId={block.id}
                  blockType={block.block_type}
                  htmlContent={block.html_content || ''}
                  documentId={documentId}
                  images={block.images}
                  metadata={block.metadata}
                  rabbitholeHighlights={combinedHighlights}
                  customStyle={baseStyle}
                  onRefreshRabbitholes={onRefreshRabbitholes}
                  onAddTextToChat={onAddTextToChat}
                  onRabbitholeClick={onRabbitholeClick}
                  onCreateRabbithole={(text: string, start: number, end: number, maybeBlockId?: string) =>
                    handleCreateRabbithole(documentId, maybeBlockId ?? block.id, text, start, end)
                  }
                  onUpdateBlockMetadata={onUpdateBlockMetadata}
                  interactionEnabled={true}
                />
              </div>
            );
          })}
        </div>
      </div>
      <GlobalTextOverlay
        onAddToChat={(docId, blockId, text) => onAddTextToChat?.(text, blockId)}
        onCreateRabbithole={(docId: string, blockId: string, text: string, start: number, end: number) =>
          handleCreateRabbithole(docId, blockId, text, start, end)
        }
        onUpdateBlockMetadata={onUpdateBlockMetadata}
      />
    </TextInteractionProvider>
  );
} 