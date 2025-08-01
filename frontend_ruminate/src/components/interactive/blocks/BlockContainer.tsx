import React, { useEffect } from 'react';
import BlockRenderer from './BlockRenderer';
import { RabbitholeHighlight } from '../../../services/rabbithole';

interface BlockContainerProps {
  blockId: string;
  blockType: string;
  htmlContent: string;
  documentId: string;
  images?: { [key: string]: string };
  metadata?: {
    definitions?: {
      [term: string]: {
        term: string;
        definition: string;
        created_at: string;
      };
    };
    [key: string]: any;
  };
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  rabbitholeHighlights?: RabbitholeHighlight[];
  onAddTextToChat?: (text: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onRefreshRabbitholes?: (refreshFn: () => void) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  onTextSelectionForOnboarding?: () => void;
  customStyle?: React.CSSProperties;
}

/**
 * BlockContainer now receives pre-computed rabbithole highlights.
 * No more per-block fetching - data comes from document-level state.
 */
export default function BlockContainer({
  blockId,
  blockType,
  htmlContent,
  documentId,
  images = {},
  metadata,
  highlights = [],
  rabbitholeHighlights = [],
  onAddTextToChat,
  onRabbitholeClick,
  onCreateRabbithole,
  onRefreshRabbitholes,
  onUpdateBlockMetadata,
  onTextSelectionForOnboarding,
  customStyle
}: BlockContainerProps) {
  // No-op refetch function for backwards compatibility
  const noOpRefetch = () => {
    // Rabbithole data is now managed at document level
    // Refreshing happens via optimistic updates
  };
  
  // Expose refetch function through callback for backwards compatibility
  useEffect(() => {
    if (onRefreshRabbitholes) {
      onRefreshRabbitholes(noOpRefetch);
    }
  }, [onRefreshRabbitholes]);
  
  // Delegate rendering to the appropriate renderer component
  return (
    <BlockRenderer
      blockType={blockType}
      htmlContent={htmlContent}
      images={images}
      metadata={metadata}
      blockId={blockId}
      documentId={documentId}
      highlights={highlights}
      rabbitholeHighlights={rabbitholeHighlights}
      onAddTextToChat={onAddTextToChat}
      onRabbitholeClick={onRabbitholeClick}
      onCreateRabbithole={onCreateRabbithole}
      onUpdateBlockMetadata={onUpdateBlockMetadata}
      onTextSelectionForOnboarding={onTextSelectionForOnboarding}
      customStyle={customStyle}
    />
  );
}
