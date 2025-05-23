import { useState, useEffect, useCallback } from 'react';
import { Message, MessageNode, MessageRole } from '../types/chat';
import { conversationApi } from '../services/api/conversation';
import { agentApi } from '../services/api/agent';

interface UseMessageTreeProps {
  conversationId: string | null;
  isAgentChat?: boolean;
  selectedBlockId?: string | null;
}

interface UseMessageTreeReturn {
  messageTree: MessageNode[];
  activeThreadIds: string[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, parentId: string) => Promise<[Message, string]>;
  optimisticSendMessage: (content: string, parentId: string) => Promise<[string, string]>;
  editMessage: (messageId: string, content: string) => Promise<[Message, string]>;
  optimisticEditMessage: (messageId: string, content: string) => Promise<[string, string]>;
  editMessageStreaming: (messageId: string, content: string) => Promise<[string, string]>;
  switchToVersion: (messageId: string) => void;
  refreshTree: () => Promise<void>;
}

/**
 * Hook for managing conversation message trees with versioning support
 */
export function useMessageTree({
  conversationId,
  isAgentChat = false,
  selectedBlockId = null
}: UseMessageTreeProps): UseMessageTreeReturn {
  const [messageTree, setMessageTree] = useState<MessageNode[]>([]);
  const [flatMessages, setFlatMessages] = useState<Message[]>([]);
  const [activeThreadIds, setActiveThreadIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to transform flat messages into a tree structure
  const buildMessageTree = useCallback((messages: Message[]): MessageNode[] => {
    // Create a map for quick message lookup
    const messageMap = new Map<string, MessageNode>();
    
    // First pass: Create all message nodes
    messages.forEach(message => {
      messageMap.set(message.id, {
        ...message,
        children: [],
        isActive: false
      });
    });
    
    // Second pass: Build the tree structure
    const rootNodes: MessageNode[] = [];
    
    messages.forEach(message => {
      const node = messageMap.get(message.id);
      if (node) {
        if (message.parent_id && messageMap.has(message.parent_id)) {
          const parent = messageMap.get(message.parent_id);
          if (parent) {
            parent.children.push(node);
          }
        } else {
          // No parent or parent not found - this is a root node
          rootNodes.push(node);
        }
      }
    });
    
    return rootNodes;
  }, []);

  // Function to determine the active thread in the message tree
  const determineActiveThread = useCallback((messages: Message[]): string[] => {
    // Find the system message (root of the conversation)
    const systemMessage = messages.find(msg => msg.role === MessageRole.SYSTEM);
    
    if (!systemMessage) {
      console.warn("No system message found in conversation");
      return [];
    }
    
    // Create a map for quick message lookup by ID
    const messageMap = new Map<string, Message>();
    messages.forEach(message => messageMap.set(message.id, message));
    
    // Follow the active_child_id pointers from root to leaf
    const path: string[] = [systemMessage.id];
    let currentMessageId = systemMessage.active_child_id;
    
    // Continue following active_child_id until we reach a leaf node (no active child)
    while (currentMessageId) {
      path.push(currentMessageId);
      
      const currentMessage = messageMap.get(currentMessageId);
      if (!currentMessage) {
        console.warn(`Message ${currentMessageId} referenced but not found`);
        break;
      }
      
      currentMessageId = currentMessage.active_child_id;
    }
    
    return path;
  }, []);

  // Helper to trace a message path from a leaf to the root
  const traceMessagePath = useCallback((messageId: string, messages: Message[]): string[] => {
    const path: string[] = [];
    let currentId = messageId;
    
    // Loop until we hit a message with no parent (root) or a missing message
    while (currentId) {
      path.push(currentId);
      
      // Find the current message
      const currentMessage = messages.find(msg => msg.id === currentId);
      if (!currentMessage || !currentMessage.parent_id) break;
      
      // Move to parent
      currentId = currentMessage.parent_id;
    }
    
    // Reverse to get root-to-leaf order
    return path.reverse();
  }, []);

  // Function to refresh the message tree
  const refreshTree = useCallback(async (preventThreadUpdate = false) => {
    if (!conversationId) return;
    
    setIsLoading(true);
    try {
      const messages = await conversationApi.getMessageTree(conversationId);
      setFlatMessages(messages);
      
      // Build tree structure
      const tree = buildMessageTree(messages);
      setMessageTree(tree);
      
      // Always update the active thread by default unless explicitly prevented
      // This keeps the UI showing the most recent messages and responses
      if (!preventThreadUpdate) {
        const activeThread = determineActiveThread(messages);
        setActiveThreadIds(activeThread);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh message tree'));
      console.error("Error refreshing message tree:", err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, buildMessageTree, determineActiveThread]);

  // Fetch message tree when conversation ID changes
  useEffect(() => {
    if (!conversationId) return;
    
    // Reset state when conversation ID changes
    setMessageTree([]);
    setFlatMessages([]);
    setActiveThreadIds([]);
    setError(null);
    
    const fetchMessageTree = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const messages = await conversationApi.getMessageTree(conversationId);
        setFlatMessages(messages);
        
        // Build tree structure
        const tree = buildMessageTree(messages);
        setMessageTree(tree);
        
        // Determine active thread
        const activeThread = determineActiveThread(messages);
        setActiveThreadIds(activeThread);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch message tree'));
        console.error("Error fetching message tree:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMessageTree();
  }, [conversationId, buildMessageTree, determineActiveThread]);

  // Function to send a new message
  const sendMessage = useCallback(
    async (content: string, parentId: string): Promise<[Message, string]> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }
      
      try {
        // Use agent API if it's an agent chat, otherwise use regular conversation API
        if (isAgentChat) {
          const result = await agentApi.sendAgentMessage(
            conversationId,
            content,
            parentId
          );
          
          // Refresh the message tree after sending
          await refreshTree();
          
          // Convert the agent API response format to match the expected return type
          const message: Message = {
            id: result.message_id,
            content: result.content,
            role: result.role as "user" | "assistant" | "system",
            parent_id: parentId,
            children: [],
            active_child_id: null,
            created_at: new Date().toISOString()
          };
          
          return [message, result.message_id];
        } else {
          // For regular chats, use the existing API
          const [message, responseMessageId] = await conversationApi.sendMessage(
            conversationId, 
            content, 
            parentId, 
            activeThreadIds,
            selectedBlockId || undefined
          );
          
          // Refresh the message tree after sending
          await refreshTree();
          
          return [message, responseMessageId];
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to send message'));
        throw err;
      }
    },
    [conversationId, activeThreadIds, isAgentChat, selectedBlockId, refreshTree]
  );

  // Function to edit an existing message
  const editMessage = useCallback(
    async (messageId: string, content: string): Promise<[Message, string]> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }
      
      try {
        if (isAgentChat) {
          // Find the parent ID for this message
          const messageToEdit = flatMessages.find(msg => msg.id === messageId);
          if (!messageToEdit) {
            throw new Error(`Message with ID ${messageId} not found`);
          }
          
          const parentId = messageToEdit.parent_id || '';
          console.log("Editing agent message with parent:", parentId);
          
          // For agent chats, use the agent API
          const { edited_message_id, placeholder_id } = await agentApi.editAgentMessage(
            conversationId,
            messageId,
            content,
            parentId
          );
          
          // Refresh the message tree after editing
          await refreshTree();
          
          // Create a placeholder message object since the agent API doesn't return full messages
          const placeholderMessage: Message = {
            id: edited_message_id,
            content: content,
            role: MessageRole.USER,
            parent_id: '',  // Will be populated via refresh
            created_at: new Date().toISOString(),
            active_child_id: placeholder_id,
            children: []
          };
          
          return [placeholderMessage, placeholder_id];
        } else {
          // For regular chats, use the existing API
          const [message, responseMessageId] = await conversationApi.editMessage(
            conversationId,
            messageId,
            content,
            activeThreadIds
          );
          
          // Refresh the message tree after editing
          await refreshTree();
          
          return [message, responseMessageId];
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to edit message'));
        throw err;
      }
    },
    [conversationId, activeThreadIds, isAgentChat, flatMessages, refreshTree]
  );

  // Function to edit an existing message with streaming response
  const editMessageStreaming = useCallback(
    async (messageId: string, content: string): Promise<[string, string]> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }
      
      try {
        if (isAgentChat) {
          // Find the parent ID for this message
          const messageToEdit = flatMessages.find(msg => msg.id === messageId);
          if (!messageToEdit) {
            throw new Error(`Message with ID ${messageId} not found`);
          }
          
          const parentId = messageToEdit.parent_id || '';
          console.log("Streaming edit agent message with parent:", parentId);
          
          // For agent chats, use the agent API without streaming
          const { edited_message_id, placeholder_id } = await agentApi.editAgentMessage(
            conversationId,
            messageId,
            content,
            parentId
          );
          
          // For agent chats we don't need streaming, so we can just refresh
          refreshTree().catch(err => 
            console.error("Error refreshing tree after agent edit:", err)
          );
          
          return [edited_message_id, placeholder_id];
        } else {
          // For regular chats, use the streaming API
          const [userMessageId, assistantMessageId] = await conversationApi.editMessageStreaming(
            conversationId,
            messageId,
            content,
            activeThreadIds,
            selectedBlockId || undefined
          );
          
          // Refresh the message tree after editing
          // Note: we don't await this because we want to return the IDs immediately
          // so streaming can begin, but we still want the tree to refresh
          refreshTree().catch(err => 
            console.error("Error refreshing tree after streaming edit:", err)
          );
          
          // Return the message IDs
          return [userMessageId, assistantMessageId];
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to edit message with streaming'));
        throw err;
      }
    },
    [conversationId, activeThreadIds, isAgentChat, selectedBlockId, refreshTree]
  );

  // Function to switch to a different message version
  const switchToVersion = useCallback((messageId: string) => {
    // First find the message of the version we're switching to
    const targetMessage = flatMessages.find(msg => msg.id === messageId);
    if (!targetMessage || !targetMessage.parent_id) return;
    
    // Log the current active thread before changes
    console.log('BEFORE VERSION SWITCH - Active Thread IDs:', [...activeThreadIds]);
    console.log('Switching to version:', messageId, 'Parent ID:', targetMessage.parent_id);
    
    // For now, we'll just update our local state
    // The parent message stays the same, but we replace its child in the active thread
    const newActiveThreadIds = [...activeThreadIds];
    
    // Find the index of the parent in the active thread
    const parentIndex = newActiveThreadIds.indexOf(targetMessage.parent_id);
    console.log('Parent index in active thread:', parentIndex);
    
    if (parentIndex !== -1 && parentIndex < newActiveThreadIds.length - 1) {
      // Replace the old child with the new version
      const oldVersion = newActiveThreadIds[parentIndex + 1];
      newActiveThreadIds[parentIndex + 1] = messageId;
      
      // Remove any subsequent messages in the thread (children of the old version)
      const removedChildren = newActiveThreadIds.slice(parentIndex + 2);
      newActiveThreadIds.length = parentIndex + 2;
      
      // Log the changes
      console.log('Replaced version:', oldVersion, 'with new version:', messageId);
      if (removedChildren.length > 0) {
        console.log('Removed subsequent messages:', removedChildren);
      }
      
      // IMPORTANT ADDITION: Find children of the selected version and add them to the thread
      // First we need to find which messages have this version as parent
      const childrenOfTarget = flatMessages.filter(msg => msg.parent_id === messageId);
      
      if (childrenOfTarget.length > 0) {
        // Sort by created_at to get them in chronological order
        childrenOfTarget.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        // Add the most recent child to the active thread
        // We could implement more complex logic here if needed
        const mostRecentChild = childrenOfTarget[childrenOfTarget.length - 1];
        newActiveThreadIds.push(mostRecentChild.id);
        
        console.log('Added child of selected version:', mostRecentChild.id);
        
        // Recursively add children of this child if they exist
        let currentId = mostRecentChild.id;
        while (true) {
          const nextChildren = flatMessages.filter(msg => msg.parent_id === currentId);
          if (nextChildren.length === 0) break;
          
          // Sort and get most recent
          nextChildren.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const nextChild = nextChildren[nextChildren.length - 1];
          
          newActiveThreadIds.push(nextChild.id);
          console.log('Added grandchild:', nextChild.id);
          
          currentId = nextChild.id;
        }
      }
      
      // Update active thread
      setActiveThreadIds(newActiveThreadIds);
      console.log('AFTER VERSION SWITCH - Active Thread IDs:', newActiveThreadIds);
      
      // Refresh to ensure we have the latest data
      refreshTree(true);
    } else {
      console.log('Could not find valid position to switch versions - parentIndex:', parentIndex, 
                  'threadLength:', newActiveThreadIds.length);
    }
  }, [flatMessages, activeThreadIds, refreshTree]);

  // Function to optimistically send a message with immediate UI feedback
  const optimisticSendMessage = useCallback(
    async (content: string, parentId: string): Promise<[string, string]> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }

      // Generate temporary IDs
      const tempUserMessageId = `temp-user-${Date.now()}`;
      const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
      
      // Create optimistic messages
      const optimisticUserMessage: Message = {
        id: tempUserMessageId,
        content,
        role: MessageRole.USER,
        parent_id: parentId,
        created_at: new Date().toISOString(),
        active_child_id: tempAssistantMessageId,
        children: []
      };
      
      const optimisticAssistantMessage: Message = {
        id: tempAssistantMessageId,
        content: isAgentChat ? "Agent is exploring..." : "",
        role: MessageRole.ASSISTANT,
        parent_id: tempUserMessageId,
        created_at: new Date().toISOString(),
        active_child_id: null,
        children: []
      };
      
      // Update local state optimistically
      setFlatMessages(prev => [...prev, optimisticUserMessage, optimisticAssistantMessage]);
      
      // Update active thread
      const newActiveThread = [...activeThreadIds, tempUserMessageId, tempAssistantMessageId];
      setActiveThreadIds(newActiveThread);
      
      // Rebuild tree with optimistic messages
      const updatedTree = buildMessageTree([...flatMessages, optimisticUserMessage, optimisticAssistantMessage]);
      setMessageTree(updatedTree);
      
      try {
        // Use existing API call
        if (isAgentChat) {
          const result = await agentApi.sendAgentMessage(
            conversationId,
            content,
            parentId
          );
          
          return [result.message_id, result.message_id];
        } else {
          // For regular chats, use the existing API
          const [message, responseMessageId] = await conversationApi.sendMessage(
            conversationId, 
            content, 
            parentId, 
            activeThreadIds.filter(id => !id.startsWith('temp-')), // Filter out temp IDs
            selectedBlockId || undefined
          );
          
          return [message.id, responseMessageId];
        }
      } catch (err) {
        // On error, revert the optimistic update by refreshing
        refreshTree();
        setError(err instanceof Error ? err : new Error('Failed to send message'));
        throw err;
      }
    },
    [conversationId, activeThreadIds, flatMessages, buildMessageTree, refreshTree, isAgentChat, selectedBlockId]
  );

  // Function to optimistically edit a message with immediate UI feedback
  const optimisticEditMessage = useCallback(
    async (messageId: string, content: string): Promise<[string, string]> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }

      // Find the message to edit
      const messageToEdit = flatMessages.find(msg => msg.id === messageId);
      if (!messageToEdit) {
        throw new Error(`Message with ID ${messageId} not found`);
      }
      
      // Get the parent ID for this message
      const parentId = messageToEdit.parent_id || '';
      console.log("Optimistic edit with parent:", parentId);

      // Generate temporary IDs
      const tempEditedMessageId = `temp-user-edit-${Date.now()}`;
      const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
      
      // Create optimistic messages
      const optimisticEditedMessage: Message = {
        ...messageToEdit,
        id: tempEditedMessageId,
        content: content,
        active_child_id: tempAssistantMessageId
      };
      
      // Create assistant message with appropriate content based on chat type
      const optimisticAssistantMessage: Message = {
        id: tempAssistantMessageId,
        content: isAgentChat ? "Agent is exploring..." : "",
        role: MessageRole.ASSISTANT,
        parent_id: tempEditedMessageId,
        created_at: new Date().toISOString(),
        active_child_id: null,
        children: []
      };
      
      // Create a new messages array with the edited message replacing the original
      const updatedMessages = flatMessages.map(msg => 
        msg.id === messageId ? optimisticEditedMessage : msg
      );
      
      // Add the new assistant message
      updatedMessages.push(optimisticAssistantMessage);
      
      // Update local state with our optimistic changes
      setFlatMessages(updatedMessages);
      
      // Update message tree and active thread
      const newActiveThread = [...activeThreadIds];
      const messageIndex = newActiveThread.indexOf(messageId);
      
      if (messageIndex !== -1) {
        // Replace the edited message ID and remove any subsequent messages
        newActiveThread[messageIndex] = tempEditedMessageId;
        newActiveThread.length = messageIndex + 1;
        // Add the new assistant message
        newActiveThread.push(tempAssistantMessageId);
        setActiveThreadIds(newActiveThread);
      }
      
      // Rebuild tree with optimistic messages
      const updatedTree = buildMessageTree(updatedMessages);
      setMessageTree(updatedTree);
      
      try {
        if (isAgentChat) {
          // For agent chats, use the agent API
          const { edited_message_id, placeholder_id } = await agentApi.editAgentMessage(
            conversationId,
            messageId,
            content,
            parentId
          );
          
          // For agent chats, we'll just wait a bit and then refresh the tree
          setTimeout(() => {
            refreshTree().catch(err => 
              console.error("Error refreshing tree after agent edit:", err)
            );
          }, 500);
          
          return [edited_message_id, placeholder_id];
        } else {
          // For regular chats, use the existing streaming API
          const [userMessageId, assistantMessageId] = await conversationApi.editMessageStreaming(
            conversationId,
            messageId,
            content,
            activeThreadIds.filter(id => !id.startsWith('temp-')), // Filter out temp IDs
            selectedBlockId || undefined
          );
          
          // Refresh tree to get real messages
          await refreshTree();
          
          return [userMessageId, assistantMessageId];
        }
      } catch (err) {
        // On error, revert the optimistic update by refreshing
        refreshTree();
        setError(err instanceof Error ? err : new Error('Failed to edit message'));
        throw err;
      }
    },
    [conversationId, activeThreadIds, flatMessages, buildMessageTree, refreshTree, isAgentChat, selectedBlockId]
  );

  return {
    messageTree,
    activeThreadIds, 
    isLoading,
    error,
    sendMessage,
    optimisticSendMessage,
    editMessage,
    optimisticEditMessage,
    editMessageStreaming,
    switchToVersion,
    refreshTree
  };
}
