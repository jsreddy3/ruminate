import React, { useRef, useEffect } from 'react';
import MessageList from './messages/MessageList';
import ConversationHeader from './ConversationHeader';
import { Block } from '../pdf/PDFViewer';

interface ChatMessagesProps {
  messageTree: any[];
  activeThreadIds: string[];
  streamingMessageId: string | null;
  streamingContent: string;
  conversationId: string | null;
  onSwitchVersion: (messageId: string, versionIndex: number) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  documentId?: string;
  zoomLevel?: number;
  conversationType?: 'main' | 'rabbithole';
  selectedText?: string;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messageTree,
  activeThreadIds,
  streamingMessageId,
  streamingContent,
  conversationId,
  onSwitchVersion,
  onEditMessage,
  documentId,
  zoomLevel = 100,
  conversationType = 'main',
  selectedText
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messageTree, streamingContent]);


  return (
    <div 
      ref={scrollContainerRef} 
      className="flex-1 overflow-auto bg-white" 
      key={`chat-container-${conversationId || 'main'}`}
      style={{
        '--zoom-scale': zoomLevel,
        fontSize: `calc(1rem * var(--zoom-scale))`,
      } as React.CSSProperties}
    >
      <div style={{ zoom: zoomLevel }}>
        <ConversationHeader 
          conversationType={conversationType}
          selectedText={selectedText}
        />
        <MessageList 
          messages={messageTree}
          activeThreadIds={activeThreadIds}
          onSwitchVersion={(messageId) => onSwitchVersion(messageId, 0)}
          onEditMessage={onEditMessage}
          streamingMessageId={streamingMessageId}
          streamingContent={streamingContent}
          conversationId={conversationId || undefined}
          documentId={documentId}
        />
      </div>
    </div>
  );
};

export default ChatMessages;