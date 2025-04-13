import React, { useState, useEffect, useRef } from 'react';
import TextContent from './TextContentFile';
import TextSelectionTooltip from './TooltipManager/TextSelectionTooltip';
import DefinitionPopup from './TooltipManager/DefinitionPopup';
import { RabbitholeHighlight } from '../../../../services/rabbithole';
import SelectionManager from './SelectionManager';
import ReactRabbitholeHighlight from './HighlightOverlay/RabbitholeHighlight';

interface TextRendererProps {
  htmlContent: string;
  blockType: string;
  blockId: string;
  onAddTextToChat?: (text: string) => void;
  onRabbitholeClick?: (
    id: string, 
    text: string, 
    startOffset: number, 
    endOffset: number
  ) => void;
  onRabbitholeCreate?: (
    text: string,
    startOffset: number,
    endOffset: number
  ) => void;
  rabbitholeHighlights?: RabbitholeHighlight[];
  getBlockClassName?: (blockType?: string) => string;
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
}

const TextRenderer: React.FC<TextRendererProps> = ({
  htmlContent,
  blockType,
  blockId,
  onAddTextToChat,
  onRabbitholeClick,
  onRabbitholeCreate,
  rabbitholeHighlights = [],
  getBlockClassName,
  highlights = []
}) => {
  const blockRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // State for tooltip handling
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  
  // State for selected text range
  const [selectedRange, setSelectedRange] = useState<{
    text: string,
    startOffset: number,
    endOffset: number
  } | null>(null);
  
  // State for definition popup
  const [definitionVisible, setDefinitionVisible] = useState(false);
  const [definitionWord, setDefinitionWord] = useState('');
  const [definitionPosition, setDefinitionPosition] = useState({ x: 0, y: 0 });
  
  console.log(`TextRenderer(${blockId}) rendering`);
  
  useEffect(() => {
    console.log(`TextRenderer(${blockId}) mounted`);
    return () => {
      console.log(`TextRenderer(${blockId}) unmounting`);
    };
  }, [blockId]);
  
  // Handle text selection
  const handleTextSelected = (
    text: string, 
    position: { x: number, y: number }, 
    rects: DOMRect[]
  ) => {
    setSelectedText(text);
    setTooltipPosition(position);
    setTooltipVisible(true);
    
    // Calculate text offsets for the selected text
    if (contentRef.current) {
      const contentText = contentRef.current.textContent || '';
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
        
        console.log('Selection range:', { startOffset, endOffset, text });
      }
    }
  };
  
  // Clear selection
  const clearSelection = () => {
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  };
  
  // Handle adding text to chat
  const handleAddToChat = (text: string) => {
    if (onAddTextToChat) {
      onAddTextToChat(text);
    }
    
    // Only hide tooltip, don't clear selection yet
    setTooltipVisible(false);
  };
  
  // Handle define text action
  const handleDefineText = (text: string) => {
    console.log('Looking up definition for:', text);
    setDefinitionWord(text);
    setDefinitionPosition(tooltipPosition);
    setDefinitionVisible(true);
    setTooltipVisible(false);
  };
  
  // Handle creating a rabbithole from selected text
  const handleRabbitholeCreate = (text: string) => {
    console.log('Creating rabbithole for:', text);
    
    // Only proceed if we have valid selection range data
    if (selectedRange && onRabbitholeCreate) {
      onRabbitholeCreate(
        selectedRange.text,
        selectedRange.startOffset,
        selectedRange.endOffset
      );
    }
    
    // Hide tooltip after action
    setTooltipVisible(false);
  };
  
  // Handle rabbithole highlight click
  const handleRabbitholeClick = (
    id: string, 
    text: string, 
    startOffset: number, 
    endOffset: number
  ) => {
    console.log('Rabbithole clicked:', { id, text, startOffset, endOffset });
    if (onRabbitholeClick) {
      onRabbitholeClick(id, text, startOffset, endOffset);
    }
  };
  
  // Handle clicks outside of tooltips to close them
  const handleClick = (e: React.MouseEvent) => {
    // If clicking on the content (not a highlight), close tooltips
    if ((e.target as HTMLElement).closest('.rabbithole-highlight')) {
      // Don't close tooltips if clicking a highlight
      return;
    }
    
    // Close tooltips
    setTooltipVisible(false);
    setDefinitionVisible(false);
  };
  
  return (
    <div ref={blockRef} className="text-renderer relative">
      <SelectionManager onTextSelected={handleTextSelected}>
        <div ref={contentRef} onClick={handleClick}>
          <TextContent 
            htmlContent={htmlContent}
            blockType={blockType}
            processedContent={htmlContent} 
            onClickHighlight={() => {}} 
            getBlockClassName={getBlockClassName}
          />
        </div>
      </SelectionManager>
      
      {/* Rabbithole highlights overlay */}
      <ReactRabbitholeHighlight
        contentRef={contentRef as React.RefObject<HTMLElement>}
        highlights={rabbitholeHighlights}
        onHighlightClick={handleRabbitholeClick}
      />
      
      {/* Text selection tooltip */}
      {tooltipVisible && (
        <TextSelectionTooltip
          isVisible={true}
          position={tooltipPosition}
          selectedText={selectedText}
          onAddToChat={handleAddToChat}
          onDefine={handleDefineText}
          onRabbithole={onRabbitholeCreate ? handleRabbitholeCreate : undefined}
          onClose={() => {
            setTooltipVisible(false);
          }}
        />
      )}
      
      {/* Definition popup */}
      {definitionVisible && (
        <DefinitionPopup
          isVisible={definitionVisible}
          term={definitionWord}
          position={definitionPosition}
          onClose={() => setDefinitionVisible(false)}
        />
      )}
    </div>
  );
};

export default TextRenderer;