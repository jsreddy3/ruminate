"use client";

import { useState, useEffect } from "react";
import type { ChatPaneProps } from "../../types/chat";
import { useConversation } from "../../hooks/useConversation";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import BlockContent from "./BlockContent";
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

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

export default function ChatPane({ 
  block, 
  documentId, 
  conversationId,
  onClose,
  onNextBlock,
  onPreviousBlock,
  hasNextBlock,
  hasPreviousBlock
}: ChatPaneProps) {
  // Track current block ID to handle block changes without remounting
  const [currentBlockId, setCurrentBlockId] = useState(block.id);

  // Update currentBlockId when block prop changes
  useEffect(() => {
    setCurrentBlockId(block.id);
  }, [block.id]);

  const {
    messageTree,
    displayedThread,
    messagesById,
    isLoading: isChatLoading,
    isStreaming,
    streamingMessage,
    editingMessageId,
    editingContent,
    newMessage,
    setNewMessage,
    sendMessage,
    sendStreamingMessage,
    cancelStreaming,
    handleSaveEdit,
    handleVersionSwitch,
    setEditingMessageId,
    setEditingContent,
    setDisplayedThread
  } = useConversation({
    documentId,
    conversationId,
    blockId: currentBlockId, // Use the state variable instead of direct prop
  });

  const handleSend = () => {
    sendStreamingMessage(newMessage, currentBlockId);
  };

  // Update the condition to check against supported types
  const blockIsChatEnabled = block.block_type && 
    chatEnabledBlockTypes.includes(block.block_type.toLowerCase());

  // Add a function to handle adding text to chat input
  const handleAddTextToChat = (text: string) => {
    setNewMessage((prev) => {
      // If there's already text, add a space
      const prefix = prev ? `${prev} ` : '';
      return `${prefix}"${text}"`;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white text-neutral-800 border-l border-neutral-200 shadow-lg">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-neutral-50 border-b border-neutral-200">
        <h2 className="font-semibold text-neutral-800">Block Content & Chat</h2>
        <button 
          onClick={onClose} 
          className="p-1 rounded-full hover:bg-neutral-200 text-neutral-500 hover:text-neutral-700 transition-colors duration-200"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Resizable Panels */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PanelGroup direction="vertical">
          {/* Block Content Panel */}
          <Panel 
            defaultSize={30} 
            minSize={15} 
            maxSize={70}
          >
            <div className="h-full flex flex-col bg-neutral-50">
              <div className="flex-1 overflow-auto">
                <div className="px-4 py-2">
                  <BlockContent 
                    html_content={block.html_content} 
                    block_type={block.block_type} 
                    images={block.images}
                    highlights={[]}
                    onAddTextToChat={handleAddTextToChat}
                  />
                </div>
              </div>
              
              {/* Navigation buttons with inline styles */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '8px 0',
                borderTop: '1px solid #e5e5e5',
                backgroundColor: '#f9f9f9'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <button 
                    onClick={onPreviousBlock} 
                    disabled={!hasPreviousBlock}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      backgroundColor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
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
                    onClick={onNextBlock} 
                    disabled={!hasNextBlock}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      backgroundColor: 'white',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
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
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="h-1 bg-neutral-200 hover:bg-neutral-300 transition-colors duration-150 cursor-row-resize flex items-center justify-center">
            <div className="w-8 h-1 bg-neutral-300 rounded-full"></div>
          </PanelResizeHandle>

          {/* Chat Panel */}
          <Panel defaultSize={70}>
            {blockIsChatEnabled ? (
              <div className="h-full flex flex-col min-h-0 border-t border-neutral-200">
                <div className="p-3 bg-neutral-100 border-b border-neutral-200">
                  <h3 className="text-sm font-medium text-neutral-700">Discussion</h3>
                </div>
                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-white messages-container">
                  {displayedThread
                    .filter((message) => message.role !== "system")
                    .map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        editingMessageId={editingMessageId}
                        editingContent={editingContent}
                        isLoading={isChatLoading}
                        messagesById={messagesById}
                        onStartEdit={(msg) => {
                          setEditingMessageId(msg.id);
                          setEditingContent(msg.content);
                        }}
                        onChangeEdit={setEditingContent}
                        onCancelEdit={() => {
                          setEditingMessageId(null);
                          setEditingContent("");
                        }}
                        onSaveEdit={handleSaveEdit}
                        onVersionSwitch={handleVersionSwitch}
                      />
                    ))}
                  
                  {/* Streaming response */}
                  {isStreaming && streamingMessage && (
                    <div className="flex justify-start">
                      <div className="bg-primary-50 text-neutral-800 p-3 rounded-lg shadow-sm border border-primary-100 max-w-[80%]">
                        <div className="prose prose-sm">
                          {streamingMessage}
                          <span className="inline-block animate-pulse">▌</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Loading indicator */}
                  {isChatLoading && !isStreaming && (
                    <div className="flex justify-start">
                      <div className="bg-primary-50 text-neutral-800 p-3 rounded-lg shadow-sm border border-primary-100">
                        <em>AI is typing...</em>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <ChatInput
                  value={newMessage}
                  isLoading={isChatLoading}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onSend={handleSend}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-4 text-neutral-700 bg-white">
                <div className="p-6 bg-neutral-50 rounded-lg border border-neutral-200 text-center max-w-md">
                  <p className="mb-2">This block type does not support chat interaction.</p>
                  <p className="text-sm text-neutral-500">Select a different block to start a conversation.</p>
                </div>
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
