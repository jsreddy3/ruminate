import { MathJax } from "better-react-mathjax";
import { baseTextStyles, containerStyles } from '../text/textStyles';

interface MathBlockProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function MathBlock({ html_content, block_type, getBlockClassName }: MathBlockProps) {
  
  const processInlineMath = (content: string) => {
    // First remove the outer <p> tag and its attributes
    const innerContent = content.replace(/<p[^>]*>(.*?)<\/p>/s, '$1');
    
    // Handle both <i>...</i> and <math>...</math> tags
    let result = innerContent;
    
    // First, replace <math display="inline">...</math> with \(...\)
    result = result.replace(/<math\s+display="inline"[^>]*>(.*?)<\/math>/g, (_, math) => {
      return `\\(${math}\\)`;
    });
    
    // Replace <math display="block">...</math> with \[...\]
    result = result.replace(/<math\s+display="block"[^>]*>(.*?)<\/math>/g, (_, math) => {
      return `\\[${math}\\]`;
    });
    
    // Also handle generic <math>...</math> as inline
    result = result.replace(/<math[^>]*>(.*?)<\/math>/g, (_, math) => {
      return `\\(${math}\\)`;
    });
    
    // Then handle legacy <i>...</i> format
    result = result.replace(/<i>(.*?)<\/i>/g, (_, math) => {
      const isInline = /\w+\s*<i>|<\/i>\s*\w+/.test(innerContent);
      return isInline ? `\\(${math}\\)` : `\\[${math}\\]`;
    });
    
    return result;
  };

  const isInlineContext = /\w+\s*<i>|<\/i>\s*\w+/.test(html_content);
  const processedContent = processInlineMath(html_content);
  
  const mergedStyles = {
    ...containerStyles,
    ...baseTextStyles,
  };

  return (
    <div 
      className={`text-renderer ${getBlockClassName(block_type)}`}
      style={mergedStyles}
    >
      <MathJax
        hideUntilTypeset={"first"}
        inline={isInlineContext}
      >
        {processedContent}
      </MathJax>
    </div>
  );
}
