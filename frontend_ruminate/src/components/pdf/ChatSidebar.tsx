import React from 'react';
import { Block } from './PDFViewer';
import ChatContainer from '../chat/ChatContainer';

interface ChatSidebarProps {
  documentId: string;
  selectedBlock: Block | null;
  mainConversationId: string | null;
  // Keep props for compatibility but they are no longer used for UI switching
  activeConversationId: string | null;
  rabbitholeConversations: Array<{ id: string; title: string; selectionText: string; blockId: string; }>;
  rabbitholeData?: any[];
  pendingChatText: string;
  onSetActiveConversationId: (id: string | null) => void;
  onSetRabbitholeConversations: (conversations: any) => void;
  onTextAdded: () => void;
  onBlockSelectionRequest: (config: { prompt: string; onComplete: (blockId: string) => void }) => void;
  onUpdateBlockMetadata: (blockId: string, newMetadata: any) => void;
  onFetchBlocks: () => void;
  onOpenBlockWithNote: (blockId: string, noteId: string) => void;
  getBlockMetadata: (blockId: string) => any;
  currentPage?: number;
  blocks?: Block[];
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  documentId,
  selectedBlock,
  mainConversationId,
  // Unused but kept for props compatibility
  activeConversationId,
  rabbitholeConversations,
  rabbitholeData = [],
  pendingChatText,
  onSetActiveConversationId,
  onSetRabbitholeConversations,
  onTextAdded,
  onBlockSelectionRequest,
  onUpdateBlockMetadata,
  onFetchBlocks,
  onOpenBlockWithNote,
  getBlockMetadata,
  currentPage = 1,
  blocks = []
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Chat container - always main conversation in sidebar */}
      <div className="flex-1 overflow-hidden">
        {mainConversationId ? (
          <ChatContainer 
            key={`main-chat-${mainConversationId}`}
            documentId={documentId}
            selectedBlock={selectedBlock}
            conversationId={mainConversationId}
            conversationType="main"
            pendingText={pendingChatText}
            onTextAdded={onTextAdded}
            onRequestBlockSelection={onBlockSelectionRequest}
            onUpdateBlockMetadata={onUpdateBlockMetadata}
            onBlockMetadataUpdate={() => {
              onFetchBlocks();
            }}
            onOpenBlockWithNote={onOpenBlockWithNote}
            getBlockMetadata={getBlockMetadata}
            currentPage={currentPage}
            blocks={blocks}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Initializing conversation...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;