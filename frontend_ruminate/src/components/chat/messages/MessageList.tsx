import React from 'react';
import { MessageNode } from '../../../types/chat';
import MessageItem from './MessageItem';
import StreamingMessage from './StreamingMessage';

interface MessageListProps {
  messages: MessageNode[];
  activeThreadIds: string[];
  streamingMessageId: string | null;
  streamingContent: string;
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
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
  onEditMessage
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
  
  return (
    <div className="p-4 space-y-4">
      {/* Loop through active thread messages */}
      {activeThread.map(message => (
        <MessageItem
          key={message.id}
          message={message}
          isActive={true}
          versions={getMessageVersions(message.id)}
          onSwitchVersion={onSwitchVersion}
          onEditMessage={onEditMessage}
        />
      ))}
      
      {/* Show streaming content if there's an active streaming message */}
      {streamingMessageId && (
        <StreamingMessage 
          messageId={streamingMessageId} 
          content={streamingContent}
        />
      )}
    </div>
  );
};

export default MessageList; 