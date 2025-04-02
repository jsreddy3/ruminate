import React from 'react';
import TextBlock from '../blocks/TextBlock';
import PictureBlock from '../blocks/PictureBlock';
import FigureBlock from '../blocks/FigureBlock';
import MathBlock from '../blocks/MathBlock';
import EquationBlock from '../blocks/EquationBlock';
import Table from '../blocks/Table';
import CodeBlock from '../blocks/CodeBlock';

interface BlockContentProps {
  html_content: string;
  block_type: string;
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  images?: { [key: string]: string };
}

const getBlockClassName = (block_type?: string): string => {
  if (!block_type) return '';
  
  const type = block_type.toLowerCase();
  switch (type) {
    case 'sectionheader':
      return 'text-2xl font-bold mb-4';
    case 'pageheader':
    case 'pagefooter':
      return 'text-sm text-neutral-600';
    case 'listitem':
      return 'ml-4 list-disc';
    case 'footnote':
      return 'text-sm text-neutral-700 border-t border-neutral-200 mt-4 pt-2';
    case 'reference':
      return 'text-sm text-neutral-600 font-mono';
    default:
      return '';
  }
};

// List of unsupported block types
const unsupportedTypes = [
  'line',
  'span',
  'figuregroup',
  'picturegroup',
  'page',
  'form',
  'handwriting',
  'document',
  'complexregion',
  'tableofcontents',
  'pagefooter'
].map(type => type.toLowerCase());

export default function BlockContent({ html_content, block_type, highlights = [], images }: BlockContentProps) {
  const type = block_type?.toLowerCase();

  // Check if block type is unsupported
  if (unsupportedTypes.includes(type)) {
    return (
      <div className="p-4 text-neutral-500 italic">
        This block type is not supported for chat interaction.
      </div>
    );
  }

  // Handle supported block types
  if (type === 'picture') {
    return images ? <PictureBlock images={images} /> : null;
  }

  if (type === 'figure') {
    return images ? <FigureBlock images={images} /> : null;
  }

  if (type === 'textinlinemath') {
    return <MathBlock 
      html_content={html_content} 
      block_type={block_type} 
      getBlockClassName={getBlockClassName}
    />;
  }

  if (type === 'equation') {
    return <EquationBlock 
      html_content={html_content} 
      block_type={block_type} 
      getBlockClassName={getBlockClassName}
    />;
  }

  if (type === 'table') {
    return <Table 
      html_content={html_content} 
      block_type={block_type} 
      getBlockClassName={getBlockClassName}
    />;
  }

  if (type === 'code') {
    return <CodeBlock 
      html_content={html_content} 
      block_type={block_type} 
      getBlockClassName={getBlockClassName}
    />;
  }

  // Default to TextBlock for text-like content (including Caption and Handwriting)
  return <TextBlock 
    html_content={html_content} 
    block_type={block_type} 
    highlights={highlights} 
    getBlockClassName={getBlockClassName}
  />;
}