import React, { useEffect, useState } from 'react';

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionOverlayProps {
  selectionRects: SelectionRect[];
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * SelectionOverlay renders visual rectangles around selected text
 * These rectangles provide visual feedback for text selection
 */
const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selectionRects,
  containerRef
}) => {
  const [adjustedRects, setAdjustedRects] = useState<SelectionRect[]>([]);
  
  // Adjust rect positions based on container position
  useEffect(() => {
    if (!containerRef.current || selectionRects.length === 0) {
      setAdjustedRects([]);
      return;
    }
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Adjust rects to be relative to the container
    const newRects = selectionRects.map(rect => ({
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height
    }));
    
    setAdjustedRects(newRects);
  }, [selectionRects, containerRef]);
  
  if (adjustedRects.length === 0) return null;
  
  return (
    <div className="selection-overlay absolute top-0 left-0 w-full h-full pointer-events-none">
      {adjustedRects.map((rect, index) => (
        <div
          key={index}
          className="absolute bg-indigo-200 opacity-40 rounded-sm"
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        />
      ))}
    </div>
  );
};

export default SelectionOverlay;
