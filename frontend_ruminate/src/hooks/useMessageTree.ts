import { useState, useEffect, useCallback } from 'react';
import { Message, MessageNode, MessageRole } from '../types/chat';
import { conversationApi } from '../services/api/conversation';

interface UseMessageTreeProps {
  conversationId: string | null;
  selectedBlockId?: string | null;
  currentPage?: number;
  blocks?: Array<{ id: string; page_number?: number; block_type: string; html_content?: string }>;
}

interface UseMessageTreeReturn {
  messageTree: MessageNode[];
  activeThreadIds: string[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, parentId: string) => Promise<[string, string]>;
  editMessage: (messageId: string, content: string) => Promise<[string, string]>;
  switchToVersion: (messageId: string) => void;
  refreshTree: () => Promise<void>;
  addSummaryToMessage: (summary: any) => void; // NEW: Optimistically add summary to most recent assistant message
}

/**
 * Hook for managing conversation message trees with versioning support
 */
export function useMessageTree({
  conversationId,
  selectedBlockId = null,
  currentPage = 1,
  blocks = []
}: UseMessageTreeProps): UseMessageTreeReturn {
  const [messageTree, setMessageTree] = useState<MessageNode[]>([]);
  const [flatMessages, setFlatMessages] = useState<Message[]>([]);
  const [activeThreadIds, setActiveThreadIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper function to get fallback block ID from current page
  const getFallbackBlockId = useCallback((): string | undefined => {
    if (!blocks || blocks.length === 0 || !currentPage) {
      return undefined;
    }
    
    // Find all blocks on the current page (excluding Page type)
    const currentPageBlocks = blocks.filter(block => 
      block.page_number === currentPage && 
      block.block_type !== "Page"
    );
    
    if (currentPageBlocks.length === 0) {
      return undefined;
    }
    
    // Helper function to extract text from HTML content
    const extractText = (htmlContent: string): string => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent || '';
      return (tempDiv.textContent || tempDiv.innerText || '').trim();
    };
    
    // Priority order for block types (most useful content first)
    const blockTypePriority = [
      'Text',
      'Paragraph', 
      'Caption',
      'FigureCaption',
      'ListItem',
      'List',
      'Title',
      'SectionHeader',
      'Header',
      'PageHeader',
      'PageFooter',
      'Footer'
    ];
    
    // Score blocks based on type priority and content length
    const scoredBlocks = currentPageBlocks.map(block => {
      const text = extractText(block.html_content || '');
      const textLength = text.length;
      const typePriority = blockTypePriority.indexOf(block.block_type);
      const typeScore = typePriority === -1 ? blockTypePriority.length : typePriority;
      
      // Prefer blocks with content, penalize empty blocks heavily
      const contentScore = textLength > 0 ? textLength : -1000;
      
      // Final score: prioritize type (lower index = better), then content length
      const finalScore = -typeScore * 1000 + contentScore;
      
      return {
        block,
        text,
        textLength,
        typeScore,
        finalScore
      };
    });
    
    // Sort by score (highest first) and pick the best one
    scoredBlocks.sort((a, b) => b.finalScore - a.finalScore);
    const bestBlock = scoredBlocks[0];
    
    if (bestBlock) {
      return bestBlock.block.id;
    }
    
    return undefined;
  }, [blocks, currentPage]);

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
      const response = await conversationApi.getMessageTree(conversationId);
      const messages = response.messages || response; // Handle both old and new format
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
        const response = await conversationApi.getMessageTree(conversationId);
        const messages = response.messages || response; // Handle both old and new format
        
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
    async (content: string, parentId: string): Promise<[string, string]> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }
      
      // 1. Create optimistic messages immediately
      const timestamp = new Date().toISOString();
      const tempUserMessageId = `temp-user-${Date.now()}-${Math.random()}`;
      const tempAiMessageId = `temp-ai-${Date.now()}-${Math.random()}`;
      
      const optimisticUserMessage: Message = {
        id: tempUserMessageId,
        content,
        role: MessageRole.USER,
        created_at: timestamp,
        parent_id: parentId,
        children: [],
        active_child_id: null
      };
      
      const optimisticAiMessage: Message = {
        id: tempAiMessageId,
        content: '',
        role: MessageRole.ASSISTANT,
        created_at: timestamp,
        parent_id: tempUserMessageId,
        children: [],
        active_child_id: null
      };
      
      // 2. Add optimistic messages to state immediately
      const newMessages = [...flatMessages, optimisticUserMessage, optimisticAiMessage];
      setFlatMessages(newMessages);
      
      // Rebuild tree with optimistic messages
      const newTree = buildMessageTree(newMessages);
      setMessageTree(newTree);
      
      // Update active thread to include new messages
      setActiveThreadIds(prev => [...prev, tempUserMessageId, tempAiMessageId]);
      
      try {
        // 3. Determine block ID to send (selected block or fallback to current page)
        const blockIdToSend = selectedBlockId || getFallbackBlockId();
        // 4. Make API call to get real IDs
        const { user_id, ai_id } = await conversationApi.sendMessage(
          conversationId, 
          content, 
          parentId, 
          activeThreadIds,
          blockIdToSend
        );
        
        // 4. Refresh tree - this will replace optimistic messages with real ones
        await refreshTree();
        
        return [user_id, ai_id];
      } catch (err) {
        // 5. On error, refresh tree to remove optimistic messages
        await refreshTree();
        setError(err instanceof Error ? err : new Error('Failed to send message'));
        throw err;
      }
    },
    [conversationId, activeThreadIds, selectedBlockId, getFallbackBlockId, refreshTree, flatMessages, buildMessageTree]
  );

  // Function to edit an existing message with streaming
  const editMessage = useCallback(
    async (messageId: string, content: string): Promise<[string, string]> => {
      if (!conversationId) {
        throw new Error("No active conversation");
      }
      
      // 1. Optimistically update the message content immediately
      const updatedMessages = flatMessages.map(msg => 
        msg.id === messageId ? { ...msg, content, updated_at: new Date().toISOString() } : msg
      );
      setFlatMessages(updatedMessages);
      
      // Rebuild tree with updated message
      const newTree = buildMessageTree(updatedMessages);
      setMessageTree(newTree);
      
      try {
        // 2. Determine block ID to send (selected block or fallback to current page)
        const blockIdToSend = selectedBlockId || getFallbackBlockId();
        
        // 3. Make API call to edit message
        const { user_id: userMessageId, ai_id: assistantMessageId } = await conversationApi.editMessageStreaming(
          conversationId,
          messageId,
          content,
          activeThreadIds,
          blockIdToSend
        );
        
        // 3. Refresh to get real data and new AI message
        await refreshTree();
        
        return [userMessageId, assistantMessageId];
      } catch (err) {
        // 4. On error, refresh to revert optimistic changes
        await refreshTree();
        setError(err instanceof Error ? err : new Error('Failed to edit message'));
        throw err;
      }
    },
    [conversationId, activeThreadIds, selectedBlockId, getFallbackBlockId, refreshTree, flatMessages, buildMessageTree]
  );


  // Function to switch to a different message version
  const switchToVersion = useCallback((messageId: string) => {
    // First find the message of the version we're switching to
    const targetMessage = flatMessages.find(msg => msg.id === messageId);
    if (!targetMessage || !targetMessage.parent_id) return;
    
    // For now, we'll just update our local state
    // The parent message stays the same, but we replace its child in the active thread
    const newActiveThreadIds = [...activeThreadIds];
    
    // Find the index of the parent in the active thread
    const parentIndex = newActiveThreadIds.indexOf(targetMessage.parent_id);
    
    if (parentIndex !== -1 && parentIndex < newActiveThreadIds.length - 1) {
      // Replace the old child with the new version
      const oldVersion = newActiveThreadIds[parentIndex + 1];
      newActiveThreadIds[parentIndex + 1] = messageId;
      
      // Remove any subsequent messages in the thread (children of the old version)
      const removedChildren = newActiveThreadIds.slice(parentIndex + 2);
      newActiveThreadIds.length = parentIndex + 2;
      
      // Find children of the selected version and add them to the thread
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
          
          currentId = nextChild.id;
        }
      }
      
      // Update active thread
      setActiveThreadIds(newActiveThreadIds);
      
      // Refresh to ensure we have the latest data
      refreshTree(true);
    } else {
    }
  }, [flatMessages, activeThreadIds, refreshTree]);


  // Function to optimistically add a summary to the most recent assistant message
  const addSummaryToMessage = useCallback((summary: any) => {
    // Find the most recent assistant message in the flat messages
    const assistantMessages = flatMessages.filter(msg => msg.role === MessageRole.ASSISTANT);
    if (assistantMessages.length === 0) return;
    
    const mostRecentAssistantMessage = assistantMessages[assistantMessages.length - 1];
    
    // Update the message with the new summary
    const updatedMessages = flatMessages.map(msg => {
      if (msg.id === mostRecentAssistantMessage.id) {
        const currentMetadata = msg.meta_data || {};
        const currentSummaries = currentMetadata.generated_summaries || [];
        
        return {
          ...msg,
          meta_data: {
            ...currentMetadata,
            generated_summaries: [...currentSummaries, summary]
          }
        };
      }
      return msg;
    });
    
    // Update state
    setFlatMessages(updatedMessages);
    
    // Rebuild tree structure
    const newTree = buildMessageTree(updatedMessages);
    setMessageTree(newTree);
  }, [flatMessages, buildMessageTree]);

  return {
    messageTree,
    activeThreadIds, 
    isLoading,
    error,
    sendMessage,
    editMessage,
    switchToVersion,
    refreshTree,
    addSummaryToMessage
  };
}
