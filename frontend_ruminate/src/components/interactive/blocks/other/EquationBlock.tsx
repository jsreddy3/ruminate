import React, { useEffect, useRef } from "react";

interface EquationBlockProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function EquationBlock({ html_content, block_type, getBlockClassName }: EquationBlockProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  const processEquation = (content: string) => {
    // Remove the outer <p> tag and its attributes
    const innerContent = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/, '$1');
    
    // Extract the LaTeX from the math tag and wrap it in display math delimiters
    return innerContent.replace(/<math[^>]*>([\s\S]*?)<\/math>/, (_, math) => {
      return `\\[${math}\\]`;
    });
  };

  const processedContent = (() => {
    const raw = processEquation(html_content);
    const normalizeMicroInTeX = (tex: string) => tex.replace(/[\u00B5\u03BC]/g, '\\mu');
    return raw
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `\\(${normalizeMicroInTeX(inner)}\\)`)
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\\[${normalizeMicroInTeX(inner)}\\]`);
  })();
  
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
    <div className="p-4 border-b border-neutral-200 bg-white">
      <div className={`p-3 bg-neutral-50 text-neutral-800 rounded-lg border border-neutral-200 shadow-sm prose max-w-none ${getBlockClassName(block_type)}`}>
        <div className="overflow-x-auto">
          <div
            className="min-w-0 w-full"
            style={{ overflowX: 'auto', overflowY: 'hidden', display: 'block' }}
            ref={hostRef}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        </div>
      </div>
    </div>
  );
}
