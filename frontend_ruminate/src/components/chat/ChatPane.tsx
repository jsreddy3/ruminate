"use client";

import { useState, useEffect } from "react";
import type { ChatPaneProps } from "../../types/chat";
import { useConversation } from "../../hooks/useConversation";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import BlockContent from "./BlockContent";

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
  onClose 
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
    editingMessageId,
    editingContent,
    newMessage,
    setNewMessage,
    sendMessage,
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
    sendMessage(newMessage, currentBlockId);
  };

  // Update the condition to check against supported types
  const blockIsChatEnabled = block.block_type && 
    chatEnabledBlockTypes.includes(block.block_type.toLowerCase());

  return (
    <div className="h-full flex flex-col bg-white text-neutral-800 border-l border-neutral-200 shadow-lg">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-neutral-50 border-b border-neutral-200">
        <h2 className="font-semibold text-neutral-800">Block Chat</h2>
        <button 
          onClick={onClose} 
          className="p-1 rounded-full hover:bg-neutral-200 text-neutral-500 hover:text-neutral-700 transition-colors duration-200"
        >
          ✕
        </button>
      </div>

      {/* Block Content Display */}
      <BlockContent 
        html_content={block.html_content} 
        block_type={block.block_type} 
        images={block.images}
        highlights={[]}
      />

      {/* Chat area */}
      {blockIsChatEnabled ? (
        <div className="flex-1 flex flex-col min-h-0">
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
            {isChatLoading && (
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
        <div className="p-4 text-neutral-700">
          This block type does not support chat interaction.
        </div>
      )}
    </div>
  );
}
