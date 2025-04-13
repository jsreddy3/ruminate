import React, { forwardRef } from 'react';

interface TextContentProps {
  htmlContent: string;
  blockType: string;
  processedContent: string; // Content with highlight markers already processed
  onClickHighlight: (e: React.MouseEvent) => void;
  getBlockClassName?: (blockType?: string) => string;
}

/**
 * TextContent is a pure component that renders HTML content.
 * It doesn't handle selection, highlighting, or tooltips.
 */
const TextContent = forwardRef<HTMLDivElement, TextContentProps>((
  { 
    htmlContent, 
    blockType, 
    processedContent,
    onClickHighlight,
    getBlockClassName = () => '' 
  }, 
  ref
) => {
  return (
    <div
      className={`p-4 bg-stone-50 text-stone-900 rounded-md border border-amber-200 leading-relaxed ${getBlockClassName(blockType)}`}
      ref={ref}
      onClick={onClickHighlight}
      style={{
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '1.05rem',
        lineHeight: '1.5',
        color: '#222',
        textAlign: 'justify',
        textRendering: 'optimizeLegibility',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        background: 'linear-gradient(to right, rgba(255,253,242,1) 0%, rgba(255,251,235,1) 100%)'
      }}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
});

TextContent.displayName = 'TextContent';

export default TextContent;
