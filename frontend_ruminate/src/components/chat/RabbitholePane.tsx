"use client";

import { useState, useEffect } from "react";
import { useConversation } from "../../hooks/useConversation";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { createRabbithole } from "../../services/rabbithole";

interface RabbitholePaneProps {
  selectedText: string;
  documentId: string;
  conversationId: string;
  blockId?: string; 
  textStartOffset?: number; 
  textEndOffset?: number;
  rabbitholeId?: string; 
  onClose: () => void;
}

export default function RabbitholePane({ 
  selectedText,
  documentId, 
  conversationId,
  blockId,
  textStartOffset,
  textEndOffset,
  rabbitholeId,
  onClose
}: RabbitholePaneProps) {
  const [isCreatingRabbithole, setIsCreatingRabbithole] = useState<boolean>(false);
  const [rabbitholeConversationId, setRabbitholeConversationId] = useState<string | null>(rabbitholeId || null);
  
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
    conversationId: rabbitholeConversationId || conversationId,
    blockId: rabbitholeConversationId ? undefined : blockId 
  });

  useEffect(() => {
    async function createNewRabbithole() {
      if (!rabbitholeConversationId && blockId && textStartOffset !== undefined && textEndOffset !== undefined) {
        setIsCreatingRabbithole(true);
        try {
          const newRabbitholeId = await createRabbithole({
            document_id: documentId,
            block_id: blockId,
            selected_text: selectedText,
            start_offset: textStartOffset,
            end_offset: textEndOffset,
            type: 'rabbithole'
          });
          setRabbitholeConversationId(newRabbitholeId);
        } catch (error) {
          console.error('Failed to create rabbithole:', error);
        } finally {
          setIsCreatingRabbithole(false);
        }
      }
    }
    
    createNewRabbithole();
  }, [blockId, documentId, rabbitholeConversationId, selectedText, textEndOffset, textStartOffset]);

  useEffect(() => {
    if (selectedText && !newMessage) {
      setNewMessage(`Let's dive deeper into: "${selectedText}"`);
    }
  }, [selectedText, newMessage, setNewMessage]);

  const handleSend = () => {
    sendMessage(newMessage);
  };

  return (
    <div className="h-full flex flex-col bg-white text-neutral-800 border-l border-neutral-200 shadow-lg">
      <div className="p-4 flex items-center justify-between bg-indigo-600 text-white">
        <h2 className="font-semibold">🐇 Rabbithole</h2>
        <button 
          onClick={onClose} 
          className="p-1 rounded-full hover:bg-indigo-500 text-white transition-colors duration-200"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 bg-indigo-50 border-b border-indigo-100">
          <h3 className="text-sm font-medium text-indigo-800 mb-2">Going deeper into:</h3>
          <div className="p-3 bg-white rounded-lg border border-indigo-200 text-sm">
            {selectedText}
          </div>
        </div>

        {isCreatingRabbithole && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-indigo-600 flex flex-col items-center">
              <div className="loader w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p>Creating rabbithole...</p>
            </div>
          </div>
        )}

        {!isCreatingRabbithole && (
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
                <div className="bg-indigo-50 text-neutral-800 p-3 rounded-lg shadow-sm border border-indigo-100">
                  <em>AI is exploring...</em>
                </div>
              </div>
            )}
          </div>
        )}

        {!isCreatingRabbithole && (
          <ChatInput
            value={newMessage}
            isLoading={isChatLoading}
            onChange={(e) => setNewMessage(e.target.value)}
            onSend={handleSend}
            placeholder="Ask a follow-up question..."
          />
        )}
      </div>
    </div>
  );
}