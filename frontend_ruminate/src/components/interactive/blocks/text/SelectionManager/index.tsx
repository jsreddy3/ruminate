import React, { useEffect, useState, useRef } from 'react';
import SelectionOverlay from './SelectionOverlay';

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TextSelectionInfo {
  text: string;
  rects: SelectionRect[];
  anchorNode: Node | null;
  focusNode: Node | null;
  anchorOffset: number;
  focusOffset: number;
}

interface SelectionManagerProps {
  containerRef: React.RefObject<HTMLElement>;
  onSelectionChange?: (selection: TextSelectionInfo | null) => void;
}

/**
 * SelectionManager handles text selection within a container and generates selection rectangles
 * for visual feedback. It also captures selection information for the Rabbithole feature.
 */
const SelectionManager: React.FC<SelectionManagerProps> = ({
  containerRef,
  onSelectionChange
}) => {
  const [selectionInfo, setSelectionInfo] = useState<TextSelectionInfo | null>(null);
  const selectionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Listen for text selections in the document
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      
      // Clear any pending selection timeouts
      if (selectionTimeout.current) {
        clearTimeout(selectionTimeout.current);
        selectionTimeout.current = null;
      }
      
      // If there's no selection or it's empty, clear selection info
      if (!selection || selection.isCollapsed) {
        setSelectionInfo(null);
        if (onSelectionChange) onSelectionChange(null);
        return;
      }
      
      // Ensure the selection is within our target container
      const container = containerRef.current;
      if (!container) return;
      
      // Check if the selection is within our container
      let isSelectionInContainer = false;
      const range = selection.getRangeAt(0);
      let currentNode = range.startContainer;
      
      while (currentNode && currentNode !== document.body) {
        if (currentNode === container) {
          isSelectionInContainer = true;
          break;
        }
        currentNode = currentNode.parentNode as Node;
      }
      
      if (!isSelectionInContainer) {
        setSelectionInfo(null);
        if (onSelectionChange) onSelectionChange(null);
        return;
      }
      
      // Get selection text and client rects
      const selectionText = selection.toString().trim();
      const clientRects = Array.from(range.getClientRects());
      
      // Convert DOMRect to our simpler SelectionRect format
      const selectionRects: SelectionRect[] = clientRects.map(rect => ({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }));
      
      // Create selection info with node and offset information for precise placement
      const newSelectionInfo: TextSelectionInfo = {
        text: selectionText,
        rects: selectionRects,
        anchorNode: selection.anchorNode,
        focusNode: selection.focusNode,
        anchorOffset: selection.anchorOffset,
        focusOffset: selection.focusOffset
      };
      
      // Small delay to avoid flickering when user is still selecting
      selectionTimeout.current = setTimeout(() => {
        if (selectionText.length > 0) {
          setSelectionInfo(newSelectionInfo);
          if (onSelectionChange) onSelectionChange(newSelectionInfo);
        } else {
          setSelectionInfo(null);
          if (onSelectionChange) onSelectionChange(null);
        }
      }, 200);
    };
    
    // Add event listener
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Cleanup
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeout.current) {
        clearTimeout(selectionTimeout.current);
      }
    };
  }, [containerRef, onSelectionChange]);
  
  return (
    <>
      {selectionInfo && (
        <SelectionOverlay 
          selectionRects={selectionInfo.rects} 
          containerRef={containerRef}
        />
      )}
    </>
  );
};

export default SelectionManager;
