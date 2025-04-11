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
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const textBlockRef = useRef<HTMLDivElement>(null);

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
        return;
      }

      const text = selection.toString().trim();
      if (text) {
        setSelectedText(text);
        
        // Store the selection range to apply custom highlighting
        const range = selection.getRangeAt(0);
        setSelectionRange(range.cloneRange());
        
        const rect = range.getBoundingClientRect();
        
        // Calculate position relative to the viewport
        const x = rect.left + rect.width / 2;
        const y = rect.top;
        
        setTooltipPosition({ x, y });
        setTooltipVisible(true);

        // Apply custom highlighting
        applyCustomHighlight(range);
      } else {
        clearCustomHighlight();
        setTooltipVisible(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (textBlockRef.current && !textBlockRef.current.contains(e.target as Node)) {
        clearCustomHighlight();
        setTooltipVisible(false);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('mousedown', handleClickOutside);
      clearCustomHighlight();
    };
  }, []);

  // Apply custom highlight to selected text
  const applyCustomHighlight = (range: Range) => {
    // If there's an existing highlight, clear it first
    clearCustomHighlight();
    
    try {
      // Log for debugging
      console.log('Applying custom highlight to:', range.toString());
      
      // Create a unique ID for this highlight
      const highlightId = `selection-highlight-${Date.now()}`;
      
      // Create a span element to wrap the selection
      const span = document.createElement('span');
      span.id = highlightId;
      span.className = 'custom-text-selection';
      
      // Attempt to surround the contents - this can fail with complex HTML
      try {
        // Clone range to avoid modifying the selection
        const clonedRange = range.cloneRange();
        
        // Attempt to surround the selection with our span
        clonedRange.surroundContents(span);
        
        // Store the ID so we can find and remove it later
        span.dataset.highlightId = highlightId;
        
        console.log('Successfully applied highlight with ID:', highlightId);
      } catch (e) {
        console.error('Error wrapping selection:', e);
        
        // Fallback method - CSS-only approach
        document.documentElement.classList.add('showing-selection');
        console.log('Using CSS fallback for selection highlight');
      }
    } catch (e) {
      console.error('Error in applyCustomHighlight:', e);
    }
  };

  // Clear custom highlighting
  const clearCustomHighlight = () => {
    try {
      console.log('Clearing custom highlights');
      
      // Find and remove any existing custom highlights
      const highlights = document.getElementsByClassName('custom-text-selection');
      console.log('Found highlights to clear:', highlights.length);
      
      while (highlights.length > 0) {
        const highlight = highlights[0];
        const parent = highlight.parentNode;
        
        if (parent) {
          // Move all children out of the highlight span
          while (highlight.firstChild) {
            parent.insertBefore(highlight.firstChild, highlight);
          }
          // Remove the empty highlight span
          parent.removeChild(highlight);
        }
      }
      
      // Remove CSS fallback class
      document.documentElement.classList.remove('showing-selection');
      
      setSelectionRange(null);
    } catch (e) {
      console.error('Error in clearCustomHighlight:', e);
    }
  };

  const handleAddToChat = (text: string) => {
    if (onAddTextToChat) {
      onAddTextToChat(text);
      clearCustomHighlight();
      setTooltipVisible(false);
    }
  };

  return (
    <div className="p-0 mb-0" ref={textBlockRef}>      
      <div className="relative">
        <div
          className={`p-4 bg-slate-50 text-slate-900 rounded-md border-l-4 border-l-indigo-500 border-t border-r border-b border-slate-200 font-reading leading-relaxed shadow-md ${getBlockClassName(block_type)}`}
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

        {/* Text selection tooltip */}
        <TextSelectionTooltip
          isVisible={tooltipVisible}
          position={tooltipPosition}
          selectedText={selectedText}
          onAddToChat={handleAddToChat}
          onClose={() => setTooltipVisible(false)}
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
        
        /* Custom selection highlight */
        .custom-text-selection {
          background-color: rgba(99, 102, 241, 0.12) !important;
          border-radius: 2px !important;
          box-shadow: 0 1px 0 rgba(99, 102, 241, 0.4) !important;
        }
        
        /* CSS fallback selection highlight that preserves browser selection */
        html.showing-selection ::selection {
          background-color: rgba(99, 102, 241, 0.25) !important;
          color: inherit !important;
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
