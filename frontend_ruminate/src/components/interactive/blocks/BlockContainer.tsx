import React, { memo } from 'react';
import BlockRenderer from './BlockRenderer';
import { RabbitholeHighlight } from '../../../services/rabbithole';
import type { TextEnhancement } from '../../../services/api/textEnhancements';

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
  definitionEnhancements?: TextEnhancement[];
  annotationEnhancements?: TextEnhancement[];
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onCreateDefinition?: (blockId: string, term: string, startOffset: number, endOffset: number, context?: string) => Promise<TextEnhancement>;
  onCreateAnnotation?: (blockId: string, text: string, note: string, startOffset: number, endOffset: number) => Promise<TextEnhancement | null>;
  onDeleteEnhancement?: (blockId: string, enhancementId: string) => Promise<void>;
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
  definitionEnhancements = [],
  annotationEnhancements = [],
  onAddTextToChat,
  onRabbitholeClick,
  onCreateRabbithole,
  onCreateDefinition,
  onCreateAnnotation,
  onDeleteEnhancement,
  onTextSelectionForOnboarding,
  isOnboardingStep5,
  isOnboardingStep6,
  onCreateChatForOnboarding,
  customStyle,
  interactionEnabled
}: BlockContainerProps) {
  
  // Convert new enhancement arrays back to legacy metadata format for BlockRenderer
  const enhancedMetadata = {
    ...metadata,
    definitions: definitionEnhancements.reduce((acc, enhancement) => {
      const key = `${enhancement.text_start_offset}-${enhancement.text_end_offset}`;
      acc[key] = {
        term: enhancement.data.term,
        definition: enhancement.data.definition,
        text_start_offset: enhancement.text_start_offset,
        text_end_offset: enhancement.text_end_offset,
        created_at: enhancement.created_at,
      };
      return acc;
    }, {} as Record<string, any>),
    annotations: annotationEnhancements.reduce((acc, enhancement) => {
      const key = `${enhancement.text_start_offset}-${enhancement.text_end_offset}`;
      acc[key] = {
        id: enhancement.id,
        text: enhancement.text,
        note: enhancement.data.note,
        text_start_offset: enhancement.text_start_offset,
        text_end_offset: enhancement.text_end_offset,
        created_at: enhancement.created_at,
        updated_at: enhancement.updated_at,
      };
      return acc;
    }, {} as Record<string, any>),
  };

  // Delegate rendering to the appropriate renderer component
  return (
    <BlockRenderer
      blockType={blockType}
      htmlContent={htmlContent}
      images={images}
      metadata={enhancedMetadata}
      blockId={blockId}
      documentId={documentId}
      highlights={highlights}
      rabbitholeHighlights={rabbitholeHighlights}
      definitionEnhancements={definitionEnhancements}
      annotationEnhancements={annotationEnhancements}
      onAddTextToChat={onAddTextToChat}
      onRabbitholeClick={onRabbitholeClick}
      onCreateRabbithole={onCreateRabbithole}
      onCreateDefinition={onCreateDefinition}
      onCreateAnnotation={onCreateAnnotation}
      onDeleteEnhancement={onDeleteEnhancement}
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
  if (prev.definitionEnhancements !== next.definitionEnhancements) return false; // reference equality
  if (prev.annotationEnhancements !== next.annotationEnhancements) return false; // reference equality
  if (prev.customStyle !== next.customStyle) return false; // ensure parent passes stable object
  // Functions are assumed stable (parent should use useCallback or static functions)
  return true;
}

export default memo(BlockContainer, arePropsEqual);
