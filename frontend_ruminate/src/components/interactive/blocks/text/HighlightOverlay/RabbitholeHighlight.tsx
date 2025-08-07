import React, { useState, useEffect, useRef } from 'react';
import { findTextPositionFromOffset } from './CorrectOffsetCalculator';
import { RabbitholeHighlight as RabbitholeHighlightType } from '../../../../../services/rabbithole';
import './RabbitholeHighlight.css';

interface ReactRabbitholeHighlightProps {
  contentRef: React.RefObject<HTMLElement>;
  highlights: RabbitholeHighlightType[];
  onHighlightClick: (
    id: string,
    text: string,
    start: number,
    end: number,
    position?: { x: number; y: number }
  ) => void;
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
          // Bold forest green underline for discourse threads
          borderBottom: hasOverlappingDefinition 
            ? '3px solid rgba(34, 139, 34, 0.9)' // Thicker forest green when overlapping
            : '2px solid rgba(34, 139, 34, 0.8)', // Forest green primary
          borderRadius: '0px',
          cursor: 'pointer',
          zIndex: 7,
          boxShadow: 'none',
          pointerEvents: 'none', // Allow text selection through the highlight
          // Add subtle scholarly depth
          filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.08))',
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
          
          // Prefer mouse position if available; fallback to rect bottom-center
          const pos = {
            x: e.clientX ?? rect.left + rect.width / 2,
            y: e.clientY ?? rect.top + rect.height,
          };
          
          onHighlightClick(
            effectiveConversationId,
            selected_text,
            text_start_offset,
            text_end_offset,
            pos
          );
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
                // Add elegant scholarly hover effect
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.borderBottomWidth = '3px';
                  visual.style.borderBottomColor = hasOverlappingDefinition 
                    ? 'rgba(34, 139, 34, 1)' // Full forest green
                    : 'rgba(34, 139, 34, 1)'; // Full forest green
                  visual.style.filter = 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.12))';
                }
              }}
              onMouseLeave={(e) => {
                // Restore original styling
                const visual = e.currentTarget.previousSibling as HTMLElement;
                if (visual) {
                  visual.style.borderBottomWidth = '2px';
                  visual.style.borderBottomColor = hasOverlappingDefinition 
                    ? 'rgba(34, 139, 34, 0.9)' // Original forest green thick
                    : 'rgba(34, 139, 34, 0.8)'; // Original forest green
                  visual.style.filter = 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.08))';
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