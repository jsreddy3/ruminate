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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const eventSourceUrl = `${apiBaseUrl}/conversations/${conversationId}/messages/${aiMsgId}/stream`;
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
          // Update messagesById (important for full content on completion)
          setMessagesById(prevMap => {
            const newMap = new Map(prevMap);
            const streamingMsg = newMap.get(aiMsgId);
            if (streamingMsg) {
              streamingMsg.content += chunk;
              newMap.set(aiMsgId, { ...streamingMsg }); // Create new object reference
            }
            return newMap;
          });
          // Update displayedThread directly
          setDisplayedThread(prevThread => {
            return prevThread.map(msg => {
              if (msg.id === aiMsgId) {
                // Directly update content of the existing message object
                return { ...msg, content: msg.content + chunk };
              }
              return msg;
            });
          });
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

  async function streamAssistant(
    aiMsgId: string,
    conversationId: string,
    setMessagesById: (arg0: (prev: Map<string, Message>) => Map<string, Message>) => void,
    setDisplayedThread: (arg0: (prev: Message[]) => Message[]) => void,
    setIsLoading: (arg0: boolean) => void,
    setCurrentEventSource: (arg0: EventSource | null) => void,
  ) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const es = new EventSource(
      `${apiBaseUrl}/conversations/${conversationId}/messages/${aiMsgId}/stream`
    );
    setCurrentEventSource(es);
  
    // Handle messages from the stream
    es.onmessage = (event) => {
      const chunk = event.data;
      if (chunk === "[DONE]") {
        es.close();
        setCurrentEventSource(null);
        setIsLoading(false);
      } else {
        setMessagesById((prev) => {
          const m = new Map(prev);
          const msg = m.get(aiMsgId);
          if (msg) msg.content += chunk;
          return m;
        });
        setDisplayedThread((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, content: msg.content + chunk } : msg
          )
        );
      }
    };
  
    es.onerror = (err) => {
      console.error("SSE error:", err);
      es.close();
      setCurrentEventSource(null);
      setIsLoading(false);
    };
  }

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

      parent.active_child_id = editedMessageId;
      setMessagesById(prev => new Map(prev).set(parent.id, { ...parent }));
    } catch (error) {
      console.error("Error saving edit:", error);
    } finally {
      setIsLoading(false);
      setEditingMessageId(null);
      setEditingContent("");
    }
  };

  const handleSaveEditStreaming = async (messageId: string) => {
    if (!conversationId || !editingContent.trim() || isLoading) return;
  
    setIsLoading(true);
  
    /* ---------- 1. build optimistic state  ---------- */
  
    const tempEditedId = `temp-edit-${Date.now()}`;
    const parentOriginal = messagesById.get(
      messagesById.get(messageId)!.parent_id!
    )!;
  
    // brand‑new optimistic edit
    const optimisticEdited: Message = {
      id: tempEditedId,
      role: "user",
      content: editingContent,
      parent_id: parentOriginal.id,
      children: [],
      active_child_id: null,
      created_at: new Date().toISOString(),
    };
  
    // fresh copy of parent that points at the edit
    const parentUpdated: Message = {
      ...parentOriginal,
      children: [...parentOriginal.children, optimisticEdited],
      active_child_id: tempEditedId,
    };
  
    // build one coherent map
    const optimisticMap = new Map(messagesById);
    optimisticMap.set(parentUpdated.id, parentUpdated);
    optimisticMap.set(tempEditedId, optimisticEdited);
  
    // write it once
    setMessagesById(optimisticMap);
    setDisplayedThread(getActiveThread(messageTree[0], optimisticMap));
  
    /* ---------- 2. talk to backend  ---------- */
    try {
      const [realEditedId, aiMsgId] = await conversationApi.editMessageStreaming(
        conversationId,
        messageId,
        editingContent,
        Array.from(optimisticMap.keys()), // current active ids
        blockId
      );
  
      /* ---- swap temp id if server generated a real one ---- */
      let currentMap = optimisticMap;
      if (realEditedId !== tempEditedId) {
        const realEdited = { ...optimisticEdited, id: realEditedId };
        const parentFix   = {
          ...parentUpdated,
          active_child_id: realEditedId,
          children: parentUpdated.children.map(c =>
            c.id === tempEditedId ? realEdited : c
          ),
        };
  
        currentMap = new Map(currentMap);
        currentMap.delete(tempEditedId);
        currentMap.set(realEditedId, realEdited);
        currentMap.set(parentFix.id, parentFix);
        setMessagesById(currentMap);
      }
  
      /* ---------- 3. insert AI placeholder right after the edit ---------- */
      const placeholder: Message = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        parent_id: realEditedId,
        children: [],
        active_child_id: null,
        created_at: new Date().toISOString(),
      };
      currentMap = new Map(currentMap).set(aiMsgId, placeholder);
      setMessagesById(currentMap);
  
      // rebuild thread, then splice in the placeholder just below the edit
      setDisplayedThread(thread => {
        const fresh = getActiveThread(messageTree[0], currentMap);
        const idx   = fresh.findIndex(m => m.id === realEditedId);
        return [
          ...fresh.slice(0, idx + 1),
          placeholder,
          ...fresh.slice(idx + 1),
        ];
      });
  
      /* ---------- 4. stream tokens ---------- */
      await streamAssistant(
        aiMsgId,
        conversationId,
        setMessagesById,
        setDisplayedThread,
        setIsLoading,
        setCurrentEventSource
      );
  
    } catch (err) {
      console.error("edit stream failed:", err);
  
      // rollback: restore original branch
      const rolledBackParent: Message = {
        ...parentOriginal,
        // parentOriginal.children already contains the old user msg
        active_child_id: messageId,
      };
      const rolledBackMap = new Map(messagesById)
        .set(rolledBackParent.id, rolledBackParent); // clear temp edit indirectly
      setMessagesById(rolledBackMap);
      setDisplayedThread(getActiveThread(messageTree[0], rolledBackMap));
      setIsLoading(false);
    } finally {
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
    handleSaveEditStreaming,
    handleVersionSwitch,
    setEditingMessageId,
    setEditingContent,
    setDisplayedThread,
    setMessagesById
  };
}
