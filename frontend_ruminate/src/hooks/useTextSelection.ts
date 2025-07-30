import { useState, useCallback, useRef } from 'react';

interface TextSelectionRange {
  text: string;
  startOffset: number;
  endOffset: number;
}

interface UseTextSelectionProps {
  onTextSelected?: (text: string, position: { x: number; y: number }, rects: DOMRect[]) => void;
}

export const useTextSelection = ({ onTextSelected }: UseTextSelectionProps = {}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedRange, setSelectedRange] = useState<TextSelectionRange | null>(null);
  const [selectedText, setSelectedText] = useState('');

  const handleTextSelected = useCallback((
    text: string, 
    position: { x: number; y: number }, 
    rects: DOMRect[]
  ) => {
    setSelectedText(text);
    
    // Calculate text offsets for the selected text
    if (contentRef.current) {
      const selection = window.getSelection();
      
      // If we have a selection, try to get the range and offsets
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Find container nodes to calculate offsets
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(contentRef.current);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const startOffset = preSelectionRange.toString().length;
        
        // Calculate end offset
        const endOffset = startOffset + text.length;
        
        // Save selection range data
        setSelectedRange({
          text,
          startOffset,
          endOffset
        });
      }
    }

    // Call the provided callback
    if (onTextSelected) {
      onTextSelected(text, position, rects);
    }
  }, [onTextSelected]);

  const clearSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    setSelectedRange(null);
    setSelectedText('');
  }, []);

  return {
    contentRef,
    selectedRange,
    selectedText,
    handleTextSelected,
    clearSelection
  };
};