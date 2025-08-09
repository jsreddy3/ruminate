import React, { useEffect } from 'react';
import TextRenderer from './text/TextRenderer';
import PictureBlock from './other/PictureBlock';
import FigureBlock from './other/FigureBlock';
import MathBlock from './other/MathBlock';
import EquationBlock from './other/EquationBlock';
import Table from './other/Table';
import CodeBlock from './other/CodeBlock';
import { RabbitholeHighlight } from '../../../services/rabbithole';

interface BlockRendererProps {
  blockType: string;
  htmlContent: string;
  blockId: string;
  documentId: string;
  images?: { [key: string]: string };
  metadata?: {
    definitions?: {
      [key: string]: {
        term: string;
        definition: string;
        text_start_offset: number;
        text_end_offset: number;
        created_at: string;
      };
    };
    annotations?: {
      [key: string]: {
        id: string;
        text: string;
        note: string;
        text_start_offset: number;
        text_end_offset: number;
        created_at: string;
        updated_at: string;
      };
    };
    [key: string]: any;
  };
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  rabbitholeHighlights?: RabbitholeHighlight[];
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  onTextSelectionForOnboarding?: () => void;
  isOnboardingStep5?: boolean;
  isOnboardingStep6?: boolean;
  onCreateChatForOnboarding?: () => void;
  customStyle?: React.CSSProperties & { seamless?: boolean };
  // New prop to gate interactions for seamless mode
  interactionEnabled?: boolean;
}

/**
 * BlockRenderer selects the appropriate renderer component based on block type.
 * This is a pure presentational component that doesn't fetch or manage data.
 */
export default function BlockRenderer({
  blockType,
  htmlContent,
  blockId,
  documentId,
  images = {},
  metadata,
  highlights = [],
  rabbitholeHighlights = [],
  onAddTextToChat,
  onRabbitholeClick,
  onCreateRabbithole,
  onUpdateBlockMetadata,
  onTextSelectionForOnboarding,
  isOnboardingStep5,
  isOnboardingStep6,
  onCreateChatForOnboarding,
  customStyle,
  interactionEnabled
}: BlockRendererProps) {
  const type = blockType.toLowerCase();
  
    // Debug log for block type and content
  
  // Unsupported block types
  const unsupportedTypes = [
    'line', 'span', 'figuregroup', 'picturegroup', 'page', 'form', 
    'handwriting', 'document', 'complexregion', 'tableofcontents', 'pagefooter'
  ].map(t => t.toLowerCase());
  
  if (unsupportedTypes.includes(type)) {
    return (
      <div className="p-4 text-slate-500 italic">
        This block type is not supported for chat interaction.
      </div>
    );
  }
  
  // Wrap content based on block type
  const content = (() => {
    switch (type) {
      case 'picture':
        return <PictureBlock images={images} blockId={blockId} documentId={documentId} />;
      case 'figure':
        return <FigureBlock images={images} blockId={blockId} documentId={documentId} />;
      // Removed textinlinemath case - should be handled by TextRenderer like other text blocks
      case 'equation':
        return (
          <EquationBlock
            html_content={htmlContent}
            block_type={blockType}
            getBlockClassName={() => ''}
          />
        );
      case 'table':
        return (
          <Table
            html_content={htmlContent}
            block_type={blockType}
            getBlockClassName={() => ''}
          />
        );
      case 'code':
        return (
          <CodeBlock
            html_content={htmlContent}
            block_type={blockType}
            getBlockClassName={() => ''}
          />
        );
      default:
        return (
          <TextRenderer
            htmlContent={htmlContent}
            blockType={blockType}
            blockId={blockId}
            documentId={documentId}
            metadata={metadata}
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
  })();
  return (
    <div style={customStyle}>
      {content}
    </div>
  );
}
