"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import type { ChatPaneProps } from "../../types/chat";
import ChatPane from "./chat/ChatPane";
import BlockContainer from "./blocks/BlockContainer";
import RabbitholePane from "./rabbithole/RabbitholePane";
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { RabbitholeHighlight } from "../../services/rabbithole";

// Add array of supported block types (matching PDFViewer)
const chatEnabledBlockTypes = [
  "text",
  "sectionheader",
  "pageheader",
  "pagefooter",
  "listitem",
  "footnote",
  "reference",
  "picture",
  "textinlinemath",
  "equation",
  "table",
  "figure"
].map(type => type.toLowerCase());

// Define the handle type for the ref
export interface InteractivePaneHandle {
  closeRabbithole: () => void;
}

export default forwardRef<InteractivePaneHandle, ChatPaneProps>(function InteractivePane({ 
  block, 
  documentId, 
  conversationId,
  onClose,
  onNextBlock,
  onPreviousBlock,
  hasNextBlock,
  hasPreviousBlock,
  onSwitchToNotesTab
}, ref) {
  // console.log(`InteractivePane MOUNT with block ID: ${block.id}`);
  
  // Add cleanup log in useEffect
  useEffect(() => {
    console.log(`InteractivePane mounted with documentId: ${documentId}, conversationId: ${conversationId}`);
    return () => {
      // console.log(`InteractivePane UNMOUNT with block ID: ${block.id}`);
    };
  }, [block.id, documentId, conversationId]);
  
  // Track current block ID to handle block changes without remounting
  const [currentBlockId, setCurrentBlockId] = useState(block.id);

  // Update currentBlockId when block prop changes
  useEffect(() => {
    // console.log(`InteractivePane UPDATE with block ID: ${block.id}`);
    setCurrentBlockId(block.id);
  }, [block.id]);

  // State for selected text from block content to be passed to chat
  const [selectedText, setSelectedText] = useState("");
  
  // State for rabbithole mode
  const [rabbitholeMode, setRabbitholeMode] = useState(false);
  const [activeRabbitholeId, setActiveRabbitholeId] = useState<string>("");
  const [activeRabbitholeText, setActiveRabbitholeText] = useState<string>("");
  const [activeRabbitholeStartOffset, setActiveRabbitholeStartOffset] = useState<number>(0);
  const [activeRabbitholeEndOffset, setActiveRabbitholeEndOffset] = useState<number>(0);
  
  // Ref to store the rabbithole refresh function
  const rabbitholeRefreshRef = useRef<(() => void) | null>(null);
  
  // Function to handle adding text to chat from the block content
  const handleAddTextToChat = (text: string) => {
    setSelectedText(text);
  };
  
  // Function to handle creating a new rabbithole from selected text
  const handleRabbitholeCreate = (text: string, startOffset: number, endOffset: number) => {
    console.log('InteractivePane.handleRabbitholeCreate called with:', {
      text,
      startOffset,
      endOffset,
      currentBlockId
    });
    
    // Set the active rabbithole information
    setActiveRabbitholeText(text);
    setActiveRabbitholeStartOffset(startOffset);
    setActiveRabbitholeEndOffset(endOffset);
    
    // IMPORTANT: Clear the active rabbithole ID to ensure we create a new one
    // instead of reusing an existing one
    setActiveRabbitholeId("");
    
    // Switch to rabbithole mode - no ID yet, RabbitholePane will create one
    console.log('Setting rabbithole mode to true, activeRabbitholeId:', activeRabbitholeId);
    setRabbitholeMode(true);
    
    // We don't set activeRabbitholeId because it will be created by RabbitholePane
  };
  
  // Function to handle rabbithole click
  const handleRabbitholeClick = (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => {
    console.log('InteractivePane.handleRabbitholeClick called with:', {
      rabbitholeId,
      selectedText,
      startOffset,
      endOffset,
      currentBlockId
    });
    
    // Log component state before changes
    console.log('InteractivePane state BEFORE changes:', {
      rabbitholeMode,
      activeRabbitholeId,
      currentBlockId,
      selectedText: activeRabbitholeText
    });
    
    setActiveRabbitholeId(rabbitholeId);
    setActiveRabbitholeText(selectedText);
    if (startOffset !== undefined) setActiveRabbitholeStartOffset(startOffset);
    if (endOffset !== undefined) setActiveRabbitholeEndOffset(endOffset);
    
    console.log('Setting rabbithole mode to true');
    setRabbitholeMode(true);
    
    // Log current state after update
    setTimeout(() => {
      console.log('InteractivePane state AFTER changes:', {
        rabbitholeMode,
        activeRabbitholeId,
        currentBlockId,
        selectedText: activeRabbitholeText
      });
    }, 100);
  };
  
  // Function to exit rabbithole mode
  const handleCloseRabbithole = () => {
    setRabbitholeMode(false);
    
    // Refresh rabbithole data after closing to ensure UI is updated
    if (rabbitholeRefreshRef.current) {
      console.log('Refreshing rabbithole data after closing');
      // Small delay to ensure state updates have processed
      setTimeout(() => {
        rabbitholeRefreshRef.current?.();
      }, 100);
    }
  };
  
  // Handler to capture the refresh function from BlockContainer
  const handleRefreshRabbitholes = (refreshFn: () => void) => {
    rabbitholeRefreshRef.current = refreshFn;
  };

  // Update the condition to check against supported types
  const blockIsChatEnabled = block.block_type && 
    chatEnabledBlockTypes.includes(block.block_type.toLowerCase());

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    closeRabbithole: handleCloseRabbithole
  }));

  return (
    <div className="h-full flex flex-col bg-white text-neutral-800 border-l border-neutral-200 shadow-lg">

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Conditional rendering based on rabbithole mode */}
        {rabbitholeMode ? (
          <RabbitholePane
            selectedText={activeRabbitholeText}
            documentId={documentId}
            conversationId={activeRabbitholeId} // For existing rabbitholes
            documentConversationId={conversationId} // Pass the main document conversation ID
            blockId={currentBlockId}
            textStartOffset={activeRabbitholeStartOffset}
            textEndOffset={activeRabbitholeEndOffset}
            onClose={handleCloseRabbithole}
            onSwitchToNotesTab={onSwitchToNotesTab}
          />
        ) : (
          <PanelGroup direction="vertical">
            {/* Content Panel */}
            <Panel defaultSize={30} minSize={20}>
              <div
                className="flex flex-col h-full w-full bg-white overflow-y-auto p-4"
                style={{
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Block Content
                    </h2>
                    <button
                      onClick={onClose}
                      className="text-gray-500 hover:text-gray-700"
                      title="Close interactive pane"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="flex-grow">
                  <BlockContainer
                    blockId={currentBlockId}
                    blockType={block.block_type.toLowerCase()}
                    htmlContent={block.html_content}
                    images={block.images || {}}
                    onAddTextToChat={handleAddTextToChat}
                    onRabbitholeClick={handleRabbitholeClick}
                    onRabbitholeCreate={handleRabbitholeCreate}
                    onRefreshRabbitholes={handleRefreshRabbitholes}
                  />
                </div>
              </div>
            </Panel>

            {/* Navigation Controls */}
            <div className="flex justify-center items-center h-8 bg-neutral-100 border-t border-b border-neutral-200">
              <div className="flex space-x-2">
                <button
                  onClick={hasPreviousBlock ? onPreviousBlock : undefined}
                  disabled={!hasPreviousBlock}
                  className="flex items-center space-x-1 py-1 px-2 rounded border border-neutral-200 bg-white"
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#4b5563',
                    cursor: hasPreviousBlock ? 'pointer' : 'not-allowed',
                    opacity: hasPreviousBlock ? 1 : 0.5,
                    transition: 'all 0.2s ease',
                    boxShadow: hasPreviousBlock ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none'
                  }}
                  title="Previous Block"
                  aria-label="Navigate to previous block"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
                  </svg>
                  <span>Previous</span>
                </button>

                <button
                  onClick={hasNextBlock ? onNextBlock : undefined}
                  disabled={!hasNextBlock}
                  className="flex items-center space-x-1 py-1 px-2 rounded border border-neutral-200 bg-white"
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#4b5563',
                    cursor: hasNextBlock ? 'pointer' : 'not-allowed',
                    opacity: hasNextBlock ? 1 : 0.5,
                    transition: 'all 0.2s ease',
                    boxShadow: hasNextBlock ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none'
                  }}
                  title="Next Block"
                  aria-label="Navigate to next block"
                >
                  <span>Next</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Resize Handle */}
            <PanelResizeHandle className="h-1 bg-neutral-200 hover:bg-neutral-300 transition-colors duration-150 cursor-row-resize flex items-center justify-center">
              <div className="w-8 h-1 bg-neutral-300 rounded-full"></div>
            </PanelResizeHandle>

            {/* Chat/Rabbithole Panel */}
            <Panel defaultSize={70}>
              {!blockIsChatEnabled ? (
                <div className="h-full flex items-center justify-center p-4 text-neutral-700 bg-white">
                  <div className="p-6 bg-neutral-50 rounded-lg border border-neutral-200 text-center max-w-md">
                    <p className="mb-2">This block type does not support chat interaction.</p>
                    <p className="text-sm text-neutral-500">Select a different block to start a conversation.</p>
                  </div>
                </div>
              ) : (
                <ChatPane
                  blockId={currentBlockId}
                  documentId={documentId}
                  conversationId={conversationId}
                  selectedText={selectedText}
                  setSelectedText={setSelectedText}
                  onSwitchToNotesTab={onSwitchToNotesTab}
                />
              )}
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );  
}

)
