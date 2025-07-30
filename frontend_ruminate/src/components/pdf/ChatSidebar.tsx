import React from 'react';
import { Block } from './PDFViewer';
import ChatContainer from '../chat/ChatContainer';

interface RabbitholeConversation {
  id: string;
  title: string;
  selectionText: string;
  blockId: string;
}

interface ChatSidebarProps {
  documentId: string;
  selectedBlock: Block | null;
  mainConversationId: string | null;
  activeConversationId: string | null;
  rabbitholeConversations: RabbitholeConversation[];
  pendingChatText: string;
  onSetActiveConversationId: (id: string | null) => void;
  onSetRabbitholeConversations: (conversations: RabbitholeConversation[] | ((prev: RabbitholeConversation[]) => RabbitholeConversation[])) => void;
  onTextAdded: () => void;
  onBlockSelectionRequest: (config: { prompt: string; onComplete: (blockId: string) => void }) => void;
  onUpdateBlockMetadata: (blockId: string, newMetadata: any) => void;
  onFetchBlocks: () => void;
  onOpenBlockWithNote: (blockId: string, noteId: string) => void;
  getBlockMetadata: (blockId: string) => any;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  documentId,
  selectedBlock,
  mainConversationId,
  activeConversationId,
  rabbitholeConversations,
  pendingChatText,
  onSetActiveConversationId,
  onSetRabbitholeConversations,
  onTextAdded,
  onBlockSelectionRequest,
  onUpdateBlockMetadata,
  onFetchBlocks,
  onOpenBlockWithNote,
  getBlockMetadata,
}) => {
  // Transform data for ConversationCodex
  const conversations = [
    {
      id: null,
      title: 'Main Discussion',
      type: 'main' as const,
      isActive: activeConversationId === null
    },
    ...rabbitholeConversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      type: 'rabbithole' as const,
      selectionText: conv.selectionText,
      isActive: activeConversationId === conv.id
    }))
  ];

  const handleConversationClose = (id: string) => {
    onSetRabbitholeConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      onSetActiveConversationId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat container */}
      <div className="flex-1 overflow-hidden">
        {activeConversationId === null ? (
          mainConversationId ? (
            <ChatContainer 
              key={`main-chat-${mainConversationId}`}
              documentId={documentId}
              selectedBlock={selectedBlock}
              conversationId={mainConversationId}
              pendingText={pendingChatText}
              onTextAdded={onTextAdded}
              onRequestBlockSelection={onBlockSelectionRequest}
              onUpdateBlockMetadata={onUpdateBlockMetadata}
              onBlockMetadataUpdate={() => {
                onFetchBlocks();
              }}
              onOpenBlockWithNote={onOpenBlockWithNote}
              getBlockMetadata={getBlockMetadata}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Initializing conversation...
            </div>
          )
        ) : (
          <ChatContainer 
            key={`agent-chat-${activeConversationId}`}
            documentId={documentId}
            selectedBlock={selectedBlock}
            conversationId={activeConversationId}
            pendingText={pendingChatText}
            onTextAdded={onTextAdded}
            onRequestBlockSelection={onBlockSelectionRequest}
            onUpdateBlockMetadata={onUpdateBlockMetadata}
            onOpenBlockWithNote={onOpenBlockWithNote}
            getBlockMetadata={getBlockMetadata}
          />
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;