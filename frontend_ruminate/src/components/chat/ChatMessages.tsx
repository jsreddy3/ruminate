import React, { useRef, useEffect } from 'react';
import MessageList from './messages/MessageList';
import { Block } from '../pdf/PDFViewer';

interface ChatMessagesProps {
  messageTree: any[];
  activeThreadIds: string[];
  streamingMessageId: string | null;
  streamingContent: string;
  conversationId: string | null;
  onSwitchVersion: (messageId: string, versionIndex: number) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messageTree,
  activeThreadIds,
  streamingMessageId,
  streamingContent,
  conversationId,
  onSwitchVersion,
  onEditMessage
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messageTree.length, streamingContent]);

  return (
    <div 
      ref={scrollContainerRef} 
      className="flex-1 overflow-auto bg-white" 
      key={`chat-container-${conversationId || 'main'}`}
    >
      <MessageList 
        messages={messageTree}
        activeThreadIds={activeThreadIds}
        onSwitchVersion={onSwitchVersion}
        onEditMessage={onEditMessage}
        streamingMessageId={streamingMessageId}
        streamingContent={streamingContent}
        conversationId={conversationId || undefined}
      />
    </div>
  );
};

export default ChatMessages;