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
      return 'text-sm text-slate-600';
    case 'listitem':
      return 'ml-4 list-disc';
    case 'footnote':
      return 'text-sm text-slate-700 border-t border-slate-200 mt-4 pt-2';
    case 'reference':
      return 'text-sm text-slate-600 font-mono';
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

  // Create a wrapper div that provides consistent styling across all block types
  const BlockWrapper = ({ children }: { children: React.ReactNode }) => {
    // Generate a suitable background color based on block type
    const getBgColor = () => {
      switch (type) {
        case 'sectionheader':
          return 'bg-gradient-to-r from-indigo-50 to-white';
        case 'pageheader':
          return 'bg-gradient-to-r from-blue-50 to-white';
        case 'equation':
        case 'textinlinemath':
          return 'bg-gradient-to-r from-cyan-50 to-white';
        case 'table':
          return 'bg-gradient-to-r from-emerald-50 to-white';
        case 'picture':
        case 'figure':
          return 'bg-gradient-to-r from-amber-50 to-white';
        case 'code':
          return 'bg-gradient-to-r from-slate-50 to-white';
        default:
          return 'bg-gradient-to-r from-slate-50 to-white';
      }
    };

    // Generate accent color based on block type
    const getAccentColor = () => {
      switch (type) {
        case 'sectionheader':
          return 'border-l-indigo-500';
        case 'pageheader':
          return 'border-l-blue-500';
        case 'equation':
        case 'textinlinemath':
          return 'border-l-cyan-500';
        case 'table':
          return 'border-l-emerald-500';
        case 'picture':
        case 'figure':
          return 'border-l-amber-500';
        case 'code':
          return 'border-l-slate-500';
        default:
          return 'border-l-indigo-500';
      }
    };

    // Get icon for block type
    const getBlockIcon = () => {
      switch (type) {
        case 'sectionheader':
          return '📑';
        case 'pageheader':
          return '📄';
        case 'equation':
        case 'textinlinemath':
          return '🧮';
        case 'table':
          return '📊';
        case 'picture':
        case 'figure':
          return '🖼️';
        case 'code':
          return '💻';
        default:
          return '📝';
      }
    };

    return (
      <div className={`mb-6 rounded-lg overflow-hidden shadow-md border border-slate-200 ${getBgColor()}`}>
        <div className="sticky top-0 z-10 bg-slate-100 px-3 py-2 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getBlockIcon()}</span>
            <span className="text-xs uppercase tracking-wider text-slate-600 font-semibold">
              {type === 'sectionheader' ? 'Section Header' : 
              type === 'pageheader' ? 'Page Header' : 
              type === 'table' ? 'Table' : 
              type === 'picture' || type === 'figure' ? 'Image' : 
              type === 'equation' ? 'Equation' : 
              type === 'code' ? 'Code Block' : 
              'Text Content'}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            {/* Optional metadata could go here */}
          </div>
        </div>
        <div className={`p-0 border-l-4 ${getAccentColor()}`}>
          {children}
        </div>
      </div>
    );
  };

  // Check if block type is unsupported
  if (unsupportedTypes.includes(type)) {
    return (
      <BlockWrapper>
        <div className="p-4 text-slate-500 italic">
          This block type is not supported for chat interaction.
        </div>
      </BlockWrapper>
    );
  }

  // Handle supported block types
  if (type === 'picture') {
    return (
      <BlockWrapper>
        {images ? <PictureBlock images={images} /> : null}
      </BlockWrapper>
    );
  }

  if (type === 'figure') {
    return (
      <BlockWrapper>
        {images ? <FigureBlock images={images} /> : null}
      </BlockWrapper>
    );
  }

  if (type === 'textinlinemath') {
    return (
      <BlockWrapper>
        <MathBlock 
          html_content={html_content} 
          block_type={block_type} 
          getBlockClassName={getBlockClassName}
        />
      </BlockWrapper>
    );
  }

  if (type === 'equation') {
    return (
      <BlockWrapper>
        <EquationBlock 
          html_content={html_content} 
          block_type={block_type} 
          getBlockClassName={getBlockClassName}
        />
      </BlockWrapper>
    );
  }

  if (type === 'table') {
    return (
      <BlockWrapper>
        <Table 
          html_content={html_content} 
          block_type={block_type} 
          getBlockClassName={getBlockClassName}
        />
      </BlockWrapper>
    );
  }

  if (type === 'code') {
    return (
      <BlockWrapper>
        <CodeBlock 
          html_content={html_content} 
          block_type={block_type} 
          getBlockClassName={getBlockClassName}
        />
      </BlockWrapper>
    );
  }

  // Default to TextBlock for text-like content (including Caption and Handwriting)
  return (
    <BlockWrapper>
      <TextBlock 
        html_content={html_content} 
        block_type={block_type} 
        highlights={highlights} 
        getBlockClassName={getBlockClassName}
      />
    </BlockWrapper>
  );
}