import React, { useMemo } from 'react';
import { Block } from './PDFViewer';
import PDFBlockOverlay from './PDFBlockOverlay';

interface PDFPageOverlayProps {
  pageIndex: number;
  scale: number;
  blocks: Block[];
  blocksByPage: Map<number, Block[]>;
  selectedBlock: Block | null;
  isBlockSelectionMode: boolean;
  temporarilyHighlightedBlockId: string | null;
  onBlockClick: (block: Block) => void;
  onBlockSelect?: (blockId: string) => void;
  onboardingTargetBlockId?: string | null;
  isOnboardingActive?: boolean;
}

/**
 * Page-level overlay component that only re-renders when its specific data changes.
 * This replaces the renderOverlay callback pattern to prevent unnecessary re-renders.
 */
export const PDFPageOverlay: React.FC<PDFPageOverlayProps> = React.memo(({
  pageIndex,
  scale,
  blocks,
  blocksByPage,
  selectedBlock,
  isBlockSelectionMode,
  temporarilyHighlightedBlockId,
  onBlockClick,
  onBlockSelect,
  onboardingTargetBlockId,
  isOnboardingActive = false
}) => {
  // Get blocks for this specific page only
  const pageBlocks = useMemo(() => {
    return blocksByPage.get(pageIndex) || [];
  }, [blocksByPage, pageIndex]);
  
  // Only re-render if:
  // 1. Page blocks change
  // 2. Scale changes
  // 3. Selection mode changes
  // 4. Selected block is on this page
  // 5. Highlighted block is on this page
  
  const shouldShowSelectedBlock = useMemo(() => {
    if (!selectedBlock) return false;
    return pageBlocks.some(block => block.id === selectedBlock.id);
  }, [selectedBlock, pageBlocks]);
  
  const shouldShowHighlight = useMemo(() => {
    if (!temporarilyHighlightedBlockId) return false;
    return pageBlocks.some(block => block.id === temporarilyHighlightedBlockId);
  }, [temporarilyHighlightedBlockId, pageBlocks]);
  
  console.log(`[PDFPageOverlay] Rendering for page ${pageIndex}`, {
    blocksCount: pageBlocks.length,
    hasSelectedBlock: shouldShowSelectedBlock,
    hasHighlight: shouldShowHighlight,
    scale,
    isBlockSelectionMode
  });
  
  return (
    <PDFBlockOverlay
      blocks={pageBlocks}
      selectedBlock={shouldShowSelectedBlock ? selectedBlock : null}
      pageIndex={pageIndex}
      scale={scale}
      onBlockClick={onBlockClick}
      isSelectionMode={isBlockSelectionMode}
      onBlockSelect={onBlockSelect}
      temporarilyHighlightedBlockId={shouldShowHighlight ? temporarilyHighlightedBlockId : null}
      onboardingTargetBlockId={onboardingTargetBlockId}
      isOnboardingActive={isOnboardingActive}
    />
  );
});

PDFPageOverlay.displayName = 'PDFPageOverlay';