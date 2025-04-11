import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import TextSelectionTooltip from '../ui/TextSelectionTooltip';

export interface TextBlockProps {
  html_content: string;
  block_type: string;
  highlights: Array<{
    phrase: string;
    insight: string;
  }>;
  getBlockClassName?: (block_type?: string) => string;
  onAddTextToChat?: (text: string) => void;
}

export default function TextBlock({ 
  html_content, 
  block_type, 
  highlights, 
  getBlockClassName = () => '',
  onAddTextToChat
}: TextBlockProps) {
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [highlightRects, setHighlightRects] = useState<DOMRect[]>([]);
  const textBlockRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  // Process the content to add highlight spans
  const processContent = (content: string) => {
    let processedContent = content;
    
    highlights.forEach(highlight => {
      const regex = new RegExp(highlight.phrase, 'gi');
      processedContent = processedContent.replace(
        regex,
        `<span class="highlight-phrase" data-insight="${highlight.insight}">${highlight.phrase}</span>`
      );
    });

    return processedContent;
  };

  const handleHighlightClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('highlight-phrase')) {
      const insight = target.getAttribute('data-insight');
      setActiveInsight(insight);
    }
  };

  // Handle text selection
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !textBlockRef.current) {
        clearHighlightRects();
        return;
      }

      // Check if selection is within our component
      let node = selection.anchorNode;
      let isInComponent = false;
      while (node) {
        if (node === textBlockRef.current || textBlockRef.current.contains(node as Node)) {
          isInComponent = true;
          break;
        }
        node = node?.parentNode as Node | null;
      }

      if (!isInComponent) {
        setTooltipVisible(false);
        clearHighlightRects();
        return;
      }

      const text = selection.toString().trim();
      if (text) {
        setSelectedText(text);
        
        // Capture the selection range rects
        const range = selection.getRangeAt(0);
        const rects = Array.from(range.getClientRects());
        
        // Store the rectangles for rendering custom highlights
        setHighlightRects(rects);
        
        // Position the tooltip above the first rect
        if (rects.length > 0) {
          const firstRect = rects[0];
          const x = firstRect.left + firstRect.width / 2;
          const y = firstRect.top;
          setTooltipPosition({ x, y });
          setTooltipVisible(true);
        }
      } else {
        setTooltipVisible(false);
        clearHighlightRects();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (textBlockRef.current && !textBlockRef.current.contains(e.target as Node)) {
        setTooltipVisible(false);
        clearHighlightRects();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTooltipVisible(false);
        clearHighlightRects();
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      clearHighlightRects();
    };
  }, []);

  const clearHighlightRects = () => {
    setHighlightRects([]);
  };

  const handleAddToChat = (text: string) => {
    if (onAddTextToChat) {
      onAddTextToChat(text);
      setTooltipVisible(false);
      clearHighlightRects();
    }
  };

  // Render custom highlight elements based on the selection rects
  const renderHighlights = () => {
    if (!textBlockRef.current || highlightRects.length === 0) return null;
    
    // Get the container's position to calculate relative positions
    const containerRect = textBlockRef.current.getBoundingClientRect();
    
    return highlightRects.map((rect, index) => {
      // Convert client coordinates to positions relative to the container
      const left = rect.left - containerRect.left;
      const top = rect.top - containerRect.top;
      
      return (
        <div
          key={`highlight-${index}`}
          style={{
            position: 'absolute',
            left: `${left}px`,
            top: `${top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.4)',
            pointerEvents: 'none',
            // Set z-index below the text
            zIndex: 0,
            mixBlendMode: 'multiply'
          }}
        />
      );
    });
  };

  return (
    <div className="p-0 mb-0 relative" ref={textBlockRef}>      
      <div className="relative">
        <div
          className={`p-4 bg-slate-50 text-slate-900 rounded-md border-l-4 border-l-indigo-500 border-t border-r border-b border-slate-200 font-reading leading-relaxed shadow-md ${getBlockClassName(block_type)}`}
          onClick={handleHighlightClick}
          dangerouslySetInnerHTML={{ 
            __html: processContent(html_content)
          }}
        />
        {/* Custom highlight overlay - positioned after text to allow selection */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" ref={highlightLayerRef}>
          {renderHighlights()}
        </div>

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

        {/* Text selection tooltip */}
        <TextSelectionTooltip
          isVisible={tooltipVisible}
          position={tooltipPosition}
          selectedText={selectedText}
          onAddToChat={handleAddToChat}
          onClose={() => {
            setTooltipVisible(false);
            clearHighlightRects();
          }}
        />
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
          font-size: 0.95rem;
          line-height: 1.65;
          color: #1e293b;
        }
        
        /* Enhance headings */
        .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
          color: #1e293b;
          font-weight: 600;
          margin-top: 1.25em;
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
          font-size: 0.95rem;
          line-height: 1.65;
        }
        
        /* Add paragraph styling */
        .font-reading p {
          margin-bottom: 1em;
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
          margin-bottom: 1em;
        }
        
        .font-reading li {
          margin-bottom: 0.4em;
        }
        
        /* Add code styling */
        .font-reading code {
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          background-color: rgba(0, 0, 0, 0.05);
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
}
