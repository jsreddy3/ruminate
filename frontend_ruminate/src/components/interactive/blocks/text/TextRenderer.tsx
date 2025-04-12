import React, { useRef, useState, useEffect } from 'react';
import { RabbitholeHighlight } from '../../../../services/rabbithole';
import TextContent from './TextContentFile';
import HighlightOverlay from './HighlightOverlay';
import SelectionManager, { TextSelectionInfo } from './SelectionManager';
import TooltipManager from './TooltipManager';

interface TextRendererProps {
  htmlContent: string;
  blockType: string;
  blockId: string;
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  rabbitholeHighlights?: RabbitholeHighlight[];
  onSelectionChange?: (selectedText: string) => void;
  getBlockClassName?: (blockType?: string) => string;
  onRabbitholeClick?: (id: string, text: string) => void;
  onAddTextToChat?: (text: string) => void;
}

/**
 * TextRenderer coordinates between different components to render text content
 * with highlights, selection capabilities, and tooltips.
 */
export default function TextRenderer({
  htmlContent,
  blockType,
  blockId,
  highlights = [],
  rabbitholeHighlights = [],
  onSelectionChange,
  getBlockClassName = () => '',
  onRabbitholeClick,
  onAddTextToChat
}: TextRendererProps) {
  // Refs and state
  const blockRef = useRef<HTMLDivElement>(null);
  const [selectionInfo, setSelectionInfo] = useState<TextSelectionInfo | null>(null);
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  
  // Process content with highlights using HighlightOverlay
  const processedContent = HighlightOverlay.processContent(htmlContent, {
    highlights,
    rabbitholeHighlights,
    htmlContent
  });

  // Handle selection changes
  const handleSelectionChange = (selection: TextSelectionInfo | null) => {
    setSelectionInfo(selection);
    
    // Notify parent of selection change
    if (onSelectionChange && selection) {
      onSelectionChange(selection.text);
    }
  };
  
  // Handle clicks on highlights
  const handleHighlightClick = (e: React.MouseEvent) => {
    HighlightOverlay.handleHighlightClick(e, setActiveInsight);
    
    // Check if it's a rabbithole highlight and handle the click
    const target = e.target as HTMLElement;
    if (target.classList.contains('rabbithole-highlight') && onRabbitholeClick) {
      const rabbitholeId = target.getAttribute('data-rabbithole-id');
      if (rabbitholeId) {
        onRabbitholeClick(rabbitholeId, target.textContent || '');
      }
    }
  };
  
  // Handle creating a rabbithole or adding to chat from selected text
  const handleCreateRabbithole = (text: string) => {
    if (onAddTextToChat) {
      // If we have the chat handler, use it directly
      onAddTextToChat(text);
      
      // After adding to chat, clear the selection
      setTimeout(clearSelection, 100);
    } else if (onRabbitholeClick && blockId) {
      // Otherwise use rabbithole functionality if available
      // Use an empty ID since this is a new rabbithole
      onRabbitholeClick('', text);
      
      // After creating rabbithole, clear the selection
      setTimeout(clearSelection, 100);
    }
  };
  
  // Handle lookup/define function
  const handleDefineText = (text: string) => {
    // For now, we can just log this and add the implementation later
    console.log('Looking up definition for:', text);
    
    // Here you would typically call a dictionary API or similar service
    // For now, we'll just show an insight popup with a placeholder
    setActiveInsight(`Definition for "${text}" would appear here.`);
    
    // Clear the selection after defining
    setTimeout(clearSelection, 100);
  };
  
  // Function to clear selection (used when a tooltip action is completed)
  const clearSelection = () => {
    setSelectionInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  // Add CSS for highlight styles
  useEffect(() => {
    // Add styles for highlights
    const style = document.createElement('style');
    style.innerHTML = `
      .highlight-phrase {
        background-color: rgba(255, 243, 141, 0.3);
        border-bottom: 2px solid rgba(255, 220, 0, 0.5);
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .highlight-phrase:hover {
        background-color: rgba(255, 243, 141, 0.5);
      }
      
      .rabbithole-highlight {
        background-color: rgba(121, 134, 203, 0.2);
        border-bottom: 2px solid rgba(79, 70, 229, 0.4);
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .rabbithole-highlight:hover {
        background-color: rgba(121, 134, 203, 0.4);
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="relative">
      {/* Render the text content */}
      <TextContent 
        htmlContent={htmlContent}
        blockType={blockType}
        processedContent={processedContent}
        onClickHighlight={handleHighlightClick}
        getBlockClassName={getBlockClassName}
        ref={blockRef}
      />
      
      {/* Handle text selection */}
      <SelectionManager 
        containerRef={blockRef as React.RefObject<HTMLElement>} 
        onSelectionChange={handleSelectionChange}
      />
      
      {/* Manage tooltips */}
      <TooltipManager 
        selectionInfo={selectionInfo}
        onCreateRabbithole={handleCreateRabbithole}
        onDefine={handleDefineText}
        containerRef={blockRef as React.RefObject<HTMLElement>}
      />
      
      {/* Display insight popup when a highlight is clicked */}
      {activeInsight && (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white rounded-lg border border-neutral-200 shadow-lg z-10">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1">{activeInsight}</div>
            <button
              onClick={() => setActiveInsight(null)}
              className="text-neutral-500 hover:text-neutral-700"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}