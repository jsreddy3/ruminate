import React, { useState, useEffect, useRef } from 'react';
import TextContent from './TextContentFile';
import TextSelectionTooltip from './TooltipManager/TextSelectionTooltip';
import DefinitionPopup from './TooltipManager/DefinitionPopup';
import AgentChatLauncher from './AgentChatLauncher';
import { RabbitholeHighlight } from '../../../../services/rabbithole';
import SelectionManager from './SelectionManager';
import ReactRabbitholeHighlight from './HighlightOverlay/RabbitholeHighlight';

interface TextRendererProps {
  htmlContent: string;
  blockType: string;
  blockId: string;
  documentId: string;
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
  onAgentChatCreated?: (conversationId: string) => void;
  rabbitholeHighlights?: RabbitholeHighlight[];
  getBlockClassName?: (blockType?: string) => string;
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  customStyle?: React.CSSProperties;
}

const TextRenderer: React.FC<TextRendererProps> = ({
  htmlContent,
  blockType,
  blockId,
  documentId,
  onAddTextToChat,
  onRabbitholeClick,
  onRabbitholeCreate,
  onAgentChatCreated,
  rabbitholeHighlights = [],
  getBlockClassName,
  highlights = [],
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
  
  // State for agent chat launcher
  const [agentLauncherVisible, setAgentLauncherVisible] = useState(false);
  
  // console.log(`TextRenderer(${blockId}) rendering`);
  
  // useEffect(() => {
  //   console.log(`TextRenderer(${blockId}) mounted`);
  //   return () => {
  //     console.log(`TextRenderer(${blockId}) unmounting`);
  //   };
  // }, [blockId]);
  
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
    setDefinitionWord(text);
    setDefinitionPosition(tooltipPosition);
    setDefinitionVisible(true);
    setTooltipVisible(false);
  };
  
  // Handle launching agent chat from selected text
  const handleRabbitholeCreate = (text: string) => {
    console.log('Launching agent chat for:', text);
    
    // Only proceed if we have valid selection range data
    if (selectedRange) {
      // Hide tooltip and show agent launcher
      setTooltipVisible(false);
      setAgentLauncherVisible(true);
    }
  };
  
  // Handle agent chat creation completion
  const handleAgentChatCreated = (conversationId: string) => {
    if (onAgentChatCreated) {
      onAgentChatCreated(conversationId);
    }
    setAgentLauncherVisible(false);
    clearSelection();
  };
  
  // Handle canceling agent chat creation
  const handleAgentChatCancel = () => {
    setAgentLauncherVisible(false);
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
            customStyle={customStyle}
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
      
      {/* Agent Chat Launcher */}
      {agentLauncherVisible && selectedRange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <AgentChatLauncher
            documentId={documentId}
            blockId={blockId}
            selectedText={selectedRange.text}
            startOffset={selectedRange.startOffset}
            endOffset={selectedRange.endOffset}
            onLaunchComplete={handleAgentChatCreated}
            onCancel={handleAgentChatCancel}
          />
        </div>
      )}
    </div>
  );
};

export default TextRenderer;