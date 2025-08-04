import React, { useState, useEffect, useRef } from 'react';

interface SelectionManagerProps {
  children: React.ReactNode;
  onTextSelected: (
    text: string, 
    position: { x: number, y: number }, 
    selectionRects: DOMRect[]
  ) => void;
  preventDeselection?: boolean;
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
  onTextSelected,
  preventDeselection = false
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
      // Don't clear selection if deselection is prevented (e.g., during onboarding)
      if (preventDeselection) {
        // Also prevent the browser's native text selection clearing
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
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
    
    // Additional protection for preventing deselection during onboarding
    const handleGlobalClick = (e: Event) => {
      if (preventDeselection) {
        const target = e.target as HTMLElement;
        const isTooltipClick = target.closest('.selection-tooltip, .definition-popup');
        if (!isTooltipClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    
    if (preventDeselection) {
      document.addEventListener('click', handleGlobalClick, true);
      document.addEventListener('mousedown', handleGlobalClick, true);
    }
    
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      if (preventDeselection) {
        document.removeEventListener('click', handleGlobalClick, true);
        document.removeEventListener('mousedown', handleGlobalClick, true);
      }
    };
  }, [onTextSelected, preventDeselection]);

  // Aggressive selection preservation during onboarding
  useEffect(() => {
    
    if (!preventDeselection) {
      return;
    }

    let savedSelection: Range | null = null;
    let savedSelectionText = '';

    const preserveSelection = () => {
      const selection = window.getSelection();
      
      if (selection && selection.rangeCount > 0) {
        savedSelection = selection.getRangeAt(0).cloneRange();
        savedSelectionText = selection.toString();
      }
    };

    const restoreSelection = () => {
      if (savedSelection && savedSelectionText) {
        const selection = window.getSelection();
        const currentText = selection?.toString() || '';
        
        if (selection && (!currentText || currentText !== savedSelectionText)) {
          selection.removeAllRanges();
          selection.addRange(savedSelection);
        } 
      } 
    };

    // Save selection initially
    preserveSelection();

    // Restore selection on any potential clearing events
    const handleSelectionChange = () => {
      setTimeout(restoreSelection, 0); // Defer to next tick
    };

    const handleMouseDown = (e: Event) => {
      preserveSelection();
    };

    const handleMouseUp = (e: Event) => {
      setTimeout(restoreSelection, 0);
    };

    const handleClick = (e: Event) => {
      setTimeout(restoreSelection, 0);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClick);
    };
  }, [preventDeselection]);
  
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