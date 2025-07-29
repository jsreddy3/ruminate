import React, { useState, useEffect, useRef, useMemo } from 'react';

interface SavedAnnotation {
  id: string;
  text: string;
  note: string;
  text_start_offset: number;
  text_end_offset: number;
  created_at: string;
  updated_at: string;
}

interface ReactAnnotationHighlightProps {
  contentRef: React.RefObject<HTMLElement>;
  annotations: { [key: string]: SavedAnnotation };
  onAnnotationClick: (annotation: SavedAnnotation, event: React.MouseEvent) => void;
  rabbitholeHighlights?: any[];
  definitions?: { [key: string]: any };
}

/**
 * Renders annotation highlights as React components
 * Uses text offsets to create properly positioned highlights with yellow background
 */
const ReactAnnotationHighlight: React.FC<ReactAnnotationHighlightProps> = ({
  contentRef,
  annotations,
  onAnnotationClick,
  rabbitholeHighlights = [],
  definitions = {}
}) => {
  const [highlightElements, setHighlightElements] = useState<React.ReactNode[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Helper function to find text position from character offset (copied from other highlights)
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
  
  // Simple overlap check function
  const getOverlaps = (annotation: any) => {
    const hasOverlappingRabbithole = (rabbitholeHighlights || []).some((rh: any) => {
      return (
        (annotation.text_start_offset >= rh.text_start_offset && annotation.text_start_offset < rh.text_end_offset) ||
        (annotation.text_end_offset > rh.text_start_offset && annotation.text_end_offset <= rh.text_end_offset) ||
        (annotation.text_start_offset <= rh.text_start_offset && annotation.text_end_offset >= rh.text_end_offset)
      );
    });

    const hasOverlappingDefinition = Object.values(definitions || {}).some((def: any) => {
      return (
        (annotation.text_start_offset >= def.text_start_offset && annotation.text_start_offset < def.text_end_offset) ||
        (annotation.text_end_offset > def.text_start_offset && annotation.text_end_offset <= def.text_end_offset) ||
        (annotation.text_start_offset <= def.text_start_offset && annotation.text_end_offset >= def.text_end_offset)
      );
    });
    
    return { hasOverlappingRabbithole, hasOverlappingDefinition };
  };

  // Calculate and render highlights when content or annotations change
  useEffect(() => {
    console.log('AnnotationHighlight useEffect triggered:', { 
      hasContentRef: !!contentRef.current, 
      annotations, 
      annotationCount: annotations ? Object.keys(annotations).length : 0 
    });
    
    if (!contentRef.current || !annotations || Object.keys(annotations).length === 0) {
      console.log('Setting empty highlight elements');
      setHighlightElements([]);
      return;
    }
    
    // Get container position for coordinate adjustment
    const contentRect = contentRef.current.getBoundingClientRect();
    
    // Process each annotation
    const newElements = Object.entries(annotations).map(([key, annotation]) => {
      
      // Get positioned rectangles for this text range
      const rects = findTextPositionFromOffset(
        contentRef.current as HTMLElement,
        annotation.text_start_offset,
        annotation.text_end_offset
      );
      
      if (!rects || rects.length === 0) {
        return null;
      }
      
      // Get overlap data for this annotation
      const { hasOverlappingRabbithole, hasOverlappingDefinition } = getOverlaps(annotation);
      
      // Create a highlight element for each rect
      return rects.map((rect, rectIndex) => {
        // Convert coordinates to be relative to the container
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${rect.left - contentRect.left}px`,
          top: `${rect.top - contentRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          backgroundColor: 'rgba(255, 235, 59, 0.3)', // Yellow highlight background
          borderRadius: '2px',
          cursor: 'pointer',
          zIndex: 5, // Background layer, below all underlines
          pointerEvents: 'none', // Allow text selection through the highlight
        };
        
        // Create a clickable area covering the entire highlight
        const clickableStyle: React.CSSProperties = {
          position: 'absolute',
          left: `${rect.left - contentRect.left}px`,
          top: `${rect.top - contentRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          cursor: 'pointer',
          zIndex: 6, // Background layer clickable area
          pointerEvents: 'auto',
        };
        
        const handleClick = (e: React.MouseEvent) => {
          console.log('Annotation clicked:', annotation);
          e.stopPropagation();
          e.preventDefault();
          onAnnotationClick(annotation, e);
        };
        
        return (
          <React.Fragment key={`annotation-${key}-${rectIndex}`}>
            {/* Visual highlight */}
            <div
              className="annotation-highlight-visual"
              style={style}
            />
            {/* Clickable area */}
            <div
              className="annotation-highlight-clickable"
              style={clickableStyle}
              onClick={handleClick}
              title={`Annotation: ${annotation.note.length > 30 ? annotation.note.substring(0, 30) + '...' : annotation.note}`}
              onMouseEnter={(e) => {
                // Add hover effect to visual highlight
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.backgroundColor = 'rgba(255, 235, 59, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                // Remove hover effect
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.backgroundColor = 'rgba(255, 235, 59, 0.3)';
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
  }, [annotations, contentRef, onAnnotationClick, rabbitholeHighlights, definitions]);
  
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
        zIndex: 3 // Below other highlights
      }}
    >
      {highlightElements}
    </div>
  );
};

export default ReactAnnotationHighlight;