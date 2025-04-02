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
    <div className="p-4 border-b border-neutral-200 bg-white">      
      <div className="relative">
        <div
          className={`p-3 bg-neutral-50 text-neutral-800 rounded-lg border border-neutral-200 shadow-sm prose max-w-none ${getBlockClassName(block_type)}`}
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
      `}</style>
    </div>
  );
}
