import React, { useState } from 'react';
import { X } from 'lucide-react';

interface TextBlockProps {
  html_content: string;
  block_type: string;
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  getBlockClassName: (block_type?: string) => string;
}

export default function TextBlock({ html_content, block_type, highlights = [], getBlockClassName }: TextBlockProps) {
  const [activeInsight, setActiveInsight] = useState<string | null>(null);

  // Function to wrap highlighted phrases with interactive spans
  const processContent = (content: string) => {
    if (!highlights.length) return content;

    let processedContent = content;
    highlights.forEach(({ phrase }) => {
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedPhrase})`, 'gi');
      processedContent = processedContent.replace(
        regex,
        `<span class="highlight-phrase" data-phrase="${phrase}">${phrase}</span>`
      );
    });
    return processedContent;
  };

  // Handle click on highlighted phrase
  const handleHighlightClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('highlight-phrase')) {
      const phrase = target.getAttribute('data-phrase');
      const highlight = highlights.find(h => h.phrase === phrase);
      if (highlight) {
        setActiveInsight(highlight.insight);
      }
    }
  };

  return (
    <div className="p-0 mb-0">      
      <div className="relative">
        <div
          className={`p-5 bg-slate-50 text-slate-900 rounded-md border-l-4 border-l-indigo-500 border-t border-r border-b border-slate-200 font-reading leading-relaxed shadow-md ${getBlockClassName(block_type)}`}
          onClick={handleHighlightClick}
          dangerouslySetInnerHTML={{ 
            __html: processContent(html_content)
          }}
        />

        {activeInsight && (
          <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white rounded-lg border border-neutral-200 shadow-lg z-10">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1">{activeInsight}</div>
              <button
                onClick={() => setActiveInsight(null)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .highlight-phrase {
          background-color: rgba(255, 243, 141, 0.3);
          border-bottom: 2px solid rgba(255, 220, 0, 0.5);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .highlight-phrase:hover {
          background-color: rgba(255, 243, 141, 0.5);
        }
        
        /* Improve text readability */
        .prose {
          font-size: 1.05rem;
          line-height: 1.75;
          color: #1e293b;
        }
        
        /* Enhance headings */
        .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
          color: #1e293b;
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-family: 'Georgia', serif;
        }
        
        /* Style block quotes */
        .prose blockquote {
          border-left: 3px solid #6366f1;
          padding-left: 1rem;
          font-style: italic;
          color: #4a5568;
          background-color: rgba(99, 102, 241, 0.05);
          padding: 0.5rem 1rem;
          margin: 1rem 0;
        }
        
        /* Add custom font classes */
        .font-reading {
          font-family: 'Georgia', serif;
          font-size: 1.05rem;
          line-height: 1.75;
        }
        
        /* Add paragraph styling */
        .font-reading p {
          margin-bottom: 1.2em;
          color: #1e293b;
        }
        
        /* Add link styling */
        .font-reading a {
          color: #4f46e5;
          text-decoration: underline;
          text-decoration-thickness: 0.05em;
          text-underline-offset: 0.15em;
        }
        
        /* Add list styling */
        .font-reading ul, .font-reading ol {
          padding-left: 1.5rem;
          margin-bottom: 1.2em;
        }
        
        .font-reading li {
          margin-bottom: 0.5em;
        }
        
        /* Add code styling */
        .font-reading code {
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          background-color: rgba(0, 0, 0, 0.05);
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
}
