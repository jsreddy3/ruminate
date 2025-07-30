import React, { useState, useEffect, useRef } from 'react';
import { RabbitholeHighlight as RabbitholeHighlightType } from '../../../../../services/rabbithole';
import './RabbitholeHighlight.css';

interface ReactRabbitholeHighlightProps {
  contentRef: React.RefObject<HTMLElement>;
  highlights: RabbitholeHighlightType[];
  onHighlightClick: (id: string, text: string, start: number, end: number) => void;
  definitions?: { [key: string]: any }; // To check for overlaps
}

/**
 * Renders rabbithole highlights as React components
 * Uses text offsets to create properly positioned highlights
 */
const ReactRabbitholeHighlight: React.FC<ReactRabbitholeHighlightProps> = ({
  contentRef,
  highlights,
  onHighlightClick,
  definitions
}) => {
  const [highlightElements, setHighlightElements] = useState<React.ReactNode[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Helper function to find text position from character offset
  const findTextPositionFromOffset = (
    root: HTMLElement, 
    startOffset: number, 
    endOffset: number
  ): DOMRect[] | null => {
    // Gather all text nodes in order
    const textNodes: Node[] = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    if (textNodes.length === 0) return null;
    
    // Find start and end positions
    let currentOffset = 0;
    let startNode: Node | null = null;
    let startNodeOffset = 0;
    let endNode: Node | null = null;
    let endNodeOffset = 0;
    
    // Find start and end nodes based on character offsets
    for (const node of textNodes) {
      const nodeLength = node.textContent?.length || 0;
      
      // Find start node and offset
      if (startNode === null && currentOffset + nodeLength > startOffset) {
        startNode = node;
        startNodeOffset = startOffset - currentOffset;
      }
      
      // Find end node and offset
      if (endNode === null && currentOffset + nodeLength >= endOffset) {
        endNode = node;
        endNodeOffset = endOffset - currentOffset;
        break;
      }
      
      currentOffset += nodeLength;
    }
    
    // If we found start and end nodes, create a range
    if (startNode && endNode) {
      try {
        const range = document.createRange();
        range.setStart(startNode, startNodeOffset);
        range.setEnd(endNode, endNodeOffset);
        
        // Get client rects of the range
        return Array.from(range.getClientRects());
      } catch (err) {
        console.error('Error creating range:', err);
        return null;
      }
    }
    
    return null;
  };
  
  // Calculate and render highlights when content or highlights change
  useEffect(() => {
    if (!contentRef.current || !highlights?.length) {
      setHighlightElements([]);
      return;
    }
    
    // Get container position for coordinate adjustment
    const contentRect = contentRef.current.getBoundingClientRect();
    
    // Process each highlight
    const newElements = highlights.map((highlight, index) => {
      const { id, selected_text, text_start_offset, text_end_offset, conversation_id } = highlight;
      
      // Get positioned rectangles for this text range
      const rects = findTextPositionFromOffset(
        contentRef.current as HTMLElement,
        text_start_offset,
        text_end_offset
      );
      
      if (!rects || rects.length === 0) {
        return null;
      }
      
      // Check if this rabbithole overlaps with any definition
      const hasOverlappingDefinition = definitions && Object.values(definitions).some((def: any) => {
        return (
          (text_start_offset >= def.text_start_offset && text_start_offset < def.text_end_offset) ||
          (text_end_offset > def.text_start_offset && text_end_offset <= def.text_end_offset) ||
          (text_start_offset <= def.text_start_offset && text_end_offset >= def.text_end_offset)
        );
      });

      // Create a highlight element for each rect
      return rects.map((rect, rectIndex) => {
        // Convert coordinates to be relative to the container
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${rect.left - contentRect.left}px`,
          top: `${rect.top - contentRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`, // Keep original height
          backgroundColor: 'transparent',
          borderBottom: '1.5px solid rgba(99, 102, 241, 0.8)', // Always show at bottom
          borderRadius: '0px',
          cursor: 'pointer',
          zIndex: 7,
          boxShadow: 'none',
          pointerEvents: 'none', // Allow text selection through the highlight
        };
        
        // Create a clickable area that's always at the bottom
        const clickableStyle: React.CSSProperties = {
          position: 'absolute',
          left: `${rect.left - contentRect.left}px`,
          top: `${rect.top - contentRect.top + rect.height - 8}px`, // Always at bottom
          width: `${rect.width}px`,
          height: '8px', // Thin clickable area
          cursor: 'pointer',
          zIndex: 8,
          pointerEvents: 'auto',
          // Uncomment to debug clickable area:
          // backgroundColor: 'rgba(255, 0, 0, 0.2)',
        };
        
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          
          // Use the id field as the conversation_id if conversation_id is undefined
          // This fixes a naming mismatch between frontend and backend
          const effectiveConversationId = conversation_id || id;
          
          onHighlightClick(effectiveConversationId, selected_text, text_start_offset, text_end_offset);
        };
        
        return (
          <React.Fragment key={`rabbithole-${id}-${rectIndex}`}>
            {/* Visual highlight - not clickable */}
            <div
              className="rabbithole-highlight-visual"
              style={style}
            />
            {/* Clickable area - just at the bottom */}
            <div
              className="rabbithole-highlight-clickable"
              style={clickableStyle}
              onClick={handleClick}
              title={`Click to open rabbithole conversation: ${selected_text.length > 30 ? selected_text.substring(0, 30) + '...' : selected_text}`}
              onMouseEnter={(e) => {
                // Add hover effect to visual highlight
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.borderBottomWidth = '2px';
                  visual.style.borderBottomColor = 'rgba(99, 102, 241, 1)';
                }
              }}
              onMouseLeave={(e) => {
                // Remove hover effect
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.borderBottomWidth = '1.5px';
                  visual.style.borderBottomColor = 'rgba(99, 102, 241, 0.8)';
                }
              }}
            />
          </React.Fragment>
        );
      });
    })
    .filter(Boolean)
    .flat();
    
    setHighlightElements(newElements as React.ReactNode[]);
  }, [highlights, contentRef, onHighlightClick, definitions]);
  
  return (
    <div 
      ref={overlayRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 5
      }}
    >
      {highlightElements}
    </div>
  );
};

export default ReactRabbitholeHighlight;