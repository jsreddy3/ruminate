"use client";

import { useState, useEffect, useRef } from "react";
import { useConversation } from "../../../hooks/useConversation";
import ChatMessage from "../chat/ChatMessage";
import ChatInput from "../chat/ChatInput";
import { createRabbithole } from "../../../services/rabbithole";

interface RabbitholePaneProps {
  selectedText: string;
  documentId: string;
  conversationId?: string;
  documentConversationId?: string;
  blockId?: string; 
  textStartOffset?: number; 
  textEndOffset?: number;
  onClose: () => void;
}

export default function RabbitholePane({ 
  selectedText,
  documentId, 
  conversationId,
  documentConversationId,
  blockId,
  textStartOffset,
  textEndOffset,
  onClose
}: RabbitholePaneProps) {
  const [isCreatingRabbithole, setIsCreatingRabbithole] = useState<boolean>(false);
  const [rabbitholeConversationId, setRabbitholeConversationId] = useState<string | null>(conversationId || null);
  
  // Debug logging
  useEffect(() => {
    console.log("RabbitholePane: Initial state", {
      selectedText,
      documentId,
      conversationId,
      blockId,
      textStartOffset,
      textEndOffset,
      rabbitholeConversationId
    });
  }, []);
  
  // Use the conversation hook with the appropriate ID
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
    conversationId: conversationId || rabbitholeConversationId || "",
    blockId: blockId
  });

  useEffect(() => {
    if (conversationId) {
      console.log('Using existing rabbithole conversation:', conversationId, {
        selectedText,
        textStartOffset,
        textEndOffset,
        blockId
      });
      setRabbitholeConversationId(conversationId);
      return;
    }
    
    // Skip if we're already creating a rabbithole or have an ID generated
    if (isCreatingRabbithole || rabbitholeConversationId) {
      console.log('Skipping rabbithole creation - already creating or have ID:', {
        isCreatingRabbithole,
        rabbitholeConversationId
      });
      return;
    }
    
    async function createNewRabbithole() {
      // Check if we have all the data we need
      if (!blockId || textStartOffset === undefined || textEndOffset === undefined) {
        console.log("Missing data required to create rabbithole:", {
          blockId, 
          textStartOffset, 
          textEndOffset
        });
        return;
      }
      
      console.log('Creating new rabbithole conversation with details:', {
        documentId,
        blockId,
        selectedText,
        textStartOffset,
        textEndOffset,
        conversationId,
        documentConversationId
      });
      setIsCreatingRabbithole(true);
      
      try {
        const newRabbitholeId = await createRabbithole({
          document_id: documentId,
          block_id: blockId,
          selected_text: selectedText,
          start_offset: textStartOffset,
          end_offset: textEndOffset,
          type: 'rabbithole',
          document_conversation_id: documentConversationId
        });
        
        console.log('Created rabbithole with ID:', newRabbitholeId);
        setRabbitholeConversationId(newRabbitholeId);
      } catch (error) {
        console.error('Failed to create rabbithole:', error);
      } finally {
        setIsCreatingRabbithole(false);
      }
    }
    
    // Only create a new rabbithole if we don't have a conversation ID
    createNewRabbithole();
  }, [blockId, documentId, conversationId, isCreatingRabbithole, rabbitholeConversationId, selectedText, textEndOffset, textStartOffset]);

  // Track whether we've initialized the message
  const hasSetInitialMessage = useRef(false);

  useEffect(() => {
    if (selectedText && !hasSetInitialMessage.current) {
      setNewMessage(`Explain this: "${selectedText}"`);
      hasSetInitialMessage.current = true;
    }
  }, [selectedText]);

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