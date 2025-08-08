import React, { useEffect, useRef } from "react";
import { baseTextStyles, containerStyles } from '../text/textStyles';

interface MathBlockProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function MathBlock({ html_content, block_type, getBlockClassName }: MathBlockProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  const processInlineMath = (content: string) => {
    // First remove the outer <p> tag and its attributes
    const innerContent = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/, '$1');
    
    // Handle both <i>...</i> and <math>...</math> tags
    let result = innerContent;
    
    // First, replace <math display="inline">...</math> with \(...\)
    result = result.replace(/<math\s+display="inline"[^>]*>([\s\S]*?)<\/math>/g, (_, math) => {
      return `\\(${math}\\)`;
    });
    
    // Replace <math display="block">...</math> with \[...\]
    result = result.replace(/<math\s+display="block"[^>]*>([\s\S]*?)<\/math>/g, (_, math) => {
      return `\\[${math}\\]`;
    });
    
    // Also handle generic <math>...</math> as inline
    result = result.replace(/<math[^>]*>([\s\S]*?)<\/math>/g, (_, math) => {
      return `\\(${math}\\)`;
    });
    
    // Then handle legacy <i>...</i> format
    result = result.replace(/<i>([\s\S]*?)<\/i>/g, (_, math) => {
      const isInline = /\w+\s*<i>|<\/i>\s*\w+/.test(innerContent);
      return isInline ? `\\(${math}\\)` : `\\[${math}\\]`;
    });
    
    return result;
  };

  const processedContent = (() => {
    const raw = processInlineMath(html_content);
    const normalizeMicroInTeX = (tex: string) => tex.replace(/[\u00B5\u03BC]/g, '\\mu');
    return raw
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `\\(${normalizeMicroInTeX(inner)}\\)`)
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\\[${normalizeMicroInTeX(inner)}\\]`);
  })();
  
  const mergedStyles = {
    ...containerStyles,
    ...baseTextStyles,
  };

  useEffect(() => {
    let raf = 0;
    raf = requestAnimationFrame(async () => {
      try {
        if (!hostRef.current) return;
        const mod = await import('katex/contrib/auto-render');
        const renderMathInElement = (mod as any).default || (mod as any);
        renderMathInElement(hostRef.current, {
          delimiters: [
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
          macros: {
            "\\ul": "\\,\\mathrm{ul}",
            "\\uL": "\\,\\mathrm{\u03BCL}",
          }
        });
      } catch (e) {
        // noop
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [processedContent]);

  return (
    <div 
      className={`text-renderer ${getBlockClassName(block_type)}`}
      style={mergedStyles}
      ref={hostRef}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}
