import React, { useEffect, memo } from 'react';
import BlockRenderer from './BlockRenderer';
import { RabbitholeHighlight } from '../../../services/rabbithole';

interface BlockContainerProps {
  blockId: string;
  blockType: string;
  htmlContent: string;
  documentId: string;
  images?: { [key: string]: string };
  metadata?: any;
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
  isOnboardingStep5?: boolean;
  isOnboardingStep6?: boolean;
  onCreateChatForOnboarding?: () => void;
  customStyle?: React.CSSProperties & { seamless?: boolean };
  // New: gate interactions in child renderer
  interactionEnabled?: boolean;
}

/**
 * BlockContainer now receives pre-computed rabbithole highlights.
 * No more per-block fetching - data comes from document-level state.
 */
function BlockContainer({
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
  isOnboardingStep5,
  isOnboardingStep6,
  onCreateChatForOnboarding,
  customStyle,
  interactionEnabled
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
      isOnboardingStep5={isOnboardingStep5}
      isOnboardingStep6={isOnboardingStep6}
      onCreateChatForOnboarding={onCreateChatForOnboarding}
      customStyle={customStyle}
      interactionEnabled={interactionEnabled}
    />
  );
}

function arePropsEqual(prev: Readonly<BlockContainerProps>, next: Readonly<BlockContainerProps>) {
  if (prev.blockId !== next.blockId) return false;
  if (prev.htmlContent !== next.htmlContent) return false;
  if (prev.blockType !== next.blockType) return false;
  if (prev.documentId !== next.documentId) return false;
  if (prev.interactionEnabled !== next.interactionEnabled) return false;
  if (prev.metadata !== next.metadata) return false; // rely on reference equality
  if (prev.rabbitholeHighlights !== next.rabbitholeHighlights) return false; // reference equality
  if (prev.customStyle !== next.customStyle) return false; // ensure parent passes stable object
  // Functions are assumed stable (parent should use useCallback or static functions)
  return true;
}

export default memo(BlockContainer, arePropsEqual);
