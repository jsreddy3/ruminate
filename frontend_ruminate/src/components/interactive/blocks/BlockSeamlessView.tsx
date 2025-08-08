import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { Block } from '../../pdf/PDFViewer';
import BlockContainer from './BlockContainer';
import { TextInteractionProvider } from './text/TextInteractionContext';
import GlobalTextOverlay from './text/GlobalTextOverlay';
import { createRabbithole, RabbitholeHighlight } from '../../../services/rabbithole';
import { blocksActions, useBlocksSelector, useCurrentBlockId } from '../../../store/blocksStore';
import SeamlessBlockRow from './SeamlessBlockRow';

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
  // Initialize store once when inputs arrive
  useEffect(() => {
    if (blocks && blocks.length > 0) {
      blocksActions.initialize(blocks, currentBlockId);
    }
  }, [blocks, currentBlockId]);

  const storeCurrentBlockId = useCurrentBlockId();
  const effectiveCurrentBlockId = storeCurrentBlockId || currentBlockId;
  const currentIndex = useBlocksSelector(
    (s) => s.blockOrder.findIndex((id) => id === effectiveCurrentBlockId),
    (a, b) => a === b
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);

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
  }, [effectiveCurrentBlockId]);

  // Window small for perf (guard when index invalid)
  const startIndex = Math.max(0, currentIndex < 0 ? 0 : currentIndex - 4);
  const endIndex = Math.max(startIndex, Math.min((blocks?.length || 0), (currentIndex < 0 ? 0 : currentIndex + 5)));
  const windowedIds = useBlocksSelector(
    (s) => s.blockOrder.slice(startIndex, endIndex),
    (a, b) => a.length === b.length && a.every((v, i) => v === b[i])
  );

  const handleFocusChange = useCallback((block: Block) => {
    blocksActions.setCurrentBlockId(block.id);
    onBlockChange?.(block);
  }, [onBlockChange]);

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

      // Optimistic underline via store
      blocksActions.addRabbitholeHighlight(blockId, {
        id: conversationId,
        selected_text: text,
        text_start_offset: start,
        text_end_offset: end,
        created_at: new Date().toISOString(),
        conversation_id: conversationId,
      });

      // Optimistic metadata
      onUpdateBlockMetadata?.(blockId, {
        rabbithole_conversation_ids: [
          ...((blocks.find(b => b.id === blockId)?.metadata?.rabbithole_conversation_ids) || []),
          conversationId,
        ],
      });
      onRabbitholeClick?.(conversationId, text, start, end);
    } catch (e) {
      console.error('[Seamless] rabbithole create failed', e);
    }
  }, [blocks, onRabbitholeClick, onUpdateBlockMetadata]);

  return (
    <TextInteractionProvider>
      <div ref={containerRef} className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 ${className}`}>
        <div className="mx-auto max-w-[70ch] px-6 py-10 space-y-6">
          {windowedIds.map((blockId) => (
            <SeamlessBlockRow
              key={blockId}
              blockId={blockId}
              isFocused={blockId === effectiveCurrentBlockId}
              focusedRef={focusedRef}
              documentId={documentId}
              baseStyle={baseStyle}
              onFocusChange={handleFocusChange}
              onRefreshRabbitholes={onRefreshRabbitholes}
              onAddTextToChat={onAddTextToChat}
              onRabbitholeClick={onRabbitholeClick}
              onCreateRabbithole={(text: string, start: number, end: number) =>
                handleCreateRabbithole(documentId, blockId, text, start, end)
              }
              onUpdateBlockMetadata={onUpdateBlockMetadata}
              getRabbitholeHighlightsForBlock={getRabbitholeHighlightsForBlock as (id: string) => RabbitholeHighlight[]}
            />
          ))}
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