import React from 'react';
import BlockContainer from './BlockContainer';
import { useBlock, useBlockRabbitholes } from '../../../store/blocksStore';
import type { Block } from '../../pdf/PDFViewer';
import type { RabbitholeHighlight } from '../../../services/rabbithole';

interface SeamlessBlockRowProps {
  blockId: string;
  isFocused: boolean;
  focusedRef: React.RefObject<HTMLDivElement>;
  documentId: string;
  baseStyle: React.CSSProperties & { seamless?: boolean };
  onFocusChange: (block: Block) => void;
  onRefreshRabbitholes?: (refreshFn: () => void) => void;
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  getRabbitholeHighlightsForBlock?: (blockId: string) => RabbitholeHighlight[];
}

const SeamlessBlockRow: React.FC<SeamlessBlockRowProps> = ({
  blockId,
  isFocused,
  focusedRef,
  documentId,
  baseStyle,
  onFocusChange,
  onRefreshRabbitholes,
  onAddTextToChat,
  onRabbitholeClick,
  onCreateRabbithole,
  onUpdateBlockMetadata,
  getRabbitholeHighlightsForBlock,
}) => {
  const block = useBlock(blockId);
  const baseHighlights = (getRabbitholeHighlightsForBlock ? getRabbitholeHighlightsForBlock(blockId) : []) as RabbitholeHighlight[];
  const rabbitholeHighlights = useBlockRabbitholes(blockId) || baseHighlights;

  if (!block) return null;

  return (
    <div
      ref={isFocused ? focusedRef : undefined}
      data-block-id={blockId}
      className="transition-opacity duration-200"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.rabbithole-highlight, .definition-highlight, .annotation-highlight, .selection-tooltip, .definition-popup')) return;
        const sel = window.getSelection?.();
        if (sel && !sel.isCollapsed) return;
        onFocusChange(block);
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
        rabbitholeHighlights={rabbitholeHighlights}
        customStyle={baseStyle}
        onRefreshRabbitholes={onRefreshRabbitholes}
        onAddTextToChat={onAddTextToChat}
        onRabbitholeClick={onRabbitholeClick}
        onCreateRabbithole={onCreateRabbithole}
        onUpdateBlockMetadata={onUpdateBlockMetadata}
        interactionEnabled={true}
      />
    </div>
  );
};

export default React.memo(SeamlessBlockRow); 