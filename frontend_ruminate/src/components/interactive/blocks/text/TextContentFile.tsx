import React, { forwardRef } from 'react';
import { getBlockTypeStyles, baseTextStyles, containerStyles } from './textStyles';

interface TextContentProps {
  htmlContent: string;
  blockType: string;
  processedContent: string; // Content with highlight markers already processed
  onClickHighlight: (e: React.MouseEvent) => void;
  getBlockClassName?: (blockType?: string) => string;
  customStyle?: React.CSSProperties;
}

/**
 * TextContent is a pure component that renders HTML content.
 * It doesn't handle selection, highlighting, or tooltips.
 */
const TextContent = forwardRef<HTMLDivElement, TextContentProps>(
  (
    {
      blockType,
      processedContent,
      onClickHighlight,
      getBlockClassName = () => '',
      customStyle
    },
    ref
  ) => {
  // Merge styles in order of precedence
  const mergedStyles = {
    ...containerStyles,
    ...baseTextStyles,
    ...getBlockTypeStyles(blockType),
    ...customStyle, // Custom overrides last
  };

  return (
    <div
      className={`text-renderer ${getBlockClassName(blockType)}`}
      ref={ref}
      onClick={onClickHighlight}
      style={mergedStyles}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
});

TextContent.displayName = 'TextContent';

export default TextContent;
