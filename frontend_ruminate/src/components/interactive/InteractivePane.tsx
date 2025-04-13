"use client";

import { useState, useEffect } from "react";
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

export default function InteractivePane({ 
  block, 
  documentId, 
  conversationId,
  onClose,
  onNextBlock,
  onPreviousBlock,
  hasNextBlock,
  hasPreviousBlock
}: ChatPaneProps) {
  console.log(`InteractivePane MOUNT with block ID: ${block.id}`);
  
  // Add cleanup log in useEffect
  useEffect(() => {
    return () => {
      console.log(`InteractivePane UNMOUNT with block ID: ${block.id}`);
    };
  }, [block.id]);
  
  // Track current block ID to handle block changes without remounting
  const [currentBlockId, setCurrentBlockId] = useState(block.id);

  // Update currentBlockId when block prop changes
  useEffect(() => {
    console.log(`InteractivePane UPDATE with block ID: ${block.id}`);
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
  
  // Function to handle adding text to chat from the block content
  const handleAddTextToChat = (text: string) => {
    setSelectedText(text);
  };
  
  // Function to handle creating a new rabbithole from selected text
  const handleRabbitholeCreate = (text: string, startOffset: number, endOffset: number) => {
    console.log('InteractivePane.handleRabbitholeCreate called with:', {
      text,
      startOffset,
      endOffset
    });
    
    // Set the active rabbithole information
    setActiveRabbitholeText(text);
    setActiveRabbitholeStartOffset(startOffset);
    setActiveRabbitholeEndOffset(endOffset);
    
    // Switch to rabbithole mode - no ID yet, RabbitholePane will create one
    setRabbitholeMode(true);
    
    // We don't set activeRabbitholeId because it will be created by RabbitholePane
  };
  
  // Function to handle rabbithole click
  const handleRabbitholeClick = (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => {
    console.log('InteractivePane.handleRabbitholeClick called with:', {
      rabbitholeId,
      selectedText,
      startOffset,
      endOffset
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
  };

  // Update the condition to check against supported types
  const blockIsChatEnabled = block.block_type && 
    chatEnabledBlockTypes.includes(block.block_type.toLowerCase());

  return (
    <div className="h-full flex flex-col bg-white text-neutral-800 border-l border-neutral-200 shadow-lg">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-neutral-50 border-b border-neutral-200">
        <h2 className="font-semibold text-neutral-800">Block Content & Chat</h2>
        <button 
          onClick={onClose} 
          className="p-1 rounded-full hover:bg-neutral-200 text-neutral-600 transition-colors duration-200"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Conditional rendering based on rabbithole mode */}
        {rabbitholeMode ? (
          <RabbitholePane
            selectedText={activeRabbitholeText}
            documentId={documentId}
            conversationId={activeRabbitholeId}
            blockId={currentBlockId}
            textStartOffset={activeRabbitholeStartOffset}
            textEndOffset={activeRabbitholeEndOffset}
            onClose={handleCloseRabbithole}
          />
        ) : (
          <PanelGroup direction="vertical">
            {/* Block Content Panel */}
            <Panel defaultSize={30} minSize={15}>
              <div className="h-full overflow-auto bg-white border-b border-neutral-200">
                <div className="p-4">
                  <BlockContainer 
                    blockId={block.id}
                    blockType={block.block_type}
                    htmlContent={block.html_content}
                    images={block.images}
                    onAddTextToChat={handleAddTextToChat} 
                    onRabbitholeClick={handleRabbitholeClick}
                    onRabbitholeCreate={handleRabbitholeCreate}
                  />
                  
                  {/* Navigation Controls */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-neutral-500">
                        {blockIsChatEnabled ? 'You can chat about this block content' : 'This block type does not support chat'}
                      </div>
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
                  </div>
                </div>
              </div>
            </Panel>

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
                />
              )}
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
