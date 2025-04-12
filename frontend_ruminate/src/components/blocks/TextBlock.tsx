import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import TextSelectionTooltip from '../ui/TextSelectionTooltip';
import DefinitionTooltip from '../ui/DefinitionTooltip';
import { getRabbitholesByBlock, RabbitholeHighlight } from '../../services/rabbithole';

export interface TextBlockProps {
  html_content: string;
  block_type: string;
  block_id: string;
  highlights: Array<{
    phrase: string;
    insight: string;
  }>;
  getBlockClassName?: (block_type?: string) => string;
  onAddTextToChat?: (text: string) => void;
  onRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
}

export default function TextBlock({ 
  html_content, 
  block_type, 
  block_id, 
  highlights, 
  getBlockClassName = () => '',
  onAddTextToChat,
  onRabbithole
}: TextBlockProps) {
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const [definitionVisible, setDefinitionVisible] = useState<boolean>(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [highlightRects, setHighlightRects] = useState<DOMRect[]>([]);
  const [selectionOffsets, setSelectionOffsets] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const textBlockRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const definitionTooltipRef = useRef<HTMLDivElement>(null);
  
  // Add state for rabbithole highlights
  const [rabbitholeHighlights, setRabbitholeHighlights] = useState<RabbitholeHighlight[]>([]);
  const [isLoadingRabbitholes, setIsLoadingRabbitholes] = useState<boolean>(false);

  // Fetch rabbithole highlights when block changes
  useEffect(() => {
    async function fetchRabbitholeHighlights() {
      if (block_id) {
        setIsLoadingRabbitholes(true);
        try {
          const highlights = await getRabbitholesByBlock(block_id);
          setRabbitholeHighlights(highlights);
        } catch (error) {
          console.error('Failed to fetch rabbithole highlights:', error);
        } finally {
          setIsLoadingRabbitholes(false);
        }
      }
    }

    fetchRabbitholeHighlights();
  }, [block_id]);

  // Simplified approach: Use regex to find and highlight text
  const renderContentWithHighlights = () => {
    let content = html_content;
    
    // First apply regular highlights
    highlights.forEach(highlight => {
      const regex = new RegExp(escapeRegExp(highlight.phrase), 'gi');
      content = content.replace(
        regex,
        `<span class="highlight-phrase" data-insight="${highlight.insight}">${highlight.phrase}</span>`
      );
    });
    
    // Then apply rabbithole highlights, but with unique identifiers
    rabbitholeHighlights.forEach((rh, index) => {
      const uniqueId = `rabbithole-${rh.id.replace(/[^a-zA-Z0-9]/g, '')}-${index}`;
      // We'll add a special marker with the unique ID
      content = content.replace(
        escapeRegExp(rh.selected_text),
        `<span class="rabbithole-highlight" data-rabbithole-id="${rh.id}" id="${uniqueId}">${rh.selected_text}</span>`
      );
    });
    
    return content;
  };
  
  // Helper to escape special regex characters
  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  // After render, attach click handlers directly to the elements
  useEffect(() => {
    if (!textBlockRef.current) return;
    
    // More aggressive debugging
    console.log("HTML content:", textBlockRef.current.innerHTML);
    
    // Find all rabbithole highlights and attach click handlers
    const highlights = textBlockRef.current.querySelectorAll('.rabbithole-highlight');
    
    console.log("Highlight elements found:", highlights.length);
    highlights.forEach((el, i) => {
      console.log(`Highlight ${i}:`, {
        id: el.getAttribute('data-rabbithole-id'),
        text: el.textContent,
        hasListeners: el.hasAttribute('data-has-listener')
      });
      
      // Mark element so we don't double-attach
      if (!el.hasAttribute('data-has-listener')) {
        // Make the highlight visibly clickable
        el.setAttribute('style', 'cursor: pointer; background-color: rgba(79, 70, 229, 0.2); border-bottom: 2px solid rgba(79, 70, 229, 0.4); padding: 2px; display: inline-block;');
        el.setAttribute('data-has-listener', 'true');
        
        // Add multiple event types for testing
        ['click', 'mousedown', 'touchstart'].forEach(eventType => {
          el.addEventListener(eventType, (e) => {
            console.log(`${eventType} detected on rabbithole highlight!`);
            e.preventDefault();
            e.stopPropagation();
            
            const element = e.currentTarget as HTMLElement;
            const id = element.getAttribute('data-rabbithole-id');
            console.log('Event triggered with id:', id);
            
            if (id && onRabbithole) {
              console.log('Looking for highlight with id:', id);
              console.log('Available highlights:', rabbitholeHighlights);
              const highlight = rabbitholeHighlights.find(rh => rh.id === id);
              if (highlight) {
                console.log('Found highlight, calling onRabbithole with:', highlight);
                onRabbithole(highlight.selected_text, highlight.text_start_offset, highlight.text_end_offset);
              } else {
                console.error('Could not find highlight with id:', id);
              }
            }
          });
        });
      }
    });
    
    // Also add a global click handler for testing
    const handleGlobalClick = (e: MouseEvent) => {
      console.log('Global click detected on:', e.target);
      // Check if the target or any parent has the rabbithole-highlight class
      let el = e.target as HTMLElement | null;
      while (el) {
        if (el.classList?.contains('rabbithole-highlight')) {
          console.log('Found rabbithole highlight in click path!');
          break;
        }
        el = el.parentElement;
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    
    // Debug log
    console.log(`Attached ${highlights.length} rabbithole highlight click handlers`);
    
    // Cleanup event listeners on unmount
    return () => {
      highlights.forEach(el => {
        ['click', 'mousedown', 'touchstart'].forEach(eventType => {
          el.removeEventListener(eventType, () => {});
        });
      });
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [rabbitholeHighlights, onRabbithole, html_content]);

  const handleHighlightClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if clicked element is a highlight or if any parent element is a highlight
    let currentElement: HTMLElement | null = target;
    let highlightElement: HTMLElement | null = null;
    let insightElement: HTMLElement | null = null;
    
    // Traverse up to find highlight elements
    while (currentElement && !highlightElement) {
      if (currentElement.classList?.contains('highlight-phrase')) {
        insightElement = currentElement;
      } else if (currentElement.classList?.contains('rabbithole-highlight')) {
        highlightElement = currentElement;
      }
      currentElement = currentElement.parentElement;
    }
    
    // Handle insight highlight click
    if (insightElement) {
      const insight = insightElement.getAttribute('data-insight');
      setActiveInsight(insight);
      e.preventDefault();
      e.stopPropagation();
      return;
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
        
        // Store the selection offsets
        setSelectionOffsets({ start: range.startOffset, end: range.endOffset });
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
    }
    setTooltipVisible(false);
    clearHighlightRects();
  };

  const handleDefine = (text: string) => {
    setSelectedText(text);
    setDefinitionVisible(true);
    setTooltipVisible(false);
  };

  const handleRabbithole = (text: string) => {
    if (onRabbithole) {
      onRabbithole(text, selectionOffsets.start, selectionOffsets.end);
    }
    setTooltipVisible(false);
    clearHighlightRects();
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
    <div className="p-0 mb-0 relative">      
      <div className="relative">
        <div
          className={`p-4 bg-slate-50 text-slate-900 rounded-md border-l-4 border-l-indigo-500 border-t border-r border-b border-slate-200 font-reading leading-relaxed shadow-md ${getBlockClassName(block_type)}`}
          ref={textBlockRef}
          dangerouslySetInnerHTML={{ 
            __html: renderContentWithHighlights()
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

        {/* Selection tooltip or definition tooltip */}
        {tooltipVisible ? (
          <TextSelectionTooltip
            isVisible={true}
            position={tooltipPosition}
            selectedText={selectedText}
            onAddToChat={handleAddToChat}
            onDefine={handleDefine}
            onRabbithole={handleRabbithole}
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
        
        .rabbithole-highlight {
          background-color: rgba(121, 134, 203, 0.2);
          border-bottom: 2px solid rgba(79, 70, 229, 0.4);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .rabbithole-highlight:hover {
          background-color: rgba(121, 134, 203, 0.4);
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
