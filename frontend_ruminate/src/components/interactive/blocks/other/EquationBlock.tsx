import { MathJax } from "better-react-mathjax";

interface EquationBlockProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function EquationBlock({ html_content, block_type, getBlockClassName }: EquationBlockProps) {
  const processEquation = (content: string) => {
    // Remove the outer <p> tag and its attributes
    const innerContent = content.replace(/<p[^>]*>(.*?)<\/p>/s, '$1');
    
    // Extract the LaTeX from the math tag and wrap it in display math delimiters
    return innerContent.replace(/<math[^>]*>(.*?)<\/math>/s, (_, math) => {
      return `\\[${math}\\]`;
    });
  };

  const processedContent = processEquation(html_content);
  
  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      <div className={`p-3 bg-neutral-50 text-neutral-800 rounded-lg border border-neutral-200 shadow-sm prose max-w-none ${getBlockClassName(block_type)}`}>
        <div className="overflow-x-auto">
          <MathJax
            hideUntilTypeset={"first"}
            inline={false}
            className="min-w-0 w-full"
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              display: 'block',
            }}
          >
            {processedContent}
          </MathJax>
        </div>
      </div>
    </div>
  );
}
