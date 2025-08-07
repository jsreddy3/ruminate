import React, { forwardRef, useMemo } from 'react';
import { getBlockTypeStyles, baseTextStyles, containerStyles } from './textStyles';
import { HTMLSanitizer } from '../../../../utils/htmlSanitizer';

interface TextContentProps {
  htmlContent: string;
  blockType: string;
  processedContent: string; // Content with highlight markers already processed
  onClickHighlight: (e: React.MouseEvent) => void;
  getBlockClassName?: (blockType?: string) => string;
  customStyle?: React.CSSProperties & { seamless?: boolean };
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
    ...(customStyle?.seamless ? {} : containerStyles),
    ...baseTextStyles,
    ...getBlockTypeStyles(blockType),
    ...customStyle, // Custom overrides last
  };

  // Sanitize the processed content before rendering
  const sanitizedContent = useMemo(() => {
    return HTMLSanitizer.sanitizePDFContent(processedContent);
  }, [processedContent]);

  return (
    <div
      className={`text-renderer ${getBlockClassName(blockType)}`}
      ref={ref}
      onClick={onClickHighlight}
      style={mergedStyles}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
});

TextContent.displayName = 'TextContent';

export default TextContent;
