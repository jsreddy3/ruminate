"use client";

import { useState, useEffect } from "react";
import { useConversation } from "../../../hooks/useConversation";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

interface ChatPaneProps {
  blockId: string;     // Blocks need a specific ID
  documentId: string;  // Document ID is required
  conversationId?: string; // Conversation ID can be undefined (new conversation)
  selectedText?: string;
  setSelectedText?: (text: string) => void;
  onSwitchToNotesTab?: () => void; // Callback to switch to notes tab
}

/**
 * ChatPane component that handles displaying and managing a conversation
 * This is focused solely on chat functionality, not block content
 */
export default function ChatPane({ 
  blockId,
  documentId, 
  conversationId = "", // Default to empty string for new conversations
  selectedText = "",
  setSelectedText,
  onSwitchToNotesTab
}: ChatPaneProps) {
  // Initialize conversation with current block and document
  const {
    displayedThread,
    messagesById,
    isLoading,
    editingMessageId,
    editingContent,
    newMessage,
    setNewMessage,
    sendMessage,
    handleSaveEditStreaming: handleSaveEdit,
    handleVersionSwitch,
    setEditingMessageId,
    setEditingContent
  } = useConversation({
    documentId,
    conversationId, // Now defaults to empty string above
    blockId         // BlockId is required in props, so safe to pass directly
  });

  // Use selected text when it changes
  useEffect(() => {
    if (selectedText && selectedText.trim()) {
      setNewMessage((prev) => {
        // If there's already text, add a space
        const prefix = prev ? `${prev} ` : '';
        return `${prefix}"${selectedText}"`;
      });
      
      // Clear the selected text after using it
      if (setSelectedText) {
        setSelectedText("");
      }
    }
  }, [selectedText, setNewMessage, setSelectedText]);

  // Wrapper function to pass to ChatInput
  // Reads content from the 'newMessage' state variable
  const handleSendMessage = () => {
    if (!newMessage.trim()) return; 
    // Pass the current blockId as context and the content from state
    sendMessage(newMessage, blockId);
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-white">
      <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-700">Discussion</h3>
        <div className="text-xs text-neutral-500">
          {blockId.substring(0, 8)}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 px-5 py-4 overflow-y-auto space-y-5 bg-white messages-container">
        {displayedThread
          .filter((message) => message.role !== "system")
          .map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              editingMessageId={editingMessageId}
              editingContent={editingContent}
              isLoading={isLoading}
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
              // Props for note generation
              documentId={documentId}
              blockId={blockId}
              conversationId={conversationId || ""}
              onSwitchToNotesTab={onSwitchToNotesTab}
            />
          ))}
      </div>

      {/* Input area */}
      <ChatInput
        value={newMessage}
        isLoading={isLoading}
        onChange={(e) => setNewMessage(e.target.value)}
        onSend={handleSendMessage} // Reverted prop name to match ChatInput definition
      />
    </div>
  );
}
