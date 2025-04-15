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
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null);

  // Add scroll effect
  useScrollEffect(displayedThread);

  // Cleanup EventSource on component unmount or conversation change
  useEffect(() => {
    return () => {
      if (currentEventSource) {
        console.log("Closing EventSource connection due to unmount/change.");
        currentEventSource.close();
        setCurrentEventSource(null);
      }
    };
  }, [currentEventSource]);

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

  const sendMessage = async (content: string, contextBlockId?: string) => {
    if (!content.trim() || isLoading || !conversationId) return;

    console.log("Sending message:", content, "Block ID:", contextBlockId);
    setIsLoading(true);
    setNewMessage(""); 

    // --- Optimistic UI Update for User Message --- 
    const tempUserMessageId = `temp-user-${Date.now()}`;
    const parentId = displayedThread.length > 0 ? displayedThread[displayedThread.length - 1].id : messageTree[0]?.id; // Get last message ID or root system message ID
    const userMsg: Message = {
      id: tempUserMessageId, // Temporary ID until backend confirms
      role: "user",
      content: content,
      parent_id: parentId,
      children: [],
      active_child_id: null,
      created_at: new Date().toISOString(),
    };

    // Update state: add user message
    setMessagesById(prev => new Map(prev).set(userMsg.id, userMsg));
    setDisplayedThread(prev => [...prev, userMsg]);

    try {
      const activeThreadIds = displayedThread.map(msg => msg.id);
      
      // --- Call Backend (gets user_msg_id, ai_msg_id) --- 
      const [ actualUserMsgId, aiMsgId ] = await conversationApi.sendMessage(
        conversationId,
        content,
        parentId ?? "", 
        activeThreadIds, // Send current displayed thread IDs
        contextBlockId // Optional block ID for context
      );

      // Update user message ID if backend returned a different one (unlikely but good practice)
      if (tempUserMessageId !== actualUserMsgId) {
         setMessagesById(prev => {
           const newMap = new Map(prev);
           const msg = newMap.get(tempUserMessageId);
           if (msg) {
             newMap.delete(tempUserMessageId);
             msg.id = actualUserMsgId;
             newMap.set(actualUserMsgId, msg);
           }
           return newMap;
         });
         setDisplayedThread(prev => 
           prev.map(msg => msg.id === tempUserMessageId ? { ...msg, id: actualUserMsgId } : msg)
         );
      }

      // --- Add Placeholder AI Message --- 
      const placeholderAiMsg: Message = {
        id: aiMsgId,
        role: "assistant",
        content: "", // Empty content initially
        parent_id: actualUserMsgId, // Parent is the confirmed user message
        children: [],
        active_child_id: null,
        created_at: new Date().toISOString(),
      };

      setMessagesById(prev => new Map(prev).set(aiMsgId, placeholderAiMsg));
      // Add placeholder to the *end* of the displayed thread
      setDisplayedThread(prev => {
          // Ensure user message exists before adding AI message
          const userMsgIndex = prev.findIndex(m => m.id === actualUserMsgId);
          if (userMsgIndex !== -1) {
              return [...prev, placeholderAiMsg];
          } else {
              // Handle case where user message might not be in state yet (should be rare)
              console.warn("User message not found in displayedThread when adding placeholder AI message");
              return [...prev, placeholderAiMsg];
          }
      });
      setStreamingMessageId(aiMsgId);
      setIsLoading(true); // Keep loading while streaming

      // --- Initiate SSE Connection --- 
      const eventSourceUrl = `/api/conversations/${conversationId}/messages/${aiMsgId}/stream`;
      console.log(`Connecting to SSE: ${eventSourceUrl}`);
      const es = new EventSource(eventSourceUrl);
      setCurrentEventSource(es); // Store the connection

      es.onmessage = (event) => {
        const chunk = event.data;
        // console.log("SSE chunk received:", chunk);
        if (chunk === "[DONE]") {
          console.log("SSE stream finished.");
          es.close();
          setCurrentEventSource(null);
          setStreamingMessageId(null);
          setIsLoading(false); // Stop loading indicator
          // Optionally: Fetch full tree again to ensure consistency, or trust stream
          // fetchConversationHistory(); 
        } else {
          // Update the content of the streaming message
          setMessagesById(prevMap => {
            const newMap = new Map(prevMap);
            const streamingMsg = newMap.get(aiMsgId);
            if (streamingMsg) {
              streamingMsg.content += chunk;
              newMap.set(aiMsgId, { ...streamingMsg }); // Create new object reference
            }
            return newMap;
          });
          // Force displayedThread update by creating new message object reference
          setDisplayedThread(prevThread => prevThread.map(msg => 
              msg.id === aiMsgId ? { ...messagesById.get(aiMsgId)! } : msg
          ));
        }
      };

      es.onerror = (error) => {
        console.error("SSE Error:", error);
        es.close();
        setCurrentEventSource(null);
        setStreamingMessageId(null);
        setIsLoading(false);
        // Update message to show error
        setMessagesById(prevMap => {
            const newMap = new Map(prevMap);
            const streamingMsg = newMap.get(aiMsgId);
            if (streamingMsg) {
              streamingMsg.content = "Error receiving response.";
              newMap.set(aiMsgId, { ...streamingMsg });
            }
            return newMap;
        });
        setDisplayedThread(prevThread => prevThread.map(msg => 
            msg.id === aiMsgId ? { ...messagesById.get(aiMsgId)! } : msg
        ));
      };

    } catch (error) {
      console.error("Failed to send message:", error);
      // Revert optimistic update on error
      setMessagesById(prev => { // Remove optimistic user message
         const newMap = new Map(prev);
         newMap.delete(tempUserMessageId);
         return newMap;
       });
      setDisplayedThread(prev => prev.filter(msg => msg.id !== tempUserMessageId));
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
