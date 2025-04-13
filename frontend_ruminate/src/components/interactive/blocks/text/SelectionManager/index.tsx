import React, { useState, useEffect, useRef } from 'react';

interface SelectionManagerProps {
  children: React.ReactNode;
  onTextSelected: (
    text: string, 
    position: { x: number, y: number }, 
    selectionRects: DOMRect[]
  ) => void;
}

// Selection highlight component
const SelectionHighlight: React.FC<{ rect: { left: number, top: number, width: number, height: number }; index: number }> = ({ rect, index }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    backgroundColor: 'rgba(0, 102, 204, 0.25)', // Subtle blue highlight similar to browser default
    pointerEvents: 'none',
    zIndex: 1,
  };

  return <div className="selection-highlight" style={style} />;
};

/**
 * Handles text selection and provides selection information to parent components
 */
const SelectionManager: React.FC<SelectionManagerProps> = ({ 
  children, 
  onTextSelected 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRects, setSelectionRects] = useState<DOMRect[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      
      if (!selection || selection.isCollapsed) return;
      
      const selectionText = selection.toString().trim();
      if (!selectionText) return;
      
      // Get selection coordinates for positioning the tooltip
      const range = selection.getRangeAt(0);
      const rects = Array.from(range.getClientRects());
      
      if (rects.length === 0) return;
      
      // Use the last rect for position (usually at the end of selection)
      const rect = rects[rects.length - 1];
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top
      };
      
      // Save the selection rects for rendering highlights
      setSelectionRects(rects);
      setIsSelecting(true);
      
      onTextSelected(selectionText, position, rects);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Only clear selection if clicking outside of selection-related elements
      const target = e.target as HTMLElement;
      const isTooltipClick = target.closest('.selection-tooltip, .definition-popup');
      
      if (!isTooltipClick) {
        setSelectionRects([]);
        setIsSelecting(false);
      }
    };
    
    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onTextSelected]);
  
  // Convert DOMRect to a plain object and adjust coordinates to be relative to container
  const adjustedRects = selectionRects.map(rect => {
    // Get container position if available
    if (!containerRef.current) return null;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Make coordinates relative to the container
    return {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height
    };
  }).filter(Boolean); // Remove any null values
  
  return (
    <div 
      ref={containerRef} 
      style={{ position: 'relative' }}
      className="selection-manager-container"
    >
      {children}
      
      {/* Render selection highlights as absolutely positioned divs */}
      {isSelecting && adjustedRects.length > 0 && (
        <div 
          className="selection-highlights" 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {adjustedRects.map((rect, index) => (
            <SelectionHighlight 
              key={`selection-${index}`} 
              rect={rect} 
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SelectionManager;