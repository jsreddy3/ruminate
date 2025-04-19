import React, { useEffect, useRef } from "react";
import ConversationPane from "./ConversationPane";
import { useConversation } from "../../../hooks/useConversation";
import { useAgentConversation } from "../../../hooks/useAgentConversation";
import ChatInput from "../chat/ChatInput";
import ChatMessage from "../chat/ChatMessage";
import AgentMessage from "../rabbithole/components/AgentConversation/AgentMessage";
import ExplorationPanel from "../rabbithole/components/AgentConversation/ExplorationEvents/ExplorationPanel";
import type { Message } from "../../../types/chat";
import type { AgentEvent } from "../../../services/rabbithole";

interface UnifiedConversationProps {
  mode: "chat" | "agent";
  blockId: string;
  documentId: string;
  conversationId?: string;
  onSwitchToNotesTab?: () => void;
  onClose?: () => void;
}

export default function UnifiedConversation({
  mode,
  blockId,
  documentId,
  conversationId = "",
  onSwitchToNotesTab,
  onClose
}: UnifiedConversationProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const chatHook = useConversation({ documentId, conversationId, blockId });
  // Only enable agent SSE when in agent mode
  const agentConversationId = mode === 'agent' && conversationId ? conversationId : null;
  const agentHook = useAgentConversation({ documentId, conversationId: agentConversationId });

  // unify hook output
  // pick the hook first
const activeHook = mode === "chat" ? chatHook : agentHook;

// pull common fields
const {
  displayedThread,
  isLoading,
  sendMessage,
  newMessage,
  setNewMessage,
  editingMessageId,
  editingContent,
  setEditingMessageId,
  setEditingContent,
  handleVersionSwitch,
  messagesById,
} = activeHook as typeof chatHook & Partial<typeof agentHook>; // cast for TS inference

const handleSaveEdit = (msgId: string) => {
  if (mode === "chat") {
    chatHook.handleSaveEditStreaming(msgId);            // chat path
  } else {
    console.log(`Editing content ${editingContent} from id ${msgId}`);
    agentHook.handleSaveEditAgent(msgId, editingContent); // agent path
  }
};


  // Agent exploration events state
  const { currentEvents, agentStatus } = agentHook;

  const getAgentEvents = (id: string): AgentEvent[] => {
    if (mode !== "agent") return [];
    const lastMessageId = displayedThread[displayedThread.length - 1]?.id;
    // Show real-time events for the currently streaming message
    if (isLoading && id === lastMessageId) {
      return agentHook.currentEvents;
    }
    // Otherwise, show stored events
    return agentHook.getEventsForMessage(id);
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        messagesContainerRef.current?.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [displayedThread.length, isLoading]);

  const header = (
    <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        {mode === "agent" && onClose && (
          <button onClick={onClose} className="text-indigo-600 hover:text-indigo-800 focus:outline-none">
            ← Back
          </button>
        )}
        <h3 className="text-sm font-medium text-neutral-700">
          {mode === "chat" ? 'Discussion' : 'Rabbithole'}
        </h3>
      </div>
      <div className="text-xs text-neutral-500">{blockId.slice(0, 8)}</div>
    </div>
  );

  const body = (
    <div ref={messagesContainerRef} className="flex-1 px-5 py-4 overflow-y-auto space-y-5 bg-white messages-container">
      {displayedThread
        .filter((m: Message) => m.role !== "system")
        .map((m: Message) =>
          mode === "agent" && m.role === "assistant" ? (
            <AgentMessage
              key={m.id}
              message={m}
              conversationId={conversationId}
              events={getAgentEvents(m.id)}
              isLoading={
                agentStatus === "exploring" &&
                m.id === displayedThread[displayedThread.length - 1]?.id
              }
              documentId={documentId}
              blockId={blockId}
              onSwitchToNotesTab={onSwitchToNotesTab}
            />
          ) : (
            <ChatMessage
              key={m.id}
              message={m}
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
              documentId={documentId}
              blockId={blockId}
              conversationId={conversationId}
              onSwitchToNotesTab={onSwitchToNotesTab}
            />
          )
        )}
      {/* Initial loading spinner when no messages */}
      {isLoading && displayedThread.length === 0 && (
        <div className="flex-1 flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      )}
      {/* Agent exploration indicator and events */}
      {mode === "agent" && agentStatus === "exploring" && (
        <div className="px-5 py-2">
          <div className="text-gray-500 text-sm italic mb-2">Agent is exploring...</div>
          {currentEvents.length > 0 && (
            <ExplorationPanel events={currentEvents} isExpanded={true} />
          )}
        </div>
      )}
    </div>
  );

  const input = (
    <ChatInput
      value={newMessage}
      isLoading={isLoading}
      onChange={(e) => setNewMessage(e.target.value)}
      onSend={() => {
        if (!newMessage.trim()) return;
        if (mode === 'chat') sendMessage(newMessage, blockId);
        else sendMessage(newMessage);
        setNewMessage('');
      }}
      placeholder={mode === 'agent' ? 'Ask a follow-up question...' : undefined}
    />
  );

  return <ConversationPane header={header} body={body} input={input} />;
}
