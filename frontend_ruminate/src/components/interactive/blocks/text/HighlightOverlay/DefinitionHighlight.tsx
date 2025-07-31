import React, { useState, useEffect, useRef } from 'react';
import { findTextPositionFromOffset } from './CorrectOffsetCalculator';
import './DefinitionHighlight.css';

interface SavedDefinition {
  term: string;
  definition: string;
  text_start_offset: number;
  text_end_offset: number;
  created_at: string;
}

interface ReactDefinitionHighlightProps {
  contentRef: React.RefObject<HTMLElement>;
  definitions: { [key: string]: SavedDefinition };
  onDefinitionClick: (term: string, definition: string, startOffset: number, endOffset: number, event: React.MouseEvent) => void;
  rabbitholeHighlights?: any[]; // To check for overlaps
}

/**
 * Renders definition highlights as React components
 * Uses text offsets to create properly positioned highlights (like rabbitholes)
 */
const ReactDefinitionHighlight: React.FC<ReactDefinitionHighlightProps> = ({
  contentRef,
  definitions,
  onDefinitionClick,
  rabbitholeHighlights = []
}) => {
  const [highlightElements, setHighlightElements] = useState<React.ReactNode[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  
  // Calculate and render highlights when content or definitions change
  useEffect(() => {
    if (!contentRef.current || !definitions || Object.keys(definitions).length === 0) {
      setHighlightElements([]);
      return;
    }
    
    // Get container position for coordinate adjustment
    const contentRect = contentRef.current.getBoundingClientRect();
    
    // Process each definition
    const newElements = Object.entries(definitions).map(([key, definition]) => {
      
      // Get positioned rectangles for this text range
      const rects = findTextPositionFromOffset(
        contentRef.current as HTMLElement,
        definition.text_start_offset,
        definition.text_end_offset
      );
      
      if (!rects || rects.length === 0) {
        return null;
      }
      
      // Check if this definition overlaps with any rabbithole
      const hasOverlappingRabbithole = rabbitholeHighlights.some((rh: any) => {
        return (
          (definition.text_start_offset >= rh.text_start_offset && definition.text_start_offset < rh.text_end_offset) ||
          (definition.text_end_offset > rh.text_start_offset && definition.text_end_offset <= rh.text_end_offset) ||
          (definition.text_start_offset <= rh.text_start_offset && definition.text_end_offset >= rh.text_end_offset)
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
          height: `${rect.height}px`,
          backgroundColor: 'transparent',
          // Distinguished definition underline - purple/lavender for knowledge
          borderBottom: hasOverlappingRabbithole 
            ? '2px dotted rgba(139, 92, 246, 0.8)' // Dotted purple when overlapping
            : '2px solid rgba(139, 92, 246, 0.7)', // Purple primary
          borderRadius: '0px',
          cursor: 'help',
          zIndex: hasOverlappingRabbithole ? 9 : 8,
          pointerEvents: 'none',
          // When overlapping, shift the entire element down by 4px for better separation
          transform: hasOverlappingRabbithole ? 'translateY(4px)' : 'none',
          // Add subtle depth
          filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1))',
        };
        
        // Create a clickable area that's just a thin strip at the bottom
        const clickableStyle: React.CSSProperties = {
          position: 'absolute',
          left: `${rect.left - contentRect.left}px`,
          top: hasOverlappingRabbithole 
            ? `${rect.top - contentRect.top + rect.height - 8 + 6}px` // Add 6px offset when overlapping
            : `${rect.top - contentRect.top + rect.height - 8}px`, // Normal position
          width: `${rect.width}px`,
          height: '8px', // Thin clickable area
          cursor: 'help',
          zIndex: hasOverlappingRabbithole ? 10 : 9,
          pointerEvents: 'auto',
        };
        
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          onDefinitionClick(definition.term, definition.definition, definition.text_start_offset, definition.text_end_offset, e);
        };
        
        return (
          <React.Fragment key={`definition-${key}-${rectIndex}`}>
            {/* Visual highlight - not clickable */}
            <div
              className="definition-highlight-visual"
              style={style}
            />
            {/* Clickable area - just at the bottom */}
            <div
              className="definition-highlight-clickable"
              style={clickableStyle}
              onClick={handleClick}
              title={`Click to see definition of "${definition.term.length > 30 ? definition.term.substring(0, 30) + '...' : definition.term}"`}
              onMouseEnter={(e) => {
                // Add elegant hover effect to visual highlight
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.borderBottomWidth = '3px';
                  visual.style.borderBottomColor = hasOverlappingRabbithole 
                    ? 'rgba(139, 92, 246, 1)' // Full purple on hover
                    : 'rgba(139, 92, 246, 0.9)'; // Enhanced purple
                  visual.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))';
                }
              }}
              onMouseLeave={(e) => {
                // Restore original styling
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.borderBottomWidth = '2px';
                  visual.style.borderBottomColor = hasOverlappingRabbithole 
                    ? 'rgba(121, 135, 121, 0.6)' // Original sage dotted
                    : 'rgba(121, 135, 121, 0.5)'; // Original sage
                  visual.style.filter = 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1))';
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
  }, [definitions, contentRef, onDefinitionClick, rabbitholeHighlights]);
  
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
        zIndex: 4 // Below rabbithole highlights
      }}
    >
      {highlightElements}
    </div>
  );
};

export default ReactDefinitionHighlight;