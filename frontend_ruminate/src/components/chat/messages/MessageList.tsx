import React from 'react';
import { MessageNode, MessageRole } from '../../../types/chat';
import { AgentEvent, AgentStatus } from '../../../hooks/useAgentEventStream';
import MessageItem from './MessageItem';

interface MessageListProps {
  messages: MessageNode[];
  activeThreadIds: string[];
  streamingMessageId: string | null;
  streamingContent: string;
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  // Agent-related props (will be passed to MessageItem for per-message steps)
  agentEvents?: AgentEvent[];
  agentStatus?: AgentStatus;
  conversationId?: string | null;
  isAgentChat?: boolean;
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
  agentEvents = [],
  agentStatus = 'idle',
  conversationId = null,
  isAgentChat = false
}) => {
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
  
  // Get the events for the current message being generated
  const getCurrentEvents = (message: MessageNode) => {
    if (message.role !== MessageRole.ASSISTANT) return [];
    
    // Filter events that belong to this specific message
    // Each event should have a message_id field that matches the current message
    return agentEvents.filter(event => 
      // Match events by message_id if available
      (event.message_id && event.message_id === message.id) ||
      // If there's no message_id but this is the latest assistant message,
      // assign events without message_id to this message (for backward compatibility)
      (!event.message_id && isLatestAssistantMessage(message))
    );
  };
  
  // Helper to determine if this is the latest assistant message
  const isLatestAssistantMessage = (message: MessageNode): boolean => {
    const assistantMessages = displayMessages.filter(msg => msg.role === MessageRole.ASSISTANT);
    return assistantMessages.length > 0 && assistantMessages[assistantMessages.length - 1].id === message.id;
  };
  
  return (
    <div className="p-4 space-y-4">
      {/* Loop through active thread messages */}
      {displayMessages.map(message => {
        // Determine if this message should be streaming
        // Either it has the exact streaming ID or it's a temporary assistant message
        const isMessageStreaming = 
          message.id === streamingMessageId || 
          (!!streamingMessageId && message.id.startsWith('temp-assistant-'));
          
        return (
          <MessageItem
            key={message.id}
            message={message}
            isActive={true}
            isStreaming={isMessageStreaming}
            streamingContent={isMessageStreaming ? streamingContent : null}
            versions={getMessageVersions(message.id)}
            onSwitchVersion={onSwitchVersion}
            onEditMessage={onEditMessage}
            agentEvents={getCurrentEvents(message)}
            agentStatus={agentStatus}
            conversationId={conversationId}
            isAgentChat={isAgentChat}
          />
        );
      })}
    </div>
  );
};

export default MessageList; 