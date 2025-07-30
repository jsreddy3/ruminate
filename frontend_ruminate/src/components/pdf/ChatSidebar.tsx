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
  return (
    <div className="flex flex-col h-full">
      {/* Chat header with tabs */}
      <div className="border-b border-gray-200 p-3 flex flex-col">
        {/* Conversation tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-2 -mb-px">
          {/* Main chat tab */}
          <button 
            className={`px-3 py-1.5 rounded-t-md text-sm whitespace-nowrap ${
              activeConversationId === null 
              ? 'bg-white border border-gray-200 border-b-white text-indigo-600 font-medium' 
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => onSetActiveConversationId(null)}
          >
            Main Chat
          </button>
          
          {/* Agent chat tabs */}
          {rabbitholeConversations.map(conv => (
            <button
              key={conv.id}
              className={`px-3 py-1.5 rounded-t-md text-sm flex items-center space-x-1 whitespace-nowrap ${
                activeConversationId === conv.id
                ? 'bg-white border border-gray-200 border-b-white text-indigo-600 font-medium' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => onSetActiveConversationId(conv.id)}
            >
              <span>🔍</span>
              <span>{conv.title}</span>
              <span 
                className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetRabbitholeConversations(prev => prev.filter(c => c.id !== conv.id));
                  if (activeConversationId === conv.id) {
                    onSetActiveConversationId(null);
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      </div>
      
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