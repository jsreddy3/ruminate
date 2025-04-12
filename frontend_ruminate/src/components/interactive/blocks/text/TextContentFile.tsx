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
      className={`p-4 bg-slate-50 text-slate-900 rounded-md border-l-4 border-l-indigo-500 border-t border-r border-b border-slate-200 font-reading leading-relaxed shadow-md ${getBlockClassName(blockType)}`}
      ref={ref}
      onClick={onClickHighlight}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
});

TextContent.displayName = 'TextContent';

export default TextContent;
