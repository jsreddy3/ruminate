import React, { useState, useCallback, useEffect } from 'react';
import { Block } from '../pdf/PDFViewer';
import { useMessageTree } from '../../hooks/useMessageTree';
import { useMessageStream } from '../../hooks/useMessageStream';
import { conversationApi } from '../../services/api/conversation';
import { MessageRole } from '../../types/chat';

// Import components from absolute paths
import MessageList from '../../components/chat/messages/MessageList';
import MessageInput from '../../components/chat/messages/MessageInput';
import { QuestionChips } from './QuestionChips';

interface ChatContainerProps {
  documentId: string;
  selectedBlock?: Block | null;
  conversationId?: string;
  onClose?: () => void;
  onConversationCreated?: (id: string) => void;
  pendingText?: string;
  onTextAdded?: () => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  documentId,
  selectedBlock = null,
  conversationId: initialConversationId,
  onClose,
  onConversationCreated,
  pendingText,
  onTextAdded
}) => {
  // Track conversation ID (may need to be created)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [questions, setQuestions] = useState<Array<{
    id: string;
    question: string;
    type: string;
    order: number;
  }>>([]);
  
  // Track streaming state for displaying content during generation
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
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
          // Set questions if they exist in the conversation data
          if (mostRecent.questions) {
            setQuestions(mostRecent.questions);
          }
          if (onConversationCreated) onConversationCreated(mostRecent.id);
        } else {
          // Create a new conversation if none exists
          const { conversation_id, questions: newQuestions = [] } = await conversationApi.create(documentId);
          setConversationId(conversation_id);
          setQuestions(newQuestions);
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
  
  // Fetch questions when conversation loads
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!conversationId) return;
      
      try {
        // Get the tree response which now includes questions
        const response = await conversationApi.getMessageTree(conversationId);
        if (response.questions && response.questions.length > 0) {
          // Only update questions if we don't have any (avoid overriding local state changes)
          setQuestions(prev => prev.length === 0 ? response.questions || [] : prev);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };
    
    fetchQuestions();
  }, [conversationId]);
  
  return (
    <div className="flex flex-col h-full bg-white text-gray-900">
      {/* Chat header */}
      <div className="border-b p-3 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">
          Chat
          {selectedBlock && ` - ${selectedBlock.block_type}`}
        </h3>
        {onClose && (
          <button 
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100 text-gray-700"
          >
            <span>×</span>
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-auto bg-white" key={`chat-container-${conversationId || 'main'}`}>
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
      
      {/* Question chips */}
      <QuestionChips
        questions={questions}
        onQuestionClick={async (questionId, questionText) => {
          // Remove used question from display immediately
          setQuestions(prev => prev.filter(q => q.id !== questionId));
          
          // Mark question as used in backend
          if (conversationId) {
            try {
              await conversationApi.markQuestionAsUsed(conversationId, questionId);
            } catch (error) {
              console.error('Error marking question as used:', error);
              // If marking as used fails, restore the question
              setQuestions(prev => [...prev, { id: questionId, question: questionText, type: "GENERAL", order: 0 }]);
            }
          }
          
          // Send the question text
          handleSendMessage(questionText);
        }}
        isLoading={!!streamingMessageId}
      />
      
      {/* Message input */}
      <div className="border-t p-3 bg-white">
        <MessageInput
          onSendMessage={handleSendMessage}
          isDisabled={isLoadingTree || !!streamingMessageId}
          pendingText={pendingText}
          onTextConsumed={onTextAdded}
        />
      </div>
    </div>
  );
};

export default ChatContainer; 