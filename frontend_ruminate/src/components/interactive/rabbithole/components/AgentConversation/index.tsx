// src/components/interactive/rabbithole/components/AgentConversation/index.tsx
import { useState, useEffect, useRef } from "react";
import { useAgentConversation } from "../../../../../hooks/useAgentConversation";
import ChatInput from "../../../chat/ChatInput";
import AgentMessage from "./AgentMessage";
import UserMessage from "./UserMessage";
import ExplorationPanel from "./ExplorationEvents/ExplorationPanel";

interface AgentConversationProps {
  conversationId: string | null;
  documentId: string;
  initialMessageDraft?: string;
}

export default function AgentConversation({
  conversationId,
  documentId,
  initialMessageDraft = ""
}: AgentConversationProps) {
  const [newMessage, setNewMessage] = useState(initialMessageDraft);
  
  // Use our custom agent conversation hook
  const {
    displayedThread,
    isLoading,
    sendMessage,
    currentEvents,
    getEventsForMessage,
    agentStatus
  } = useAgentConversation({
    documentId,
    conversationId
  });
    
  // No auto-send, just pre-populate the message field
  
  const handleSend = () => {
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage("");
    }
  };
  
  return (
    <>
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-white messages-container">
        {displayedThread
          .filter(message => message.role !== "system")
          .map(message => (
            message.role === "assistant" ? (
              <AgentMessage
                key={message.id}
                message={message}
                conversationId={conversationId || ""}
                events={getEventsForMessage(message.id)}
                isLoading={isLoading && message.id === displayedThread[displayedThread.length - 1]?.id}
              />
            ) : (
              <UserMessage
                key={message.id}
                message={message}
              />
            )
          ))}
        
        {isLoading && agentStatus === 'exploring' && (
          <ExplorationPanel
            events={currentEvents}
            isExpanded={true}
          />
        )}
      </div>
      
      <ChatInput
        value={newMessage}
        isLoading={isLoading}
        onChange={(e) => setNewMessage(e.target.value)}
        onSend={handleSend}
        placeholder="Ask a follow-up question..."
      />
    </>
  );
}