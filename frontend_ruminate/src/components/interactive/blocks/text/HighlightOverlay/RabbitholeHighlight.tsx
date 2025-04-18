import React, { useState, useEffect, useRef } from 'react';
import { RabbitholeHighlight as RabbitholeHighlightType } from '../../../../../services/rabbithole';

interface ReactRabbitholeHighlightProps {
  contentRef: React.RefObject<HTMLElement>;
  highlights: RabbitholeHighlightType[];
  onHighlightClick: (id: string, text: string, start: number, end: number) => void;
}

/**
 * Renders rabbithole highlights as React components
 * Uses text offsets to create properly positioned highlights
 */
const ReactRabbitholeHighlight: React.FC<ReactRabbitholeHighlightProps> = ({
  contentRef,
  highlights,
  onHighlightClick
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
        console.log(`Could not find position for highlight: ${selected_text}`);
        return null;
      }
      
      // Create a highlight element for each rect
      return rects.map((rect, rectIndex) => {
        // Convert coordinates to be relative to the container
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${rect.left - contentRect.left}px`,
          top: `${rect.top - contentRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          backgroundColor: 'transparent',  // Remove background color
          borderBottom: '1.5px solid rgba(99, 102, 241, 0.8)', // Stronger underline
          textDecoration: 'underline',
          textDecorationColor: 'rgba(99, 102, 241, 0.8)',
          textDecorationStyle: 'dotted',
          borderRadius: '0px',  // Remove rounded corners
          cursor: 'pointer',
          zIndex: 10,
          boxShadow: 'none',
          pointerEvents: 'auto',
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
          <div
            key={`rabbithole-${id}-${rectIndex}`}
            className="rabbithole-highlight"
            style={style}
            onClick={handleClick}
            title={`Rabbithole conversation: ${selected_text}`}
          />
        );
      });
    })
    .filter(Boolean)
    .flat();
    
    setHighlightElements(newElements as React.ReactNode[]);
  }, [highlights, contentRef, onHighlightClick]);
  
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