import React from 'react';
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
  images?: { [key: string]: string };
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  rabbitholeHighlights?: RabbitholeHighlight[];
  onAddTextToChat?: (text: string) => void;
}

/**
 * BlockRenderer selects the appropriate renderer component based on block type.
 * This is a pure presentational component that doesn't fetch or manage data.
 */
export default function BlockRenderer({
  blockType,
  htmlContent,
  blockId,
  images = {},
  highlights = [],
  rabbitholeHighlights = [],
  onAddTextToChat
}: BlockRendererProps) {
  const type = blockType.toLowerCase();
  
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
  
  // Choose which block component to render based on type
  switch (type) {
    case 'picture':
      return <PictureBlock images={images} />;
      
    case 'figure':
      return <FigureBlock images={images} />;
      
    case 'textinlinemath':
      return (
        <MathBlock 
          html_content={htmlContent} 
          block_type={blockType} 
          getBlockClassName={() => ''}
        />
      );
      
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
      // Default to TextRenderer for text-like content
      return (
        <TextRenderer 
          htmlContent={htmlContent} 
          blockType={blockType} 
          blockId={blockId}
          highlights={highlights} 
          rabbitholeHighlights={rabbitholeHighlights}
          onAddTextToChat={onAddTextToChat}
        />
      );
  }
}
