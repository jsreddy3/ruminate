import React from 'react';
import BlockContainer from './BlockContainer';
import { useBlock, useBlockEnhancements } from '../../../store/blocksStore';
import type { Block } from '../../pdf/PDFViewer';
import type { TextEnhancement } from '../../../services/api/textEnhancements';

interface SeamlessBlockRowProps {
  blockId: string;
  isFocused: boolean;
  focusedRef: React.RefObject<HTMLDivElement>;
  documentId: string;
  baseStyle: React.CSSProperties & { seamless?: boolean };
  onFocusChange: (block: Block) => void;
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onCreateDefinition?: (blockId: string, term: string, startOffset: number, endOffset: number, context?: string) => Promise<TextEnhancement>;
  onCreateAnnotation?: (blockId: string, text: string, note: string, startOffset: number, endOffset: number) => Promise<TextEnhancement | null>;
  onDeleteEnhancement?: (blockId: string, enhancementId: string) => Promise<void>;
}

const SeamlessBlockRow: React.FC<SeamlessBlockRowProps> = ({
  blockId,
  isFocused,
  focusedRef,
  documentId,
  baseStyle,
  onFocusChange,
  onAddTextToChat,
  onRabbitholeClick,
  onCreateRabbithole,
  onCreateDefinition,
  onCreateAnnotation,
  onDeleteEnhancement,
}) => {
  const block = useBlock(blockId);
  
  // Get all enhancements from the store
  const rabbitholeEnhancements = useBlockEnhancements(blockId, 'RABBITHOLE');
  const definitionEnhancements = useBlockEnhancements(blockId, 'DEFINITION');
  const annotationEnhancements = useBlockEnhancements(blockId, 'ANNOTATION');
  
  // Convert to legacy format for BlockContainer compatibility
  const rabbitholeHighlights = rabbitholeEnhancements.map(enhancement => ({
    id: enhancement.id,
    selected_text: enhancement.text,
    text_start_offset: enhancement.text_start_offset,
    text_end_offset: enhancement.text_end_offset,
    created_at: enhancement.created_at,
    conversation_id: enhancement.type === 'RABBITHOLE' ? enhancement.data.conversation_id : enhancement.id,
  }));

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
        definitionEnhancements={definitionEnhancements}
        annotationEnhancements={annotationEnhancements}
        customStyle={baseStyle}
        onAddTextToChat={onAddTextToChat}
        onRabbitholeClick={onRabbitholeClick}
        onCreateRabbithole={onCreateRabbithole}
        onCreateDefinition={onCreateDefinition}
        onCreateAnnotation={onCreateAnnotation}
        onDeleteEnhancement={onDeleteEnhancement}
        interactionEnabled={true}
      />
    </div>
  );
};

export default React.memo(SeamlessBlockRow); 