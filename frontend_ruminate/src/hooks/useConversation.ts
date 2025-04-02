import { useState, useEffect } from 'react';
import type { Message } from '../types/chat';
import { getActiveThread, buildMessageTree } from '../utils/messageTreeUtils';
import { conversationApi } from '../services/api/conversation';
import { useScrollEffect } from './useScrollEffect';

interface UseConversationProps {
  documentId: string;
  blockId: string;
  existingConversationId?: string;
  onConversationCreated: (id: string) => void;
}

export function useConversation({
  documentId,
  blockId,
  existingConversationId,
  onConversationCreated
}: UseConversationProps) {
  const [conversationId, setConversationId] = useState<string | null>(existingConversationId || null);
  const [messageTree, setMessageTree] = useState<Message[]>([]);
  const [displayedThread, setDisplayedThread] = useState<Message[]>([]);
  const [messagesById, setMessagesById] = useState<Map<string, Message>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [newMessage, setNewMessage] = useState("");

  // Add scroll effect
  useScrollEffect(displayedThread);

  // Initialize conversation
  useEffect(() => {
    const initializeConversation = async () => {
      if (existingConversationId) {
        setConversationId(existingConversationId);
      } else {
        try {
          const convData = await conversationApi.create(documentId, blockId);
          setConversationId(convData.id);
          onConversationCreated(convData.id);
        } catch (err) {
          console.error("Error creating conversation:", err);
        }
      }
    };

    initializeConversation();
  }, [blockId, documentId, existingConversationId, onConversationCreated]);

  // Fetch conversation history
  useEffect(() => {
    const fetchConversationHistory = async () => {
      if (!conversationId) return;

      try {
        const messages = await conversationApi.getMessageTree(conversationId);
        
        if (!messages || messages.length === 0) {
          setMessageTree([]);
          setDisplayedThread([]);
          return;
        }

        const { tree, messageMap } = buildMessageTree(messages);
        const activeThread = getActiveThread(tree[0], messageMap);

        setMessageTree(tree);
        setMessagesById(messageMap);
        setDisplayedThread(activeThread);
      } catch (err) {
        console.error("Error fetching conversation history:", err);
      }
    };

    fetchConversationHistory();
  }, [conversationId]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !conversationId) return;
    setIsLoading(true);
    
    console.log("Sending message:", content);
    const parentMessage = displayedThread[displayedThread.length - 1];
    console.log("Parent message:", parentMessage);

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

    // Optimistic update
    parentMessage.children.push(userMessage);
    parentMessage.active_child_id = userMessage.id;
    setDisplayedThread(prev => [...prev, userMessage]);

    try {
      const [aiResponse, backendUserId] = await conversationApi.sendMessage(
        conversationId,
        content,
        parentMessage.id
      );
      
      userMessage.id = backendUserId;
      messagesById.set(backendUserId, userMessage);
      parentMessage.active_child_id = backendUserId;
      
      const aiMessage: Message = {
        id: aiResponse.id,
        role: aiResponse.role as "user" | "assistant" | "system",
        content: aiResponse.content,
        parent_id: userMessage.id,
        children: [],
        active_child_id: null,
        created_at: aiResponse.created_at
      };

      userMessage.children.push(aiMessage);
      userMessage.active_child_id = aiMessage.id;
      messagesById.set(aiMessage.id, aiMessage);

      setDisplayedThread(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      // Revert optimistic update
      parentMessage.children.pop();
      parentMessage.active_child_id = null;
      setDisplayedThread(prev => prev.slice(0, -1));
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
    conversationId,
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
