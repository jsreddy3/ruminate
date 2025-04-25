import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// Define types for agent events
export type AgentStatus = 'idle' | 'exploring' | 'completed' | 'error';

export interface AgentEvent {
  type: string;
  content?: string;
  metadata?: any;
  timestamp: number;
  step_number?: number;
  conversation_id?: string;
  message_id?: string;
}

/**
 * Hook for streaming agent events during an agent conversation
 * 
 * @param conversationId The ID of the agent conversation
 * @returns Object containing events, connection status, and agent progress status
 */
export function useAgentEventStream(conversationId: string | null): {
  events: AgentEvent[];
  status: AgentStatus;
  isConnected: boolean;
  error: Error | null;
} {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state when conversation ID changes
    setEvents([]);
    setStatus('idle');
    setIsConnected(false);
    setError(null);
    
    // Early return if no conversationId, but after resetting state
    if (!conversationId) {
      return;
    }

    // Create EventSource for SSE connection
    const eventSourceUrl = `${API_BASE_URL}/agent-rabbitholes/${conversationId}/events`;
    let eventSource: EventSource;

    try {
      eventSource = new EventSource(eventSourceUrl);
      
      // Define event handlers for different types of events
      
      // Connection established
      eventSource.addEventListener('connected', (event) => {
        setIsConnected(true);
        console.log('Connected to agent events stream');
        try {
          const data = JSON.parse(event.data);
          // Add a connection event
          addEvent('connected', 'Connected to agent', data);
        } catch (err) {
          console.error('Error parsing connected event data:', err);
        }
      });

      // Agent process started - handle both regular starts and edit-triggered starts
      eventSource.addEventListener('agent_started', (event) => {
        // Clear any previous live events when a new exploration begins
        setEvents([]);
        setStatus('exploring');
        console.log('Agent started exploring - status set to exploring');
        try {
          const data = JSON.parse(event.data);
          // Check if this is an edit operation
          const isEdit = data.is_edit || false;
          const eventText = isEdit ? 'Agent exploring edited message' : 'Agent started exploring';
          addEvent('agent_started', eventText, data);
        } catch (err) {
          console.error('Error parsing agent_started event data:', err);
        }
      });

      // Agent performing an action/step
      eventSource.addEventListener('agent_action', (event) => {
        try {
          const data = JSON.parse(event.data);
          addEvent('agent_action', data.content || 'Agent action', data);
        } catch (err) {
          console.error('Error parsing agent_action event data:', err);
        }
      });

      // Agent producing an answer
      eventSource.addEventListener('agent_answer', (event) => {
        try {
          const data = JSON.parse(event.data);
          addEvent('agent_answer', data.content || 'Agent answer', data);
        } catch (err) {
          console.error('Error parsing agent_answer event data:', err);
        }
      });

      // Step started
      eventSource.addEventListener('step.started', (event) => {
        try {
          const data = JSON.parse(event.data);
          addEvent('step.started', data.step_type || 'Step started', data);
        } catch (err) {
          console.error('Error parsing step.started event data:', err);
        }
      });

      // Step completed
      eventSource.addEventListener('step.completed', (event) => {
        try {
          const data = JSON.parse(event.data);
          addEvent('step.completed', data.content || 'Step completed', data);
        } catch (err) {
          console.error('Error parsing step.completed event data:', err);
        }
      });

      // Agent process completed - handle both regular completions and edit-triggered completions
      eventSource.addEventListener('agent_completed', (event) => {
        // Clear live events buffer when generation completes
        setEvents([]);
        setStatus('completed');
        console.log('Agent completed exploration - status set to completed');
        try {
          const data = JSON.parse(event.data);
          // Check if this is an edit operation
          const isEdit = data.is_edit || false;
          const eventText = isEdit ? 'Agent completed exploring edited message' : 'Agent exploration completed';
          addEvent('agent_completed', eventText, data);
        } catch (err) {
          console.error('Error parsing agent_completed event data:', err);
        }
      });

      // Agent encountered an error
      eventSource.addEventListener('agent_error', (event) => {
        setStatus('error');
        try {
          const data = JSON.parse(event.data);
          addEvent('agent_error', data.error || 'Agent encountered an error', data);
          setError(new Error(data.error || 'Agent process failed'));
        } catch (err) {
          console.error('Error parsing agent_error event data:', err);
          setError(new Error('Agent process failed with unknown error'));
        }
      });

      // Handle ping events (keep-alive)
      eventSource.addEventListener('ping', () => {
        // No state change needed for ping, just keep the connection alive
      });

      // Handle general errors
      eventSource.onerror = (event) => {
        console.error('Error in agent event stream:', event);
        setError(new Error('Connection to agent events failed'));
        setStatus('error');
        eventSource.close();
      };
    } catch (err) {
      console.error('Failed to create EventSource for agent events:', err);
      setError(err instanceof Error ? err : new Error('Failed to connect to agent events'));
      setStatus('error');
    }

    // Helper function to add an event to the events array
    function addEvent(type: string, content: string, data: any = {}) {
      const newEvent: AgentEvent = {
        type,
        content,
        metadata: data,
        timestamp: Date.now(),
        step_number: data.step_number,
        conversation_id: data.conversation_id || conversationId,
        message_id: data.message_id
      };
      setEvents(prevEvents => [...prevEvents, newEvent]);
    }

    // Clean up the connection when the component unmounts or conversationId changes
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [conversationId]);

  // Add idle timeout to close connection after period of inactivity
  useEffect(() => {
    if (!conversationId) return;
    
    // Use a ref to track the EventSource created in the main effect
    // We can't directly access it, so instead we'll let the main effect cleanup handle closing
    let isConnectionActive = true;
    
    // 30 minutes of inactivity before closing the connection
    const IDLE_TIMEOUT = 10 * 60 * 1000;
    let idleTimer: NodeJS.Timeout;
    
    // Function to reset the idle timer
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.log(`Marking agent connection ${conversationId} as inactive after timeout`);
        isConnectionActive = false;
        setIsConnected(false);
        // We don't directly close the EventSource here,
        // instead we'll use the isConnected state to indicate the connection is idle
      }, IDLE_TIMEOUT);
    };
    
    // Events that indicate user activity
    const userActivityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    
    // Add event listeners for user activity
    userActivityEvents.forEach(eventType => {
      window.addEventListener(eventType, resetIdleTimer);
    });
    
    // Also reset on any new agent events
    if (events.length > 0) {
      resetIdleTimer();
    }
    
    // Initial timer setup
    resetIdleTimer();
    
    // Clean up event listeners and timer
    return () => {
      userActivityEvents.forEach(eventType => {
        window.removeEventListener(eventType, resetIdleTimer);
      });
      clearTimeout(idleTimer);
    };
  }, [conversationId, events.length]);

  return {
    events,
    status,
    isConnected,
    error,
  };
}
