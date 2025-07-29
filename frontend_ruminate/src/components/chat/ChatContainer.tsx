import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Block } from '../pdf/PDFViewer';
import { useMessageTree } from '../../hooks/useMessageTree';
import { useMessageStream } from '../../hooks/useMessageStream';
import { conversationApi } from '../../services/api/conversation';
import { MessageRole } from '../../types/chat';

// Import components from absolute paths
import MessageList from '../../components/chat/messages/MessageList';
import MessageInput from '../../components/chat/messages/MessageInput';
import NoteGenerationPopup from './NoteGenerationPopup';

interface ChatContainerProps {
  documentId: string;
  selectedBlock?: Block | null;
  conversationId?: string;
  onClose?: () => void;
  onConversationCreated?: (id: string) => void;
  pendingText?: string;
  onTextAdded?: () => void;
  onRequestBlockSelection?: (config: {
    prompt: string;
    onComplete: (blockId: string) => void;
  }) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  documentId,
  selectedBlock = null,
  conversationId: initialConversationId,
  onClose,
  onConversationCreated,
  pendingText,
  onTextAdded,
  onRequestBlockSelection
}) => {
  // Track conversation ID (may need to be created)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  
  // Track streaming state for displaying content during generation
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // Note generation state
  const [showNotePopup, setShowNotePopup] = useState(false);
  
  // Ref for scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Core message tree state for the conversation
  const {
    messageTree,
    activeThreadIds,
    isLoading: isLoadingTree,
    error: treeError,
    sendMessage,
    editMessage,
    switchToVersion,
    refreshTree
  } = useMessageTree({
    conversationId,
    selectedBlockId: selectedBlock?.id
  });
  
  // Stream content for chats
  const {
    content: streamingContent,
    isComplete: isStreamingComplete,
    isLoading: isStreamingActive,
    error: streamingError
  } = useMessageStream(conversationId, streamingMessageId);
  
  // Fetch existing conversation or create a new one if needed
  useEffect(() => {
    const initializeConversation = async () => {
      // If we already have a conversation ID, no need to fetch or create
      if (conversationId) return;
      
      if (!documentId) return;
      
      try {
        // For regular chats, first check if there's an existing conversation for this document
        const existingConversations = await conversationApi.getDocumentConversations(documentId);
        
        if (existingConversations && existingConversations.length > 0) {
          // Use the most recent conversation
          const mostRecent = existingConversations[0];
          setConversationId(mostRecent.id);
          if (onConversationCreated) onConversationCreated(mostRecent.id);
        } else {
          // Create a new conversation if none exists
          const { conversation_id } = await conversationApi.create(documentId);
          setConversationId(conversation_id);
          if (onConversationCreated) onConversationCreated(conversation_id);
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
      }
    };
    
    initializeConversation();
  }, [documentId, conversationId, selectedBlock, onConversationCreated]);
  
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
      setStreamingMessageId(responseMessageId);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [conversationId, activeThreadIds, messageTree, sendMessage]);
  
  // Handle editing a message
  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    if (!conversationId) return;
    
    try {
      // Edit message and get response ID for streaming
      const [_, responseMessageId] = await editMessage(messageId, content);
      
      // Set up token streaming for edited message
      setStreamingMessageId(responseMessageId);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }, [conversationId, editMessage]);
  
  // When streaming completes, refresh the tree to fetch the completed message
  useEffect(() => {
    if (isStreamingComplete && streamingMessageId) {
      refreshTree().then(() => {
        setStreamingMessageId(null);
      });
    }
  }, [isStreamingComplete, streamingMessageId, refreshTree]);
  
  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messageTree.length, streamingContent]);

  // Handle note generation
  const handleGenerateNote = useCallback(async (messageCount: number, topic: string) => {
    if (!conversationId || !onRequestBlockSelection) {
      console.error('Cannot generate note: missing conversation ID or block selection handler');
      return;
    }

    // Close popup immediately to allow block selection
    setShowNotePopup(false);

    // Request block selection from PDF viewer
    onRequestBlockSelection({
      prompt: "Select a block to save your conversation note",
      onComplete: async (blockId: string) => {
        try {
          // Call the backend API to generate note using existing API setup
          const { authenticatedFetch, API_BASE_URL } = await import('../../utils/api');
          const response = await authenticatedFetch(
            `${API_BASE_URL}/conversations/${conversationId}/generate-note`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                block_id: blockId,
                message_count: messageCount,
                topic: topic || undefined
              })
            }
          );

          if (!response.ok) {
            throw new Error('Failed to generate note');
          }

          const result = await response.json();
          console.log('Note generated successfully:', result);
          
          // TODO: Update block data to show new note (without full page reload)
        } catch (error) {
          console.error('Error generating note:', error);
          // TODO: Show error message
        }
      }
    });
  }, [conversationId, onRequestBlockSelection]);

  // Count total messages for pill visibility (exclude system messages)
  // Use activeThreadIds length instead of messageTree since tree building has issues
  const totalMessageCount = Math.max(0, activeThreadIds.length - 1); // -1 to exclude system message
  const shouldShowNotePill = totalMessageCount >= 5;
  
  // Debug logging
  console.log('[NOTE PILL DEBUG]', {
    totalMessages: messageTree.length,
    totalMessageCount,
    shouldShowNotePill,
    messageTree: messageTree.map(msg => ({ role: msg.role, content: msg.content?.substring(0, 50) + '...' })),
    conversationId,
    isLoadingTree,
    treeError: treeError?.message,
    activeThreadIds
  });

  // More detailed API debugging
  useEffect(() => {
    if (conversationId) {
      console.log('[MESSAGE TREE DEBUG] Testing API call for conversation:', conversationId);
      conversationApi.getMessageTree(conversationId)
        .then(response => {
          console.log('[MESSAGE TREE DEBUG] API Response:', response);
          const messages = response.messages || response;
          console.log('[MESSAGE TREE DEBUG] Parsed messages:', messages);
        })
        .catch(error => {
          console.error('[MESSAGE TREE DEBUG] API Error:', error);
        });
    }
  }, [conversationId]);
  
  
  return (
    <div className="flex flex-col h-full bg-white text-gray-900">
      <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-white" key={`chat-container-${conversationId || 'main'}`}>
        {/* Message list */}
        <MessageList 
          messages={messageTree}
          activeThreadIds={activeThreadIds}
          onSwitchVersion={switchToVersion}
          onEditMessage={handleEditMessage}
          streamingMessageId={streamingMessageId}
          streamingContent={streamingContent}
          conversationId={conversationId || undefined}
        />
      </div>
      
      {/* Note generation pill - minimal clean design */}
      {shouldShowNotePill && (
        <div className="px-4 py-1.5 flex justify-center">
          <button
            onClick={() => setShowNotePopup(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs rounded-full transition-colors border border-gray-200"
            disabled={isLoadingTree || !!streamingMessageId}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate note
          </button>
        </div>
      )}
      
      {/* Message input */}
      <div className="border-t p-3 bg-white">
        <MessageInput
          onSendMessage={handleSendMessage}
          isDisabled={isLoadingTree || !!streamingMessageId}
          pendingText={pendingText}
          onTextConsumed={onTextAdded}
        />
      </div>

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