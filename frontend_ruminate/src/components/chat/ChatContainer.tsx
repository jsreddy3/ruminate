import React, { useState, useCallback, useEffect } from 'react';
import { Block } from '../pdf/PDFViewer';
import { useMessageTree } from '../../hooks/useMessageTree';
import { useMessageStreamHandler } from '../../hooks/useMessageStreamHandler';
import { useNoteGeneration } from '../../hooks/useNoteGeneration';
import { MessageRole } from '../../types/chat';

// Import components
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import NoteGenerationPopup from './NoteGenerationPopup';

interface ChatContainerProps {
  documentId: string;
  selectedBlock?: Block | null;
  conversationId: string; // Make required since PDFViewer always provides it
  conversationType?: 'main' | 'rabbithole';
  rabbitholeMetadata?: {
    source_block_id: string;
    selected_text: string;
  };
  onClose?: () => void;
  pendingText?: string;
  onTextAdded?: () => void;
  onRequestBlockSelection?: (config: {
    prompt: string;
    onComplete: (blockId: string) => void;
  }) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  onBlockMetadataUpdate?: () => void;
  onOpenBlockWithNote?: (blockId: string, noteId: string) => void;
  getBlockMetadata?: (blockId: string) => any;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  documentId,
  selectedBlock = null,
  conversationId: initialConversationId,
  conversationType = 'main',
  rabbitholeMetadata,
  onClose,
  pendingText,
  onTextAdded,
  onRequestBlockSelection,
  onUpdateBlockMetadata,
  onBlockMetadataUpdate,
  onOpenBlockWithNote,
  getBlockMetadata
}) => {
  // Track conversation ID (may need to be created)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  
  // Core message tree state for the conversation
  const {
    messageTree,
    activeThreadIds,
    isLoading: isLoadingTree,
    sendMessage,
    editMessage,
    switchToVersion,
    refreshTree,
    addSummaryToMessage
  } = useMessageTree({
    conversationId,
    selectedBlockId: selectedBlock?.id
  });
  
  // Message streaming handler
  const {
    streamingMessageId,
    streamingContent,
    startStreaming
  } = useMessageStreamHandler({
    conversationId,
    onStreamComplete: refreshTree
  });

  // Note generation handler
  const {
    showNotePopup,
    setShowNotePopup,
    isGeneratingNote,
    noteGenerationStatus,
    handleGenerateNote
  } = useNoteGeneration({
    conversationId,
    conversationType,
    rabbitholeMetadata,
    onRequestBlockSelection,
    onUpdateBlockMetadata,
    onBlockMetadataUpdate,
    onOpenBlockWithNote,
    getBlockMetadata,
    onSummaryGenerated: (_messageId, summary) => addSummaryToMessage(summary)
  });
  
  // Set conversation ID from parent immediately (no initialization logic)
  useEffect(() => {
    if (initialConversationId !== conversationId) {
      setConversationId(initialConversationId);
    }
  }, [initialConversationId, conversationId]);
  
  // Handle sending a new message
  const handleSendMessage = useCallback(async (content: string) => {
    if (!conversationId) return;
    
    try {
      // Find the parent message ID (last message in active thread or system message)
      const parentId = activeThreadIds.length > 0 
        ? activeThreadIds[activeThreadIds.length - 1] 
        : messageTree.find(msg => msg.role === MessageRole.SYSTEM)?.id || '';
      
      if (!parentId) {
        console.error('No valid parent message found');
        return;
      }
      
      // Send message and get response ID for streaming
      const [, responseMessageId] = await sendMessage(content, parentId);
      
      // Set up token streaming
      startStreaming(responseMessageId);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [conversationId, activeThreadIds, messageTree, sendMessage, startStreaming]);
  
  // Handle editing a message
  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    if (!conversationId) return;
    
    try {
      // Edit message and get response ID for streaming
      const [_, responseMessageId] = await editMessage(messageId, content);
      
      // Set up token streaming for edited message
      startStreaming(responseMessageId);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }, [conversationId, editMessage, startStreaming]);

  
  // Count total messages for pill visibility (exclude system messages)
  // Use activeThreadIds length instead of messageTree since tree building has issues
  const totalMessageCount = Math.max(0, activeThreadIds.length - 1); // -1 to exclude system message
  const shouldShowNotePill = totalMessageCount >= 5;
  
  
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface-parchment via-library-cream-50 to-surface-paper text-reading-primary relative">
      {/* Subtle notebook margin line */}
      <div className="absolute left-8 top-0 bottom-0 w-px bg-library-mahogany-200 opacity-30"></div>
      
      <ChatMessages
        messageTree={messageTree}
        activeThreadIds={activeThreadIds}
        streamingMessageId={streamingMessageId}
        streamingContent={streamingContent}
        conversationId={conversationId}
        onSwitchVersion={switchToVersion}
        onEditMessage={handleEditMessage}
        documentId={documentId}
      />
      
      {/* Scholarly note generation prompt */}
      {shouldShowNotePill && (
        <div className="px-6 py-3 flex justify-center">
          <button
            onClick={() => setShowNotePopup(true)}
            className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-library-gold-50 to-library-cream-100 hover:from-library-gold-100 hover:to-library-cream-200 text-reading-accent border border-library-gold-200 rounded-book transition-all duration-300 shadow-paper hover:shadow-book"
            disabled={isLoadingTree || !!streamingMessageId || isGeneratingNote}
          >
            <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-serif text-sm font-medium">Save Conversation Insights</span>
          </button>
        </div>
      )}

      {/* Elegant note generation status indicator */}
      {isGeneratingNote && noteGenerationStatus && (
        <div className="px-6 py-3 flex justify-center">
          <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-surface-parchment to-library-cream-100 border border-library-sage-200 rounded-journal shadow-paper backdrop-blur-sm">
            {noteGenerationStatus.includes('Failed') ? (
              <svg className="w-5 h-5 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : noteGenerationStatus.includes('successfully') ? (
              <svg className="w-5 h-5 text-library-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 animate-spin text-library-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span className={`font-serif text-sm ${
              noteGenerationStatus.includes('Failed') 
                ? 'text-library-mahogany-700' 
                : noteGenerationStatus.includes('successfully') 
                  ? 'text-library-forest-700' 
                  : 'text-library-gold-700'
            }`}>
              {noteGenerationStatus}
            </span>
          </div>
        </div>
      )}
      
      <ChatInput
        onSendMessage={handleSendMessage}
        isDisabled={isLoadingTree || !!streamingMessageId}
        pendingText={pendingText}
        onTextConsumed={onTextAdded}
      />

      {/* Note Generation Popup */}
      <NoteGenerationPopup
        isVisible={showNotePopup}
        totalMessages={totalMessageCount}
        onClose={() => setShowNotePopup(false)}
        onGenerate={handleGenerateNote}
      />
    </div>
  );
};

export default ChatContainer; 