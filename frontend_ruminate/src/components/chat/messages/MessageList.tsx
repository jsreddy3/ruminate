import React, { useEffect } from 'react';
import { MessageNode, MessageRole } from '../../../types/chat';
import MessageItem from './MessageItem';
import { AgentEvent } from '../../../hooks/useAgentEventStream';
import LiveAgentStepsPane from '../agent/LiveAgentStepsPane';

interface MessageListProps {
  messages: MessageNode[];
  activeThreadIds: string[];
  streamingMessageId: string | null;
  streamingContent: string;
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  isAgentChat?: boolean;
  conversationId?: string;
  agentEvents?: AgentEvent[];
  agentStatus?: string;
}

/**
 * Renders the list of messages in the current active thread
 */
const MessageList: React.FC<MessageListProps> = ({
  messages,
  activeThreadIds,
  streamingMessageId,
  streamingContent,
  onSwitchVersion,
  onEditMessage,
  isAgentChat = false,
  conversationId,
  agentEvents = [],
  agentStatus = 'idle'
}) => {
  // Add debugging logs for agent status and events
  useEffect(() => {
    console.log("MessageList render with:", {
      isAgentChat,
      agentStatus,
      eventsCount: agentEvents.length,
      hasMessages: activeThreadIds.length > 0
    });
  }, [isAgentChat, agentStatus, agentEvents.length, activeThreadIds.length]);

  // Helper function to find a message in the tree by ID
  const findMessageById = (id: string, nodes: MessageNode[]): MessageNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      
      if (node.children.length > 0) {
        const found = findMessageById(id, node.children);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  // Flatten the active thread for display
  const activeThread = activeThreadIds.map(id => findMessageById(id, messages)).filter(Boolean) as MessageNode[];
  
  // Check if we have child versions for any active message
  const getMessageVersions = (messageId: string): MessageNode[] => {
    const parent = activeThread.find(msg => 
      msg.children.some(child => child.id === messageId)
    );
    
    if (!parent) return [];
    return parent.children;
  };
  
  // Empty state
  if (activeThread.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No messages yet. Start the conversation by sending a message.</p>
      </div>
    );
  }
  
  // Filter out system messages for display
  const displayMessages = activeThread.filter(message => message.role !== MessageRole.SYSTEM);
  
  // Find the last assistant message for placing live events pane before it
  const lastAssistantMessageIndex = displayMessages.length > 0 
    ? displayMessages.map(m => m.role).lastIndexOf(MessageRole.ASSISTANT)
    : -1;
    
  // Debug last assistant message
  console.log("MessageList: lastAssistantMessageIndex =", lastAssistantMessageIndex);
  if (lastAssistantMessageIndex >= 0) {
    console.log("Last assistant message:", displayMessages[lastAssistantMessageIndex].id);
  }
  
  // Debug the live pane condition
  const shouldShowLivePane = isAgentChat && agentStatus === 'exploring' && lastAssistantMessageIndex >= 0;
  console.log("Should show live pane?", shouldShowLivePane, {
    isAgentChat,
    agentStatus,
    lastAssistantMessageIndex,
    eventsCount: agentEvents.length
  });
  
  return (
    <div className="p-4 space-y-4">
      {/* Loop through active thread messages */}
      {displayMessages.map((message, index) => {
        // Determine if this message should be streaming
        // Either it has the exact streaming ID or it's a temporary assistant message
        const isMessageStreaming = 
          message.id === streamingMessageId || 
          (!!streamingMessageId && message.id.startsWith('temp-assistant-'));
          
        return (
          <React.Fragment key={message.id}>
            {/* Show agent events pane right before the last assistant message */}
            {shouldShowLivePane && index === lastAssistantMessageIndex && (
              <LiveAgentStepsPane events={agentEvents} />
            )}
            <MessageItem
              message={message}
              isActive={true}
              isStreaming={isMessageStreaming}
              streamingContent={isMessageStreaming ? streamingContent : null}
              versions={getMessageVersions(message.id)}
              onSwitchVersion={onSwitchVersion}
              onEditMessage={onEditMessage}
              isAgentChat={isAgentChat}
              conversationId={conversationId}
              agentEvents={[]} // No longer need per-message events here
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default MessageList; 