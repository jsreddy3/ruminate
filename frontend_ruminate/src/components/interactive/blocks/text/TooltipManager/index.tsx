import React, { useState } from 'react';
import TextSelectionTooltip from './TextSelectionTooltip';
import { TextSelectionInfo } from '../SelectionManager';

interface TooltipManagerProps {
  selectionInfo: TextSelectionInfo | null;
  onCreateRabbithole?: (text: string) => void;
  onDefine?: (text: string) => void;
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * TooltipManager coordinates the display of various tooltips based on user interactions.
 * It manages both selection tooltips and definition tooltips.
 */
const TooltipManager: React.FC<TooltipManagerProps> = ({
  selectionInfo,
  onCreateRabbithole,
  onDefine,
  containerRef
}) => {
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Calculate tooltip position based on selection info
  React.useEffect(() => {
    if (!selectionInfo || !containerRef.current) return;
    
    const { rects } = selectionInfo;
    if (rects.length === 0) return;
    
    // Use the selection rectangles for better positioning
    // We'll position at the end of the last line of selection
    const lastRect = rects[rects.length - 1];
    
    // Get container position
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate position relative to container
    // Position tooltip below the selection
    const x = lastRect.left - containerRect.left + (lastRect.width / 2);
    const y = lastRect.top - containerRect.top + lastRect.height + 5; // Add small offset
    
    setTooltipPosition({ x, y });
  }, [selectionInfo, containerRef]);
  
  // Handle creating a rabbithole from selected text
  const handleCreateRabbithole = () => {
    if (selectionInfo && onCreateRabbithole) {
      onCreateRabbithole(selectionInfo.text);
      // Note: We don't clear the selection here 
      // This is now handled by the parent component when appropriate
    }
  };
  
  // Handle closing the tooltip (without taking action)
  const handleClose = () => {
    // We'll leave the selection intact, just close the tooltip
    // The parent TextRenderer component handles clearing the selection when needed
  };
  
  return (
    <>
      {selectionInfo && selectionInfo.text && (
        <TextSelectionTooltip 
          selectedText={selectionInfo.text}
          isVisible={true}
          position={tooltipPosition}
          onAddToChat={handleCreateRabbithole}
          onDefine={onDefine}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default TooltipManager;
