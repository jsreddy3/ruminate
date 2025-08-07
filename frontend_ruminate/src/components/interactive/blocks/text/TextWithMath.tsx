import React, { useEffect, useRef, useState } from 'react';
import { MathJax } from 'better-react-mathjax';
import { getBlockTypeStyles, baseTextStyles, containerStyles } from './textStyles';
import { HTMLSanitizer } from '../../../../utils/htmlSanitizer';

interface TextWithMathProps {
  htmlContent: string;
  blockType: string;
  processedContent: string;
  onClickHighlight: (e: React.MouseEvent) => void;
  getBlockClassName?: (blockType?: string) => string;
  customStyle?: React.CSSProperties & { seamless?: boolean };
  onMathRendered?: () => void;
}

/**
 * TextWithMath renders HTML content with embedded LaTeX math.
 * It processes <math> tags and renders them using MathJax.
 */
const TextWithMath = React.forwardRef<HTMLDivElement, TextWithMathProps>(
  (
    {
      blockType,
      processedContent,
      onClickHighlight,
      getBlockClassName = () => '',
      customStyle,
      onMathRendered
    },
    ref
  ) => {
    const [processedMathContent, setProcessedMathContent] = useState('');
    const [mathRendered, setMathRendered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      // Process the content to convert <math> tags to MathJax format
      let content = processedContent;
      
      // Replace <math display="inline"> tags with \(...\)
      content = content.replace(/<math\s+display="inline">(.*?)<\/math>/g, (_, math) => {
        return `\\(${math}\\)`;
      });
      
      // Replace <math display="block"> or just <math> tags with \[...\]
      content = content.replace(/<math(?:\s+display="block")?>(.*?)<\/math>/g, (_, math) => {
        return `\\[${math}\\]`;
      });
      
      // Sanitize the content after math processing
      const sanitized = HTMLSanitizer.sanitizePDFContent(content);
      setProcessedMathContent(sanitized);
    }, [processedContent]);

    // Merge styles in order of precedence
    const mergedStyles = {
      ...(customStyle?.seamless ? {} : containerStyles),
      ...baseTextStyles,
      ...getBlockTypeStyles(blockType),
      ...customStyle,
    };

    // Handle MathJax rendering completion
    const handleMathRendered = () => {
      if (!mathRendered) {
        setMathRendered(true);
        // Small delay to ensure DOM is fully updated
        setTimeout(() => {
          if (onMathRendered) {
            onMathRendered();
          }
        }, 100);
      }
    };

    return (
      <div
        className={`text-renderer ${getBlockClassName(blockType)}`}
        ref={ref || containerRef}
        onClick={onClickHighlight}
        style={mergedStyles}
      >
        <MathJax 
          hideUntilTypeset="first"
          onTypeset={handleMathRendered}
        >
          <div dangerouslySetInnerHTML={{ __html: processedMathContent }} />
        </MathJax>
      </div>
    );
  }
);

TextWithMath.displayName = 'TextWithMath';

export default TextWithMath;