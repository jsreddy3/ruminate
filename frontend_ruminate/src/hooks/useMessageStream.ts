import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Constants
const STREAM_COMPLETION_SIGNAL = "[DONE]";
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 3;

interface UseMessageStreamReturn {
  content: string;
  isLoading: boolean;
  isComplete: boolean;
  error: Error | null;
}

/**
 * Hook for streaming content of an assistant message as it's being generated.
 * Handles SSE connection, error recovery, and content accumulation.
 * 
 * @param conversationId - The ID of the conversation
 * @param messageId - The ID of the assistant message to stream
 * @returns Object containing streaming content, loading and completion states
 */
export function useMessageStream(
  conversationId: string | null, 
  messageId: string | null
): UseMessageStreamReturn {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Track the current message ID to detect changes
  const currentMessageRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up function to close EventSource and clear timeouts
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Reset state when message ID changes
  useEffect(() => {
    if (messageId !== currentMessageRef.current) {
      setIsComplete(false);
      currentMessageRef.current = messageId;
      reconnectAttemptsRef.current = 0;
    }
  }, [messageId]);

  // Main streaming effect
  useEffect(() => {
    // Skip if missing required IDs
    if (!conversationId || !messageId) {
      return;
    }

    // Reset state for new stream
    setContent('');
    setIsLoading(true);
    setIsComplete(false);
    setError(null);

    // Build authenticated URL
    const token = localStorage.getItem('auth_token');
    const streamUrl = `${API_BASE_URL}/conversations/streams/${messageId}`;
    const authenticatedUrl = token ? `${streamUrl}?token=${token}` : streamUrl;

    // Create SSE connection
    const createEventSource = () => {
      try {
        const eventSource = new EventSource(authenticatedUrl);
        eventSourceRef.current = eventSource;

        // Handle successful connection
        eventSource.onopen = () => {
          setIsLoading(true);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset reconnect counter on success
        };

        // Handle incoming message chunks
        eventSource.onmessage = (event) => {
          const data = event.data;
          
          if (data === STREAM_COMPLETION_SIGNAL) {
            // Stream completed successfully
            setIsComplete(true);
            setIsLoading(false);
            cleanup();
          } else {
            // Accumulate content
            setContent(prevContent => prevContent + data);
          }
        };

        // Handle connection errors
        eventSource.onerror = () => {
          // EventSource will auto-reconnect, but we handle persistent failures
          if (eventSource.readyState === EventSource.CLOSED) {
            // Connection closed, attempt reconnect if under limit
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttemptsRef.current++;
              const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);
              
              reconnectTimeoutRef.current = setTimeout(() => {
                createEventSource();
              }, delay);
            } else {
              // Max attempts reached, set error state
              setError(new Error('Failed to establish streaming connection'));
              setIsLoading(false);
              cleanup();
            }
          }
        };

      } catch (err) {
        // Handle EventSource creation failure
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect to message stream';
        setError(new Error(errorMessage));
        setIsLoading(false);
      }
    };

    // Start the connection
    createEventSource();

    // Cleanup on unmount or dependency change
    return cleanup;
  }, [conversationId, messageId, cleanup]);

  return {
    content,
    isLoading,
    isComplete,
    error,
  };
}