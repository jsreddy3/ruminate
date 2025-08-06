import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Constants
const STREAM_COMPLETION_SIGNAL = "[DONE]";

interface UseMessageStreamWithApprovalReturn {
  content: string;
  isLoading: boolean;
  isComplete: boolean;
  error: Error | null;
  webSearchEvent: any | null;
}

/**
 * Extended version of useMessageStream that also handles prompt approval events
 */
export function useMessageStreamWithApproval(
  conversationId: string | null, 
  messageId: string | null,
  onPromptApprovalEvent?: (data: any) => void
): UseMessageStreamWithApprovalReturn {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [webSearchEvent, setWebSearchEvent] = useState<any | null>(null);
  
  const currentMessageRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Skip if no message ID or conversation ID
    if (!messageId || !conversationId) {
      return;
    }

    // Skip if we're already streaming this message
    if (currentMessageRef.current === messageId) {
      return;
    }

    // Update current message reference
    currentMessageRef.current = messageId;

    // Reset state for new message
    setContent('');
    setIsLoading(true);
    setIsComplete(false);
    setError(null);
    setWebSearchEvent(null);

    // Clean up any existing connection
    cleanup();

    // Get auth token and create authenticated URL
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError(new Error('No authentication token found'));
      setIsLoading(false);
      return;
    }

    const authenticatedUrl = `${API_BASE_URL}/conversations/streams/${messageId}?token=${token}`;

    try {
      const eventSource = new EventSource(authenticatedUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsLoading(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        const data = event.data;
        
        if (data === STREAM_COMPLETION_SIGNAL) {
          setIsComplete(true);
          setIsLoading(false);
          cleanup();
        } else if (data.startsWith('{')) {
          // Try to parse as JSON event
          try {
            const jsonEvent = JSON.parse(data);
            
            // Handle prompt approval events
            if (jsonEvent.type === 'prompt_approval_required' || 
                jsonEvent.type === 'prompt_approved' || 
                jsonEvent.type === 'prompt_rejected') {
              if (onPromptApprovalEvent) {
                onPromptApprovalEvent(data);
              }
            }
            // Handle web search events
            else if (jsonEvent.type === 'tool_use' && jsonEvent.tool === 'web_search') {
              setWebSearchEvent(jsonEvent);
              if (jsonEvent.status === 'completed') {
                setTimeout(() => setWebSearchEvent(null), 2000);
              }
            }
          } catch {
            // Not valid JSON, treat as regular content
            setContent(prevContent => prevContent + data);
          }
        } else {
          // Regular text content
          setContent(prevContent => prevContent + data);
        }
      };

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setError(new Error('Streaming connection closed'));
          setIsLoading(false);
          cleanup();
        }
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to message stream';
      setError(new Error(errorMessage));
      setIsLoading(false);
    }

    return cleanup;
  }, [conversationId, messageId, cleanup, onPromptApprovalEvent]);

  return {
    content,
    isLoading,
    isComplete,
    error,
    webSearchEvent
  };
}