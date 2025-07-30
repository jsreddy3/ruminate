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
    if (!contentRef.current || !annotations || Object.keys(annotations).length === 0) {
      setHighlightElements([]);
      return;
    }
    
    // Get container position for coordinate adjustment
    const contentRect = contentRef.current.getBoundingClientRect();
    
    // Process each annotation (skip generated notes)
    const newElements = Object.entries(annotations)
      .filter(([key, annotation]) => {
        // Skip generated conversation notes - they have special offset values
        return !(annotation as any).is_generated && annotation.text_start_offset !== -1;
      })
      .map(([key, annotation]) => {
      
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
        // Convert coordinates to be relative to the container - DRAMATIC MARGINALIA STYLE
        const style: React.CSSProperties = {
          position: 'absolute',
          left: `${rect.left - contentRect.left}px`,
          top: `${rect.top - contentRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          // LUXURIOUS illuminated manuscript annotation background
          background: `
            radial-gradient(ellipse at top left, rgba(249, 207, 95, 0.15) 0%, transparent 70%),
            radial-gradient(ellipse at bottom right, rgba(175, 95, 55, 0.1) 0%, transparency 70%),
            linear-gradient(135deg, 
              rgba(252, 240, 210, 0.3) 0%, 
              rgba(249, 230, 183, 0.35) 25%,
              rgba(254, 252, 247, 0.4) 50%,
              rgba(249, 230, 183, 0.35) 75%,
              rgba(252, 240, 210, 0.3) 100%
            )
          `,
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 5,
          pointerEvents: 'none',
          // DRAMATIC medieval manuscript shadows and effects
          boxShadow: `
            inset 0 1px 3px rgba(175, 95, 55, 0.08),
            inset 0 -1px 2px rgba(249, 207, 95, 0.1),
            0 0 8px rgba(175, 95, 55, 0.15),
            0 2px 4px rgba(0, 0, 0, 0.05)
          `,
          // Add ornate border gradient
          backgroundImage: `
            linear-gradient(135deg, 
              rgba(252, 240, 210, 0.3) 0%, 
              rgba(249, 230, 183, 0.35) 25%,
              rgba(254, 252, 247, 0.4) 50%,
              rgba(249, 230, 183, 0.35) 75%,
              rgba(252, 240, 210, 0.3) 100%
            ),
            linear-gradient(0deg, rgba(175, 95, 55, 0.2), rgba(175, 95, 55, 0.2))
          `,
          backgroundOrigin: 'border-box',
          animation: 'ink-spread 0.5s ease-out',
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
                // DRAMATIC manuscript hover effects with ornate flourishes
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.background = `
                    radial-gradient(ellipse at top left, rgba(249, 207, 95, 0.25) 0%, transparent 60%),
                    radial-gradient(ellipse at bottom right, rgba(175, 95, 55, 0.2) 0%, transparent 60%),
                    linear-gradient(135deg, 
                      rgba(252, 240, 210, 0.45) 0%, 
                      rgba(249, 230, 183, 0.5) 25%,
                      rgba(254, 252, 247, 0.55) 50%,
                      rgba(249, 230, 183, 0.5) 75%,
                      rgba(252, 240, 210, 0.45) 100%
                    )
                  `;
                  visual.style.boxShadow = `
                    inset 0 1px 4px rgba(175, 95, 55, 0.12),
                    inset 0 -1px 3px rgba(249, 207, 95, 0.15),
                    0 0 15px rgba(175, 95, 55, 0.25),
                    0 3px 8px rgba(0, 0, 0, 0.1),
                    0 0 25px rgba(249, 207, 95, 0.2)
                  `;
                  visual.style.transform = 'scale(1.02)';
                  visual.style.transition = 'all 0.3s ease-out';
                }
              }}
              onMouseLeave={(e) => {
                // Restore DRAMATIC original styling
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.background = `
                    radial-gradient(ellipse at top left, rgba(249, 207, 95, 0.15) 0%, transparent 70%),
                    radial-gradient(ellipse at bottom right, rgba(175, 95, 55, 0.1) 0%, transparent 70%),
                    linear-gradient(135deg, 
                      rgba(252, 240, 210, 0.3) 0%, 
                      rgba(249, 230, 183, 0.35) 25%,
                      rgba(254, 252, 247, 0.4) 50%,
                      rgba(249, 230, 183, 0.35) 75%,
                      rgba(252, 240, 210, 0.3) 100%
                    )
                  `;
                  visual.style.boxShadow = `
                    inset 0 1px 3px rgba(175, 95, 55, 0.08),
                    inset 0 -1px 2px rgba(249, 207, 95, 0.1),
                    0 0 8px rgba(175, 95, 55, 0.15),
                    0 2px 4px rgba(0, 0, 0, 0.05)
                  `;
                  visual.style.transform = 'scale(1)';
                  visual.style.transition = 'all 0.3s ease-out';
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