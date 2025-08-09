import React from 'react';
import BlockSeamlessView from './BlockSeamlessView';
import { Block } from '../../pdf/PDFViewer';

interface DocumentViewSwitcherProps {
  blocks: Block[];
  currentBlockId: string;
  documentId: string;
  onBlockChange: (block: Block) => void;
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  className?: string;
  isArrowNavigationRef?: { current: boolean };
  
  // Feature flag to switch between old and new systems
  useOptimized?: boolean;
}

/**
 * Wrapper for BlockSeamlessView - keeping for backward compatibility
 * Can be removed once all references are updated to use BlockSeamlessView directly
 */
export default function DocumentViewSwitcher({
  useOptimized = false, // Ignored now - always use BlockSeamlessView
  ...props
}: DocumentViewSwitcherProps) {
  
  // Always use the working BlockSeamlessView
  return (
    <BlockSeamlessView
      blocks={props.blocks}
      currentBlockId={props.currentBlockId}
      documentId={props.documentId}
      onBlockChange={props.onBlockChange}
      onAddTextToChat={props.onAddTextToChat}
      onRabbitholeClick={props.onRabbitholeClick}
      className={props.className}
      isArrowNavigationRef={props.isArrowNavigationRef}
    />
  );
}

// Keep legacy export for compatibility
export { BlockSeamlessView as LegacyDocumentView };