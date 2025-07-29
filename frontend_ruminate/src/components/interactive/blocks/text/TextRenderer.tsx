import React, { useState, useEffect, useRef } from 'react';
import TextContent from './TextContentFile';
import TextSelectionTooltip from './TooltipManager/TextSelectionTooltip';
import DefinitionPopup from './TooltipManager/DefinitionPopup';
import { RabbitholeHighlight } from '../../../../services/rabbithole';
import SelectionManager from './SelectionManager';
import ReactRabbitholeHighlight from './HighlightOverlay/RabbitholeHighlight';
import ReactDefinitionHighlight from './HighlightOverlay/DefinitionHighlight';
import { createPortal } from 'react-dom';

interface TextRendererProps {
  htmlContent: string;
  blockType: string;
  blockId: string;
  documentId: string;
  metadata?: {
    definitions?: {
      [term: string]: {
        term: string;
        definition: string;
        created_at: string;
      };
    };
    [key: string]: any;
  };
  onAddTextToChat?: (text: string) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onRabbitholeClick?: (
    id: string, 
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
  onBlockMetadataUpdate?: () => void;
  customStyle?: React.CSSProperties;
}

const TextRenderer: React.FC<TextRendererProps> = ({
  htmlContent,
  blockType,
  blockId,
  documentId,
  metadata,
  onAddTextToChat,
  onCreateRabbithole,
  onRabbitholeClick,
  rabbitholeHighlights = [],
  getBlockClassName,
  highlights = [],
  onBlockMetadataUpdate,
  customStyle
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
  const [savedDefinition, setSavedDefinition] = useState<string | null>(null);
  const [definitionOffsets, setDefinitionOffsets] = useState<{startOffset: number, endOffset: number} | null>(null);
  
  
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
    
    // Ensure we have the offsets from selectedRange
    if (!selectedRange) {
      console.error('No selected range available for definition');
      return;
    }
    
    setDefinitionWord(text);
    setSavedDefinition(null); // Clear any saved definition
    setDefinitionPosition(tooltipPosition);
    setDefinitionVisible(true);
    setTooltipVisible(false);
  };

  // Handle creating a rabbithole conversation
  const handleCreateRabbithole = (text: string, startOffset: number, endOffset: number) => {
    console.log('Creating rabbithole for:', { text, startOffset, endOffset });
    if (onCreateRabbithole) {
      // Use the actual selection range data if available, otherwise use provided offsets
      if (selectedRange) {
        onCreateRabbithole(selectedRange.text, selectedRange.startOffset, selectedRange.endOffset);
      } else {
        onCreateRabbithole(text, startOffset, endOffset);
      }
    }
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
  
  // Handle saved definition click (from highlight)
  const handleSavedDefinitionClick = (term: string, definition: string, startOffset: number, endOffset: number, event: React.MouseEvent) => {
    console.log('Showing saved definition for:', term);
    console.log('Setting states - term:', term, 'definition:', definition);
    setDefinitionWord(term);
    setSavedDefinition(definition);
    setDefinitionOffsets({ startOffset, endOffset });
    // Position at mouse position
    const mousePos = { x: event.clientX, y: event.clientY };
    console.log('Mouse position:', mousePos);
    setDefinitionPosition(mousePos);
    setDefinitionVisible(true);
    console.log('definitionVisible set to true');
  };
  
  // Handle when a new definition is saved
  const handleDefinitionSaved = (term: string, definition: string, startOffset: number, endOffset: number) => {
    console.log('Definition saved for:', term, 'at offsets:', startOffset, '-', endOffset);
    // The parent component should handle refreshing block data
    // to get the updated metadata with the new definition
    if (onBlockMetadataUpdate) {
      onBlockMetadataUpdate();
    }
  };
  
  // Handle clicks outside of tooltips to close them
  const handleClick = (e: React.MouseEvent) => {
    // If clicking on the content (not a highlight), close tooltips
    if ((e.target as HTMLElement).closest('.rabbithole-highlight, .definition-highlight')) {
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
            customStyle={customStyle}
          />
        </div>
      </SelectionManager>
      
      {/* Definition highlights overlay (rendered before rabbithole so rabbithole is on top) */}
      {metadata?.definitions && (
        <ReactDefinitionHighlight
          contentRef={contentRef as React.RefObject<HTMLElement>}
          definitions={metadata.definitions}
          onDefinitionClick={handleSavedDefinitionClick}
          rabbitholeHighlights={rabbitholeHighlights}
        />
      )}
      
      {/* Rabbithole highlights overlay */}
      <ReactRabbitholeHighlight
        contentRef={contentRef as React.RefObject<HTMLElement>}
        highlights={rabbitholeHighlights}
        onHighlightClick={handleRabbitholeClick}
        definitions={metadata?.definitions}
      />
      
      {/* Text selection tooltip */}
      {tooltipVisible && createPortal(
        <TextSelectionTooltip
          isVisible={true}
          position={tooltipPosition}
          selectedText={selectedText}
          onAddToChat={handleAddToChat}
          onDefine={handleDefineText}
          onCreateRabbithole={handleCreateRabbithole}
          onClose={() => {
            setTooltipVisible(false);
          } }
          documentId={documentId} 
          blockId={blockId}
        />,
        document.body
      )}
      
      {definitionVisible && (selectedRange || definitionOffsets) && createPortal(
        <DefinitionPopup
          isVisible={definitionVisible}
          term={definitionWord}
          textStartOffset={definitionOffsets?.startOffset || selectedRange?.startOffset || 0}
          textEndOffset={definitionOffsets?.endOffset || selectedRange?.endOffset || 0}
          position={definitionPosition}
          savedDefinition={savedDefinition || undefined}
          onClose={() => {
            setDefinitionVisible(false);
            setSavedDefinition(null);
            setDefinitionOffsets(null);
          }}
          onDefinitionSaved={handleDefinitionSaved}
          documentId={documentId}
          blockId={blockId}
        />,
        document.body
      )}
    </div>
  );
};

export default TextRenderer;