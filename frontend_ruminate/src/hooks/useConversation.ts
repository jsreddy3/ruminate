import { useState, useEffect } from 'react';
import type { Message } from '../types/chat';
import { getActiveThread, buildMessageTree } from '../utils/messageTreeUtils';
import { conversationApi } from '../services/api/conversation';
import { useScrollEffect } from './useScrollEffect';

interface UseConversationProps {
  documentId: string;
  conversationId: string;
  blockId?: string; // Optional, used for context when sending messages
}

export function useConversation({
  documentId,
  conversationId,
  blockId
}: UseConversationProps) {
  const [messageTree, setMessageTree] = useState<Message[]>([]);
  const [displayedThread, setDisplayedThread] = useState<Message[]>([]);
  const [messagesById, setMessagesById] = useState<Map<string, Message>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [newMessage, setNewMessage] = useState("");

  // Add scroll effect
  useScrollEffect(displayedThread);

  // Fetch conversation history
  useEffect(() => {
    const fetchConversationHistory = async () => {
      if (!conversationId) {
        setMessageTree([]);
        setDisplayedThread([]);
        setMessagesById(new Map());
        return;
      }

      setIsLoading(true); // Indicate loading history
      try {
        const messages = await conversationApi.getMessageTree(conversationId);
        
        if (!messages || messages.length === 0) {
          setMessageTree([]);
          setDisplayedThread([]);
          setMessagesById(new Map());
          return;
        }

        const { tree, messageMap } = buildMessageTree(messages);
        const activeThread = getActiveThread(tree[0], messageMap);

        setMessageTree(tree);
        setMessagesById(messageMap);
        setDisplayedThread(activeThread);
      } catch (err) {
        console.error("Error fetching conversation history:", err);
        // Handle error (e.g., show message)
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversationHistory();
  }, [conversationId]); // Only depends on conversationId, not blockId

  const sendMessage = async (content: string, selectedBlockId?: string) => {
    if (!content.trim() || isLoading || !conversationId) return;
    setIsLoading(true);

    // --- Determine the correct parent ID ---
    // Find the last message in the currently displayed thread
    const lastDisplayedMessage = displayedThread.length > 0
    ? displayedThread[displayedThread.length - 1]
    : null;

    // If no message is displayed (only system message exists), use the root message ID
    const parentIdToSend = lastDisplayedMessage
      ? lastDisplayedMessage.id
      : messageTree[0]?.id; // Use root message (system) if thread is empty

    if (!parentIdToSend) {
        console.error("Cannot send message: Could not determine parent message ID.");
        setIsLoading(false);
        return; // Prevent sending if parent cannot be determined
    }
    // --- End: Determine the correct parent ID ---

    // Create optimistic user message
    const userMessage: Message = {
      id: "unset-user-message-id",
      role: "user",
      content,
      parent_id: parentIdToSend,
      children: [],
      active_child_id: null,
      created_at: new Date().toISOString()
    };

    const tempThread = [...displayedThread, userMessage];
    setDisplayedThread(tempThread);

    try {
      // Collect IDs of all messages in the current displayed thread
      const activeThreadIds = displayedThread.map(msg => msg.id);
      
      const [aiResponse, backendUserId] = await conversationApi.sendMessage(
        conversationId,
        content,
        parentIdToSend,
        activeThreadIds, // Pass the active thread IDs
        selectedBlockId // Pass selected block ID to API
      );

      // --- Update with Backend Data ---
      userMessage.id = backendUserId; // Update ID
      messagesById.set(backendUserId, userMessage); // Add to map with correct ID

      // Update parent's children and active_child_id in the map
      const parent = messagesById.get(parentIdToSend);
      if (parent) {
        if (!parent.children.some(c => c.id === userMessage.id)) { // Avoid duplicates if already optimistically added
          parent.children.push(userMessage);
        }
        parent.active_child_id = userMessage.id;
      } else {
        // This case should be rare if parentIdToSend was validated or fetched correctly
        console.warn(`Parent message ${parentIdToSend} not found in map during update.`);
      }

      const aiMessage: Message = {
        id: aiResponse.id,
        role: aiResponse.role as "user" | "assistant" | "system",
        content: aiResponse.content,
        parent_id: userMessage.id,
        children: [],
        active_child_id: null,
        created_at: aiResponse.created_at
      };
      messagesById.set(aiMessage.id, aiMessage);

      // Update user message's children and active_child_id in the map
      userMessage.children.push(aiMessage);
      userMessage.active_child_id = aiMessage.id;

      // Recalculate displayed thread based on updated map/tree
      const newActiveThread = getActiveThread(messageTree[0], messagesById);
      setDisplayedThread(newActiveThread);

    } catch (error) {
      console.error("Error sending message:", error); // Keep error handling
      // Revert optimistic update
      setDisplayedThread(prev => prev.filter(msg => msg.id !== "unset-user-message-id")); // More robust removal
      messagesById.delete("unset-user-message-id");
      // Reset parent's active child if it was the optimistic one
      const parent = messagesById.get(parentIdToSend);
      if (parent && parent.active_child_id === "unset-user-message-id") {
        // Find the last *real* child of the parent before the optimistic one was added
        const realChildren = parent.children.filter(c => c.id !== "unset-user-message-id");
        parent.active_child_id = realChildren.length > 0 ? realChildren[realChildren.length - 1].id : null;
      }
    } finally {
      setNewMessage("");
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!conversationId || !editingContent.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // Collect IDs of all messages in the current displayed thread
      const activeThreadIds = displayedThread.map(msg => msg.id);
      
      const [aiResponse, editedMessageId] = await conversationApi.editMessage(
        conversationId,
        messageId,
        editingContent,
        activeThreadIds
      );
      
      const originalMessage = messagesById.get(messageId)!;
      const parent = messagesById.get(originalMessage.parent_id!)!;

      const editedMessage: Message = {
        id: editedMessageId,
        role: "user",
        content: editingContent,
        parent_id: parent.id,
        children: [],
        active_child_id: null,
        created_at: new Date().toISOString()
      };

      const aiMessage: Message = {
        id: aiResponse.id,
        role: aiResponse.role as "user" | "assistant" | "system",
        content: aiResponse.content,
        parent_id: editedMessageId,
        children: [],
        active_child_id: null,
        created_at: aiResponse.created_at
      };

      parent.children.push(editedMessage);
      parent.active_child_id = editedMessageId;
      editedMessage.children.push(aiMessage);
      editedMessage.active_child_id = aiMessage.id;

      messagesById.set(editedMessageId, editedMessage);
      messagesById.set(aiMessage.id, aiMessage);

      const newThread = getActiveThread(messageTree[0], messagesById);
      setDisplayedThread(newThread);
    } catch (error) {
      console.error("Error saving edit:", error);
    } finally {
      setIsLoading(false);
      setEditingMessageId(null);
      setEditingContent("");
    }
  };

  const handleVersionSwitch = (message: Message, newVersionId: string) => {
    if (!message.parent_id) return;
    
    const parent = messagesById.get(message.parent_id);
    if (!parent) return;

    parent.active_child_id = newVersionId;
    const newThread = getActiveThread(messageTree[0], messagesById);
    setDisplayedThread(newThread);
  };

  return {
    messageTree,
    displayedThread,
    messagesById,
    isLoading,
    editingMessageId,
    editingContent,
    newMessage,
    setNewMessage,
    sendMessage,
    handleSaveEdit,
    handleVersionSwitch,
    setEditingMessageId,
    setEditingContent,
    setDisplayedThread
  };
}
