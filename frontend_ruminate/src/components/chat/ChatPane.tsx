"use client";

import type { ChatPaneProps } from "../../types/chat";
import { useConversation } from "../../hooks/useConversation";
import { useInsights } from "../../hooks/useInsights";
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
  conversationId: existingConversationId,
  onConversationCreated,
  onClose 
}: ChatPaneProps) {
  const {
    conversationId,
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
    blockId: block.id,
    existingConversationId,
    onConversationCreated,
  });

  const {
    currentBlockInsight,
    isLoading: isInsightLoading,
    error: insightError,
    analyzeBlock
  } = useInsights({
    documentId,
    blockId: block.id
  });

  const handleSend = () => {
    sendMessage(newMessage);
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

      {/* Block Content Display with Insights */}
      <BlockContent 
        html_content={block.html_content} 
        block_type={block.block_type} 
        images={block.images}
        highlights={currentBlockInsight?.annotations.map(a => ({
          phrase: a.phrase,
          insight: a.insight
        }))}
      />

      {/* Chat area */}
      {blockIsChatEnabled ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-white messages-container">
            {/* Show insight summary if available */}
            {currentBlockInsight && (
              <div className="bg-primary-50 p-3 rounded-lg shadow-sm border border-primary-100 mb-4">
                <p className="text-sm font-medium text-primary-900 mb-1">AI Analysis</p>
                <p className="text-sm text-primary-800 whitespace-pre-wrap">{currentBlockInsight.insight}</p>
              </div>
            )}

            {/* Show text annotations only for text blocks */}
            {block.block_type?.toLowerCase() === 'text' && currentBlockInsight?.annotations?.length > 0 && (
              <div className="border-t border-neutral-200 pt-4 mt-4">
                <p className="text-sm font-medium text-neutral-900 mb-2">Key Phrases</p>
                <div className="space-y-2">
                  {currentBlockInsight.annotations.map((annotation, idx) => (
                    <div key={idx} className="bg-neutral-50 p-2 rounded border border-neutral-200">
                      <p className="text-sm font-medium text-primary-800">{annotation.phrase}</p>
                      <p className="text-sm text-neutral-600 mt-1">{annotation.insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            isLoading={isChatLoading || isInsightLoading}
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
