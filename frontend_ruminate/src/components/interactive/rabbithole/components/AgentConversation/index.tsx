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
  blockId?: string;
  initialMessageDraft?: string;
  onSwitchToNotesTab?: () => void;
}

export default function AgentConversation({
  conversationId,
  documentId,
  blockId,
  initialMessageDraft = "",
  onSwitchToNotesTab
}: AgentConversationProps) {
  const [newMessage, setNewMessage] = useState(initialMessageDraft);
  
  // Reference to the messages container for auto-scrolling
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
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
  
  // Auto-scroll when new events or messages are added
  useEffect(() => {
    if (messagesContainerRef.current && (isLoading || displayedThread.length > 0)) {
      const container = messagesContainerRef.current;
      // Smooth scrolling with a slight delay to ensure content is rendered
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [currentEvents.length, displayedThread.length, isLoading]);
  
  return (
    <>
      <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-white messages-container">
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
                documentId={documentId}
                blockId={blockId || ''} // Ensure blockId is always a string
                onSwitchToNotesTab={onSwitchToNotesTab}
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