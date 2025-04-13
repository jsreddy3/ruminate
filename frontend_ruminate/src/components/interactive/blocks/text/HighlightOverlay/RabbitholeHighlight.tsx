import React, { useState, useEffect } from 'react';
import { RabbitholeHighlight as RabbitholeHighlightType } from '../../../../../services/rabbithole';

interface ReactRabbitholeHighlightProps {
  contentRef: React.RefObject<HTMLElement>;
  highlights: RabbitholeHighlightType[];
  onHighlightClick: (id: string, text: string, start: number, end: number) => void;
}

/**
 * Renders rabbithole highlights as React components
 * Uses text positions to overlay highlights on content
 */
const ReactRabbitholeHighlight: React.FC<ReactRabbitholeHighlightProps> = ({
  contentRef,
  highlights,
  onHighlightClick
}) => {
  const [highlightElements, setHighlightElements] = useState<React.ReactNode[]>([]);
  
  useEffect(() => {
    if (!contentRef.current || !highlights?.length) {
      setHighlightElements([]);
      return;
    }
    
    // For a proper implementation, you would need to:
    // 1. Find the character positions in the rendered content
    // 2. Convert character offsets to screen positions
    // 3. Create highlight elements at those positions
    
    // This is a simplified approach that places highlights at reasonable positions
    const content = contentRef.current;
    const contentWidth = content.offsetWidth - 40;
    const contentText = content.textContent || '';
    
    const elements = highlights.map((highlight, index) => {
      const { id, selected_text, text_start_offset, text_end_offset, conversation_id } = highlight;
      
      // Calculate approximate position based on offsets
      // This is an approximation - for a real implementation, you'd need to calculate
      // exact positions based on text flow and line wrapping
      const relativeStart = text_start_offset / contentText.length;
      const horizontalPosition = Math.max(10, Math.min(contentWidth - 100, relativeStart * contentWidth));
      
      // Estimate vertical position - this is very approximate
      const lines = Math.floor(relativeStart * 10) + 1; // Simple heuristic
      const verticalPosition = lines * 24; // Assuming ~24px line height
      
      const style: React.CSSProperties = {
        position: 'absolute',
        left: `${horizontalPosition}px`,
        top: `${verticalPosition}px`,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        border: '1px solid rgba(79, 70, 229, 0.3)',
        borderBottom: '2px solid rgba(79, 70, 229, 0.6)',
        cursor: 'pointer',
        padding: '2px 4px',
        zIndex: 10,
        borderRadius: '3px',
        maxWidth: '200px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        fontSize: '0.9em'
      };
      
      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onHighlightClick(conversation_id, selected_text, text_start_offset, text_end_offset);
      };
      
      return (
        <div
          key={`rabbithole-${id}`}
          className="rabbithole-highlight"
          style={style}
          onClick={handleClick}
          title={`Rabbithole: ${selected_text}`}
        >
          🐇 {selected_text}
        </div>
      );
    });
    
    setHighlightElements(elements);
  }, [highlights, contentRef, onHighlightClick]);
  
  return <>{highlightElements}</>;
};

export default ReactRabbitholeHighlight;