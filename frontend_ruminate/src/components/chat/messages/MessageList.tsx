import React, { useEffect, useRef } from 'react';
import { MessageNode, MessageRole, GeneratedSummary } from '../../../types/chat';
import MessageItem from './MessageItem';
import SummaryCard from './SummaryCard';

interface MessageListProps {
  messages: MessageNode[];
  activeThreadIds: string[];
  streamingMessageId: string | null;
  streamingContent: string;
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  conversationId?: string;
  documentId?: string;
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
  conversationId,
  documentId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
  
  return (
    <div className="p-4 space-y-4">
      {displayMessages.map((message, index) => {
        // Determine if this message should be streaming
        const isMessageStreaming = message.id === streamingMessageId;
        
        // Check if this assistant message has generated summaries
        const hasSummaries = message.role === MessageRole.ASSISTANT && 
                            message.meta_data?.generated_summaries && 
                            message.meta_data.generated_summaries.length > 0;
        
        const summaries = hasSummaries ? message.meta_data.generated_summaries : [];
          
        return (
          <React.Fragment key={message.id}>
            <MessageItem
              message={message}
              isActive={true}
              isStreaming={isMessageStreaming}
              streamingContent={isMessageStreaming ? streamingContent : null}
              versions={getMessageVersions(message.id)}
              onSwitchVersion={onSwitchVersion}
              onEditMessage={onEditMessage}
              conversationId={conversationId}
            />
            
            {/* Insert summary cards after assistant messages that have summaries */}
            {hasSummaries && summaries.map((summary: GeneratedSummary) => (
              <SummaryCard
                key={summary.note_id}
                summary={summary}
              />
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default MessageList; 