import React, { useState, useCallback, useEffect } from 'react';
import { Block } from '../pdf/PDFViewer';
import { useMessageTree } from '../../hooks/useMessageTree';
import { useMessageStream } from '../../hooks/useMessageStream';
import { useAgentEventStream, AgentStatus } from '../../hooks/useAgentEventStream';
import { conversationApi } from '../../services/api/conversation';
import { agentApi } from '../../services/api/agent';
import { MessageRole } from '../../types/chat';

// Import components from absolute paths
import MessageList from '../../components/chat/messages/MessageList';
import MessageInput from '../../components/chat/messages/MessageInput';

interface ChatContainerProps {
  documentId: string;
  selectedBlock?: Block | null;
  conversationId?: string;
  isAgentChat?: boolean;
  onClose?: () => void;
  onConversationCreated?: (id: string) => void;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  documentId,
  selectedBlock = null,
  conversationId: initialConversationId,
  isAgentChat = false,
  onClose,
  onConversationCreated
}) => {
  // Track conversation ID (may need to be created)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  
  // Track streaming state for displaying content during generation
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // Track current agent-chat streaming message ID (for live agent events)
  const [agentStreamingMessageId, setAgentStreamingMessageId] = useState<string | null>(null);
  
  // Core message tree state for the conversation
  const {
    messageTree,
    activeThreadIds,
    isLoading: isLoadingTree,
    error: treeError,
    sendMessage,
    editMessage,
    editMessageStreaming,
    optimisticSendMessage,
    optimisticEditMessage,
    switchToVersion,
    refreshTree
  } = useMessageTree({
    conversationId,
    isAgentChat,
    selectedBlockId: selectedBlock?.id
  });
  
  // Stream content for regular chats
  const {
    content: streamingContent,
    isComplete: isStreamingComplete,
    isLoading: isStreamingActive,
    error: streamingError
  } = useMessageStream(conversationId, streamingMessageId);
  
  // Stream events for agent chats - always call the hook but use a dummy object for non-agent chats
  const agentEventData = useAgentEventStream(isAgentChat ? conversationId : null);
  
  // Extract values for easier use
  const agentEvents = isAgentChat ? agentEventData.events : [];
  const agentStatus = isAgentChat ? agentEventData.status : 'idle' as AgentStatus;
  const agentConnected = isAgentChat ? agentEventData.isConnected : false;
  
  // Debug log agent status changes
  useEffect(() => {
    if (isAgentChat) {
      console.log("ChatContainer: Agent status changed to", agentStatus, {
        hasEvents: agentEvents.length > 0, 
        eventsCount: agentEvents.length,
        connected: agentConnected
      });
    }
  }, [isAgentChat, agentStatus, agentEvents.length, agentConnected]);
  
  // Fetch existing conversation or create a new one if needed
  useEffect(() => {
    const initializeConversation = async () => {
      // If we already have a conversation ID, no need to fetch or create
      if (conversationId) return;
      
      if (!documentId) return;
      
      try {
        if (isAgentChat) {
          // For agent chats, we now have two approaches:
          // 1. Coming from a block selection in PDF viewer - conversation already created
          // 2. Directly creating an agent chat - need to create it
          
          // Only create one if needed (typically when directly clicking "Agent" button)
          if (!conversationId && selectedBlock) {
            console.log("Creating new agent chat for block:", selectedBlock.id);
            const { conversation_id } = await agentApi.createAgentRabbithole(
              documentId,
              selectedBlock.id,
              selectedBlock.html_content || '',
              0, // Default start offset
              (selectedBlock.html_content || '').length, // Default end offset
              undefined // No parent conversation by default
            );
            setConversationId(conversation_id);
            if (onConversationCreated) onConversationCreated(conversation_id);
          } else {
            console.log("Using existing agent conversation or waiting for block selection");
          }
        } else {
          // For regular chats, first check if there's an existing conversation for this document
          const existingConversations = await conversationApi.getDocumentConversations(documentId);
          
          if (existingConversations && existingConversations.length > 0) {
            // Use the most recent conversation
            const mostRecent = existingConversations[0];
            setConversationId(mostRecent.id);
            if (onConversationCreated) onConversationCreated(mostRecent.id);
          } else {
            // Create a new conversation if none exists
            const { id } = await conversationApi.create(documentId);
            setConversationId(id);
            if (onConversationCreated) onConversationCreated(id);
          }
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
      }
    };
    
    initializeConversation();
  }, [documentId, conversationId, isAgentChat, selectedBlock, onConversationCreated]);
  
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
      
      // Use optimistic send message for immediate UI feedback
      const [_, responseMessageId] = await optimisticSendMessage(content, parentId);
      
      if (isAgentChat) {
        // Track live agent events for this message
        setAgentStreamingMessageId(responseMessageId);
      } else {
        // For regular chats, set up token streaming
        setStreamingMessageId(responseMessageId);
      }
      
      // For agent chats, events will be handled by useAgentEventStream
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [conversationId, activeThreadIds, messageTree, optimisticSendMessage, isAgentChat]);
  
  // Handle editing a message
  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    if (!conversationId) return;
    
    try {
      // Use optimistic edit for immediate feedback
      const [_, responseMessageId] = await optimisticEditMessage(messageId, content);
      
      if (isAgentChat) {
        // Show live agent events for this edited message
        setAgentStreamingMessageId(responseMessageId);
      } else {
        // Token streaming for regular chat edits
        setStreamingMessageId(responseMessageId);
      }
      // For agent chats, events will be streamed separately
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }, [conversationId, optimisticEditMessage, isAgentChat]);
  
  // When streaming completes, first refresh the tree to fetch the completed message before stopping streaming to avoid flicker
  useEffect(() => {
    if (isStreamingComplete && streamingMessageId) {
      console.log(`Stream completed for message: ${streamingMessageId}`);
      refreshTree().then(() => {
        setStreamingMessageId(null);
      });
    }
  }, [isStreamingComplete, streamingMessageId, refreshTree]);
  
  // When agent status changes to completed, refresh the message tree
  useEffect(() => {
    if (isAgentChat && agentStatus === 'completed') {
      refreshTree();
    }
  }, [isAgentChat, agentStatus, refreshTree]);
  
  // When agent exploration completes, clear live pane and refresh the tree
  useEffect(() => {
    if (isAgentChat && agentStatus === 'completed') {
      // Clear live pane
      setAgentStreamingMessageId(null);
      // Refresh to fetch persisted steps
      refreshTree();
    }
  }, [isAgentChat, agentStatus, refreshTree]);
  
  return (
    <div className="flex flex-col h-full bg-white text-gray-900">
      {/* Chat header could be a separate component */}
      <div className="border-b p-3 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">
          {isAgentChat ? 'AI Agent' : 'Chat'} 
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
          isAgentChat={isAgentChat}
          conversationId={conversationId || undefined}
          agentEvents={agentEvents}
          agentStatus={agentStatus}
        />
      </div>
      
      {/* Message input */}
      <div className="border-t p-3 bg-white">
        <MessageInput
          onSendMessage={handleSendMessage}
          isDisabled={isLoadingTree || !!streamingMessageId || (isAgentChat && agentStatus === 'exploring')}
        />
      </div>
    </div>
  );
};

export default ChatContainer; 