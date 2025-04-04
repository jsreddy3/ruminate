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
  }, [conversationId]);

  const sendMessage = async (content: string, selectedBlockId?: string) => {
    if (!content.trim() || isLoading || !conversationId) return;
    setIsLoading(true);

    const parentMessage = displayedThread.length > 0 ? displayedThread[displayedThread.length - 1] : messageTree[0]; // Use root if thread empty
    if (!parentMessage) {
      console.error("Cannot send message: No parent message found.");
      setIsLoading(false);
      return;
    }

    // Create optimistic user message
    const userMessage: Message = {
      id: "unset-user-message-id",
      role: "user",
      content,
      parent_id: parentMessage.id,
      children: [],
      active_child_id: null,
      created_at: new Date().toISOString()
    };

    // --- Optimistic Update ---
    const tempThread = [...displayedThread, userMessage];
    setDisplayedThread(tempThread);

    try {
      const [aiResponse, backendUserId] = await conversationApi.sendMessage(
        conversationId,
        content,
        parentMessage.id,
        selectedBlockId // Pass selected block ID to API
      );

      // --- Update with Backend Data ---
      userMessage.id = backendUserId; // Update ID
      messagesById.set(backendUserId, userMessage); // Add to map with correct ID

      // Update parent's children and active_child_id in the map
      const parent = messagesById.get(parentMessage.id);
      if (parent) {
        if (!parent.children.some(c => c.id === userMessage.id)) { // Avoid duplicates if already optimistically added
          parent.children.push(userMessage);
        }
        parent.active_child_id = userMessage.id;
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
      console.error("Error sending message:", error);
      // Revert optimistic update: remove the temp user message
      setDisplayedThread(prev => prev.slice(0, -1));
      // Also remove from map if added optimistically
      messagesById.delete("unset-user-message-id");
      // Reset parent's active child if needed
      const parent = messagesById.get(parentMessage.id);
      if (parent && parent.active_child_id === "unset-user-message-id") {
        parent.active_child_id = null; // Or find the previous active child if necessary
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
      const [aiResponse, editedMessageId] = await conversationApi.editMessage(
        conversationId,
        messageId,
        editingContent
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
