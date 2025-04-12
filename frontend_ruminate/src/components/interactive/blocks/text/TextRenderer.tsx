import React, { useState, useEffect, useRef } from 'react';
import { RabbitholeHighlight } from '../../../../services/rabbithole';
import TextSelectionTooltip from './tooltip/TextSelectionTooltip';
// Replace with local implementation since we couldn't find the original component
const DefinitionTooltip = ({ isVisible, position, term, onClose }: {
  isVisible: boolean;
  position: { x: number, y: number };
  term: string;
  onClose: () => void;
}) => {
  if (!isVisible) return null;
  
  return (
    <div 
      className="absolute z-50 bg-white rounded-md shadow-lg p-2 border border-neutral-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 10}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="p-3 max-w-md">
        <div className="flex justify-between mb-2">
          <h3 className="font-medium">Definition</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            ×
          </button>
        </div>
        <p className="text-sm">
          Loading definition for "{term}"...
        </p>
      </div>
    </div>
  );
};

interface TextRendererProps {
  htmlContent: string;
  blockType: string;
  blockId: string;
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  rabbitholeHighlights?: RabbitholeHighlight[];
  onAddTextToChat?: (text: string) => void;
}

/**
 * TextRenderer handles rendering text content and highlights.
 * It also manages text selection and tooltips.
 */
export default function TextRenderer({ 
  htmlContent, 
  blockType, 
  blockId, 
  highlights = [], 
  rabbitholeHighlights = [],
  onAddTextToChat
}: TextRendererProps) {
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const [definitionVisible, setDefinitionVisible] = useState<boolean>(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [highlightRects, setHighlightRects] = useState<DOMRect[]>([]);
  const textBlockRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  
  // Process content to add highlight spans
  const processContent = (content: string) => {
    let processedContent = content;
    
    // Add regular highlights
    highlights.forEach(highlight => {
      const regex = new RegExp(escapeRegExp(highlight.phrase), 'gi');
      processedContent = processedContent.replace(
        regex,
        `<span class="highlight-phrase" data-insight="${highlight.insight}">${highlight.phrase}</span>`
      );
    });
    
    // Add rabbithole highlights
    rabbitholeHighlights.forEach(highlight => {
      const escapedText = escapeRegExp(highlight.selected_text);
      const regex = new RegExp(escapedText, 'g');
      
      processedContent = processedContent.replace(
        regex,
        `<span class="rabbithole-highlight" data-rabbithole-id="${highlight.conversation_id}">${highlight.selected_text}</span>`
      );
    });
    
    return processedContent;
  };
  
  // Helper to escape RegExp special characters
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Clear highlight rects
  const clearHighlightRects = () => {
    setHighlightRects([]);
  };

  // Handle adding text to chat
  const handleAddToChat = (text: string) => {
    if (onAddTextToChat) {
      onAddTextToChat(text);
    }
    setTooltipVisible(false);
    clearHighlightRects();
  };

  // Handle defining a term
  const handleDefine = (text: string) => {
    setSelectedText(text);
    setDefinitionVisible(true);
    setTooltipVisible(false);
  };

  // Set up selection and click handlers
  useEffect(() => {
    // Handle text selection
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !textBlockRef.current) {
        setTooltipVisible(false);
        clearHighlightRects();
        return;
      }

      // Check if selection is within this component
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

      // Get selected text and position
      const text = selection.toString().trim();
      if (text) {
        setSelectedText(text);
        
        const range = selection.getRangeAt(0);
        const rects = Array.from(range.getClientRects());
        
        setHighlightRects(rects);
        
        if (rects.length > 0) {
          const firstRect = rects[0];
          const x = firstRect.left + firstRect.width / 2;
          const y = firstRect.top;
          setTooltipPosition({ x, y });
          setTooltipVisible(true);
        }
      }
    };

    // Handle clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (textBlockRef.current && !textBlockRef.current.contains(e.target as Node)) {
        setTooltipVisible(false);
        setDefinitionVisible(false);
        clearHighlightRects();
      }
    };

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTooltipVisible(false);
        setDefinitionVisible(false);
        clearHighlightRects();
      }
    };

    // Add event listeners
    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle clicking on highlights
  const handleHighlightClick = (e: React.MouseEvent) => {
    // Handle clicking on phrase highlights
    if ((e.target as HTMLElement).classList.contains('highlight-phrase')) {
      const insight = (e.target as HTMLElement).getAttribute('data-insight');
      if (insight) {
        setActiveInsight(insight);
      }
    } 
    // Handle clicking on rabbithole highlights
    else if ((e.target as HTMLElement).classList.contains('rabbithole-highlight')) {
      const rabbitholeId = (e.target as HTMLElement).getAttribute('data-rabbithole-id');
      if (rabbitholeId) {
        // Here we could trigger opening a rabbithole conversation
        console.log(`Open rabbithole conversation: ${rabbitholeId}`);
      }
    } else {
      setActiveInsight(null);
    }
  };

  // Render selection highlight rects
  const renderHighlights = () => {
    if (highlightRects.length === 0) return null;
    
    return highlightRects.map((rect, index) => {
      const style = {
        position: 'absolute' as const,
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        borderRadius: '1px',
        pointerEvents: 'none' as const,
        zIndex: 5
      };
      
      return <div key={index} style={style} />;
    });
  };

  return (
    <div className="relative">
      <div 
        className={`p-4 bg-slate-50 text-slate-900 rounded-md border-l-4 border-l-indigo-500 border-t border-r border-b border-slate-200 font-reading leading-relaxed shadow-md`}
        ref={textBlockRef}
        onClick={handleHighlightClick}
        dangerouslySetInnerHTML={{ 
          __html: processContent(htmlContent)
        }}
      />
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
              ×
            </button>
          </div>
        </div>
      )}

      {tooltipVisible ? (
        <TextSelectionTooltip
          isVisible={true}
          position={tooltipPosition}
          selectedText={selectedText}
          onAddToChat={handleAddToChat}
          onDefine={handleDefine}
          onClose={() => {
            setTooltipVisible(false);
            clearHighlightRects();
          }}
        />
      ) : (
        <DefinitionTooltip
          isVisible={definitionVisible}
          position={tooltipPosition}
          term={selectedText}
          onClose={() => {
            setDefinitionVisible(false);
            clearHighlightRects();
          }}
        />
      )}

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
        
        .rabbithole-highlight {
          background-color: rgba(121, 134, 203, 0.2);
          border-bottom: 2px solid rgba(79, 70, 229, 0.4);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .rabbithole-highlight:hover {
          background-color: rgba(121, 134, 203, 0.4);
        }

        .font-reading {
          font-family: 'Georgia', serif;
          font-size: 0.95rem;
          line-height: 1.65;
        }
        
        .font-reading p {
          margin-bottom: 1em;
          color: #1e293b;
        }
      `}</style>
    </div>
  );
}
