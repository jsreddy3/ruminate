import React, { useState, useEffect, useRef, useMemo } from 'react';
import { findTextPositionFromOffset } from './CorrectOffsetCalculator';

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
          // Simple, functional annotation highlight
          backgroundColor: 'rgba(255, 235, 59, 0.3)', // Classic yellow highlight, 30% opacity
          borderRadius: '2px',
          cursor: 'pointer',
          zIndex: 5,
          pointerEvents: 'none',
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
                  visual.style.backgroundColor = 'rgba(255, 235, 59, 0.5)'; // More opaque on hover
                  visual.style.transition = 'background-color 0.2s ease';
                }
              }}
              onMouseLeave={(e) => {
                // Restore original yellow styling
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.backgroundColor = 'rgba(255, 235, 59, 0.3)'; // Back to original yellow
                  visual.style.transition = 'background-color 0.2s ease';
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