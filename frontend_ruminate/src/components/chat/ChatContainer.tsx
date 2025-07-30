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
  conversationId: string; // Make required since PDFViewer always provides it
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
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  documentId,
  selectedBlock = null,
  conversationId: initialConversationId,
  onClose,
  pendingText,
  onTextAdded,
  onRequestBlockSelection,
  onUpdateBlockMetadata,
  onBlockMetadataUpdate,
  onOpenBlockWithNote
}) => {
  // Track conversation ID (may need to be created)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  
  // Track streaming state for displaying content during generation
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // Note generation state
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [noteGenerationStatus, setNoteGenerationStatus] = useState<string>('');
  
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
          console.log('Generating note for block:', blockId);
          
          // Set loading state
          setIsGeneratingNote(true);
          setNoteGenerationStatus('Generating note...');
          
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
          console.log('Note details - ID:', result.note_id, 'Block ID:', result.block_id);
          
          setNoteGenerationStatus('Note created successfully!');
          
          // Update block metadata optimistically with generated note
          if (result.note_id && result.block_id && result.note && onUpdateBlockMetadata) {
            const annotationKey = '-1'; // Generated notes use special key with -1 offset
            const newMetadata = {
              annotations: {
                // Preserve existing annotations, add the new generated note
                [annotationKey]: {
                  id: result.note_id,
                  text: '', // Generated notes have empty text
                  note: result.note,
                  text_start_offset: -1, // Special value for generated notes
                  text_end_offset: -1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  is_generated: true, // Special flag for generated notes
                  conversation_id: result.conversation_id,
                  source_conversation_id: result.conversation_id,
                  message_count: messageCount,
                  topic: topic || undefined
                }
              }
            };
            onUpdateBlockMetadata(result.block_id, newMetadata);
            console.log('Updated block metadata optimistically with generated note');
            
            // Auto-open the block with the new note after a short delay
            setTimeout(() => {
              if (onOpenBlockWithNote && result.note_id && result.block_id) {
                onOpenBlockWithNote(result.block_id, result.note_id);
              }
              setIsGeneratingNote(false);
              setNoteGenerationStatus('');
            }, 1500);
          } else {
            // Fallback to old behavior if API doesn't return complete data or callback unavailable
            if (onBlockMetadataUpdate) {
              console.log('Calling onBlockMetadataUpdate to refresh block data...');
              onBlockMetadataUpdate();
            }
            setIsGeneratingNote(false);
            setNoteGenerationStatus('');
          }
          
          console.log('Note should now be visible in the block view');
        } catch (error) {
          console.error('Error generating note:', error);
          setNoteGenerationStatus('Failed to generate note');
          setTimeout(() => {
            setIsGeneratingNote(false);
            setNoteGenerationStatus('');
          }, 2000);
        }
      }
    });
  }, [conversationId, onRequestBlockSelection, onBlockMetadataUpdate, onUpdateBlockMetadata, onOpenBlockWithNote]);

  // Count total messages for pill visibility (exclude system messages)
  // Use activeThreadIds length instead of messageTree since tree building has issues
  const totalMessageCount = Math.max(0, activeThreadIds.length - 1); // -1 to exclude system message
  const shouldShowNotePill = totalMessageCount >= 5;
  
  
  
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
            disabled={isLoadingTree || !!streamingMessageId || isGeneratingNote}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate note
          </button>
        </div>
      )}

      {/* Note generation status indicator */}
      {isGeneratingNote && noteGenerationStatus && (
        <div className="px-4 py-2 flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200">
            {noteGenerationStatus.includes('Failed') ? (
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : noteGenerationStatus.includes('successfully') ? (
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span className={noteGenerationStatus.includes('Failed') ? 'text-red-700' : noteGenerationStatus.includes('successfully') ? 'text-green-700' : 'text-blue-700'}>
              {noteGenerationStatus}
            </span>
          </div>
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