import { useState, useEffect, useCallback, useRef } from 'react';
import { useConversation } from './useConversation';
import { Message } from '../types/chat';
import { sendAgentMessage as apiSendAgentMessage, connectToAgentEvents as apiConnectToAgentEvents } from '../services/rabbithole';
import { conversationApi } from '../services/api/conversation';
import { buildMessageTree, getActiveThread } from '../utils/messageTreeUtils';
import { editAgentMessage } from "../services/rabbithole";
import { applyOptimisticEdit } from "../utils/applyOptimisticEdit";

// Define agent event types
export type AgentEventType = 
  | 'agent_started'
  | 'agent_action'
  | 'agent_answer'
  | 'agent_timeout'
  | 'agent_error'
  | 'agent_completed';

export interface AgentEvent {
  type: AgentEventType;
  action?: string;
  input?: string;
  result_preview?: string;
  message?: string;
  timestamp: number;
}

// The hook
export function useAgentConversation({
  documentId,
  conversationId,
  blockId
}: {
  documentId: string;
  conversationId: string | null;
  blockId?: string;
}) {
  // Use the standard conversation hook for message tree management
  const conversationHook = useConversation({
    documentId,
    conversationId: conversationId || "",
    blockId
  });
  
  const { 
    messageTree, 
    displayedThread, 
    messagesById,
    isLoading: isChatLoading,
    setDisplayedThread,
    setNewMessage,
    setMessagesById
  } = conversationHook;
  
  // Agent-specific state
  const [currentEvents, setCurrentEvents] = useState<AgentEvent[]>([]);
  const [eventsMap, setEventsMap] = useState<Map<string, AgentEvent[]>>(new Map());
  const [agentStatus, setAgentStatus] = useState<'idle' | 'exploring' | 'completed' | 'error'>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(isChatLoading);
  const [isMessageTreeLoaded, setIsMessageTreeLoaded] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [shouldConnectSSE, setShouldConnectSSE] = useState(false);
  
  // Track optimistic message IDs
  const optimisticMessageId = useRef<string | null>(null);
  
  // Reset state when conversation changes
  useEffect(() => {
    setShouldConnectSSE(false);
    setCurrentEvents([]);
    setEventsMap(new Map());
    setAgentStatus('idle');
    setIsMessageTreeLoaded(false);
    setCurrentMessageId(null);
    optimisticMessageId.current = null;
    // console.log('Conversation changed, resetting agent state');
  }, [conversationId]);
  
  // Setup SSE connection
  useEffect(() => {
    if (!conversationId || !shouldConnectSSE) return;
    
    let eventSource: EventSource | null = null;
    let isActive = true;
    
    // Helper to close and cleanup eventSource
    const closeEventSource = () => {
      if (eventSource) {
        console.log('Closing SSE connection for conversation:', conversationId);
        eventSource.close();
        eventSource = null;
      }
    };
    
    const setupEventSource = () => {
      eventSource = apiConnectToAgentEvents(conversationId);
      
      // Connection established
      eventSource.addEventListener('connected', (e) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(e.data);
          setIsConnected(true);
          console.log('Connected to agent events:', data);
          
          // We no longer use rootMessageId, so we don't need to set it
        } catch (error) {
          console.error('Error parsing connected event:', error);
        }
      });
      
      // Agent started
      eventSource.addEventListener('agent_started', (e) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(e.data);
          setAgentStatus('exploring');
          console.log('Agent started:', data);
          
          // Get the latest AI message to associate events with
          const lastAiMessage = [...displayedThread].reverse()
            .find(msg => msg.role === 'assistant');
            
          if (lastAiMessage) {
            console.log('Setting current message ID for events:', lastAiMessage.id);
            setCurrentMessageId(lastAiMessage.id);
          }
        } catch (error) {
          console.error('Error parsing agent_started event:', error);
        }
      });
      
      // Agent completed
      eventSource.addEventListener('agent_completed', (e) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(e.data);
          console.log('Agent completed:', data);
          
          // Store current events with the message ID when completed
          if (currentMessageId && currentEvents.length > 0) {
            console.log(`Storing ${currentEvents.length} events for message ${currentMessageId}`);
            
            // IMPORTANT: We need to preserve these events and make sure they don't get cleared
            // Copy them to a constant to ensure they don't get lost during state updates
            const eventsToStore = [...currentEvents];
            
            setEventsMap(prev => {
              const newMap = new Map(prev);
              newMap.set(currentMessageId, eventsToStore);
              return newMap;
            });
            
            // Don't clear currentEvents yet, let the AgentMessage component 
            // handle the transition from real-time to stored events
          }
          
          // CRITICAL: Implement a smoother transition between SSEs and the final message
          if (conversationId) {
            // 1. First, use a small delay to ensure the backend has finished processing
            setTimeout(async () => {
              try {
                // 2. Re-fetch conversation tree to update with AI response
                await refreshMessageTree();
                
                // 3. Only after the tree is refreshed, update the agent status
                // This ensures we don't have a jarring transition where content
                // disappears momentarily
                setTimeout(() => {
                  setAgentStatus('completed');
                  // Close connection as the agent process is complete
                  closeEventSource();
                }, 200); // Small additional delay for a smooth transition
              } catch (err) {
                console.error('Error refreshing conversation after agent completion:', err);
                setAgentStatus('completed'); // Set completed even if refresh fails
                closeEventSource(); // Close connection even if refresh fails
              }
            }, 1500); // Increased delay to ensure backend is ready
          }
        } catch (error) {
          console.error('Error parsing agent_completed event:', error);
        }
      });
      
      // Agent error
      eventSource.addEventListener('agent_error', (e) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(e.data);
          setAgentStatus('error');
          console.log('Agent error:', data);
          
          // Add to current events
          setCurrentEvents(prev => [
            ...prev,
            {
              type: 'agent_error',
              timestamp: Date.now(),
              message: data.message || 'An error occurred while processing your request.'
            }
          ]);
          
          // Add to events map
          if (currentMessageId) {
            setEventsMap(prevMap => {
              const newMap = new Map(prevMap);
              const messageEvents = newMap.get(currentMessageId) || [];
              newMap.set(currentMessageId, [
                ...messageEvents,
                {
                  type: 'agent_error',
                  timestamp: Date.now(),
                  message: data.message || 'An error occurred while processing your request.'
                }
              ]);
              return newMap;
            });
          }
          
          // Close connection as the agent process has errored
          closeEventSource();
        } catch (error) {
          console.error('Error parsing agent_error event:', error);
        }
      });
      
      // Agent timeout
      eventSource.addEventListener('agent_timeout', (e) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(e.data);
          setAgentStatus('error');
          console.log('Agent timeout:', data);
          
          // Close connection as the agent process has timed out
          closeEventSource();
        } catch (error) {
          console.error('Error parsing agent_timeout event:', error);
        }
      });
      
      // Agent action (exploration step)
      eventSource.addEventListener('agent_action', (e) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(e.data);
          const newEvent: AgentEvent = {
            type: 'agent_action',
            action: data.action,
            input: data.input,
            result_preview: data.result_preview,
            timestamp: Date.now()
          };
          
          setCurrentEvents(prev => [...prev, newEvent]);
          console.log('Agent action:', data);
          
          // If we have a current message ID, also update the map
          if (currentMessageId) {
            setEventsMap(prev => {
              const newMap = new Map(prev);
              const existing = prev.get(currentMessageId) || [];
              newMap.set(currentMessageId, [...existing, newEvent]);
              return newMap;
            });
          }
        } catch (error) {
          console.error('Error parsing agent_action event:', error);
        }
      });
      
      // Agent answer
      eventSource.addEventListener('agent_answer', (e) => {
        if (!isActive) return;
        
        try {
          const data = JSON.parse(e.data);
          const newEvent: AgentEvent = {
            type: 'agent_answer',
            message: data.answer,
            timestamp: Date.now()
          };
          
          setCurrentEvents(prev => [...prev, newEvent]);
          console.log('Agent answer:', data);
          
          // Store current events with the message ID when answer is received
          if (currentMessageId) {
            console.log(`Storing ${currentEvents.length} events for message ${currentMessageId}`);
            setEventsMap(prev => {
              const newMap = new Map(prev);
              const existing = prev.get(currentMessageId) || [];
              newMap.set(currentMessageId, [...existing, newEvent]);
              return newMap;
            });
          }
          // No teardown or refresh here; defer to agent_completed
        } catch (error) {
          console.error('Error parsing agent_answer event:', error);
        }
      });
      
      // Ping (keep-alive)
      eventSource.addEventListener('ping', () => {
        // No-op, just keeps connection alive
      });
      
      // General error handler
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        if (!isActive) return;
        
        setIsConnected(false);
        
        // Try to reconnect
        if (eventSource && isActive) {
          eventSource.close();
          setTimeout(setupEventSource, 3000);
        }
      };
    };
    
    setupEventSource();
    
    // Cleanup function
    return () => {
      isActive = false;
      closeEventSource();
    };
  }, [conversationId, shouldConnectSSE]);

  const handleSaveEditAgent = useCallback(
    async (messageId: string, newText: string) => {
      if (
        !conversationId ||
        !newText.trim() ||
        isLoading ||
        !messagesById ||                       // 
        messageTree.length === 0               //      
      ) {
        return;
      }
  
      /* optimistic branch */
      const result = applyOptimisticEdit(
        messageId,
        newText,
        messageTree,
        messagesById,
        displayedThread,  // new arg
      );
      if (!result) return;                 // guard against the rare null
      const { tempId, newMap } = result;
      setMessagesById(newMap);
      setDisplayedThread(getActiveThread(messageTree[0], newMap));
      setIsLoading(true);

      try {
        // ── 2. call backend
        const parentId = messagesById.get(messageId)?.parent_id ?? messageTree[0].id;
        const { message_id: editedId } = await editAgentMessage(
          conversationId,
          messageId,
          parentId,
          newText,
        );
        
        // swap temp → real
        setMessagesById(prev => {
          const m = new Map(prev);
          const msg = m.get(tempId)!;
          m.delete(tempId);
          msg.id = editedId;
          return m.set(editedId, msg);
        });
        setDisplayedThread(getActiveThread(messageTree[0], messagesById));
        console.log("Thread: ", displayedThread);
        // no streamAssistant call – SSE will populate content
      } catch (err) {
        console.error("agent edit failed", err);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, messagesById, messageTree, isLoading],
  );
  
  // Implementation of message tree refresh
  const refreshMessageTree = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      console.log('Refreshing message tree after agent completion...');
      
      // Directly fetch updated message tree from the API
      const messages = await conversationApi.getMessageTree(conversationId);
      
      if (!messages || messages.length === 0) {
        console.warn('No messages returned when refreshing message tree');
        return;
      }
      
      // Rebuild the message tree with the latest data
      const { tree, messageMap } = buildMessageTree(messages);
      const activeThread = getActiveThread(tree[0], messageMap);
      
      // Update the displayed thread directly - we don't have access to setMessageTree, 
      // but updating the displayed thread is the key part that shows the AI response
      setDisplayedThread(activeThread);
      
      console.log('Message tree refreshed successfully with', activeThread.length, 'messages');
    } catch (err) {
      console.error('Error refreshing message tree:', err);
    }
  }, [conversationId, setDisplayedThread]);
  
  // When messageTree is updated, mark as loaded
  useEffect(() => {
    if (messageTree.length > 0) {
      setIsMessageTreeLoaded(true);
    }
  }, [messageTree]);
  
  // Send message function that follows normal conversation pattern
  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !content.trim() || isLoading) {
      return;
    }
    
    // Don't allow sending messages until message tree is loaded
    if (!isMessageTreeLoaded || messageTree.length === 0) {
      console.warn('Cannot send message: message tree not loaded yet');
      return;
    }
    
    setIsLoading(true);
    setShouldConnectSSE(true);

    try {
      // Determine parent ID using same approach as regular conversations
      const lastDisplayedMessage = displayedThread.length > 0
        ? displayedThread[displayedThread.length - 1]
        : null;
        
      // If no message is displayed (only system message exists), use the root message ID
      const parentId = lastDisplayedMessage
        ? lastDisplayedMessage.id
        : messageTree[0]?.id; // Use root message (system) if thread is empty
        
      if (!parentId) {
        console.error("Cannot send message: Could not determine parent message ID.");
        setIsLoading(false);
        return;
      }
      
      // Create optimistic user message for UI
      const tempId = `temp-${Date.now()}`;
      optimisticMessageId.current = tempId;
      
      const userMessage: Message = {
        id: tempId,
        role: "user",
        content,
        parent_id: parentId,
        children: [],
        active_child_id: null,
        created_at: new Date().toISOString()
      };
      
      // Optimistically update UI
      setDisplayedThread([...displayedThread, userMessage]);
      
      // Reset current events for new message but keep the events map
      setCurrentEvents([]);
      setAgentStatus('idle');
      setCurrentMessageId(null);
      
      // Send to backend
      const response = await apiSendAgentMessage(
        conversationId,
        content,
        parentId
      );
      
      console.log('Message sent successfully:', response);
      
      // Clear input
      setNewMessage("");
      
      // Update optimistic message with real ID
      // (This might be unnecessary if conversation hook refreshes)
      setDisplayedThread(prev => 
        prev.map(msg => msg.id === tempId
          ? { ...msg, id: response.message_id }
          : msg
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove optimistic message on error
      if (optimisticMessageId.current) {
        setDisplayedThread(prev => 
          prev.filter(msg => msg.id !== optimisticMessageId.current)
        );
        optimisticMessageId.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    conversationId, 
    isLoading, 
    isMessageTreeLoaded, 
    messageTree, 
    displayedThread, 
    setDisplayedThread,
    setNewMessage,
    setShouldConnectSSE
  ]);
  
  // Sync loading state with agent status
  useEffect(() => {
    // Keep loading state true until all transitions are complete
    const newLoadingState = isChatLoading || agentStatus === 'exploring';
    
    // If we're transitioning from loading to not loading,
    // add a small delay to ensure smooth transitions
    if (isLoading && !newLoadingState) {
      // Small delay before setting loading to false to avoid content flashing
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    } else {
      setIsLoading(newLoadingState);
    }
  }, [isChatLoading, agentStatus, isLoading]);
  
  // Return all props from base hook plus agent-specific additions
  // Helper function to get events for a specific message
  const getEventsForMessage = useCallback((messageId: string) => {
    return eventsMap.get(messageId) || [];
  }, [eventsMap]);

  return {
    ...conversationHook,
    sendMessage, // Override with our version
    currentEvents,
    eventsMap,
    getEventsForMessage,
    agentStatus,
    isConnected,
    isLoading,
    refreshMessageTree, // Add our refresh method
    handleSaveEditAgent
  };
}