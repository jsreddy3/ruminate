import { MathJax } from "better-react-mathjax";

interface MathBlockProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function MathBlock({ html_content, block_type, getBlockClassName }: MathBlockProps) {
  const processInlineMath = (content: string) => {
    // First remove the outer <p> tag and its attributes
    const innerContent = content.replace(/<p[^>]*>(.*?)<\/p>/s, '$1');
    
    // Then replace <i>...</i> with \(...\) for inline math
    return innerContent.replace(/<i>(.*?)<\/i>/g, (_, math) => {
      // If the math is part of a sentence (has text before/after), use inline
      const isInline = /\w+\s*<i>|<\/i>\s*\w+/.test(innerContent);
      return isInline ? `\\(${math}\\)` : `\\[${math}\\]`;
    });
  };

  const isInlineContext = /\w+\s*<i>|<\/i>\s*\w+/.test(html_content);
  const processedContent = processInlineMath(html_content);
  
  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      <div className={`p-3 bg-neutral-50 text-neutral-800 rounded-lg border border-neutral-200 shadow-sm prose max-w-none ${getBlockClassName(block_type)}`}>
        <MathJax
          hideUntilTypeset={"first"}
          inline={isInlineContext}
        >
          {processedContent}
        </MathJax>
      </div>
    </div>
  );
}
