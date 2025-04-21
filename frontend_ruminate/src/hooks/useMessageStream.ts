import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/**
 * Hook for streaming content of an assistant message as it's being generated
 * 
 * @param conversationId The ID of the conversation
 * @param messageId The ID of the assistant message to stream
 * @returns Object containing streaming content, loading and completion states
 */
export function useMessageStream(conversationId: string | null, messageId: string | null) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Don't attempt to stream if we don't have both IDs
    if (!conversationId || !messageId) {
      return;
    }

    // Reset state when message ID changes
    setContent('');
    setIsLoading(true);
    setIsComplete(false);
    setError(null);

    // Create EventSource for SSE connection
    const streamUrl = `${API_BASE_URL}/conversations/${conversationId}/messages/${messageId}/stream`;
    let eventSource: EventSource;

    try {
      eventSource = new EventSource(streamUrl);

      // Handle incoming message chunks
      eventSource.onmessage = (event) => {
        const data = event.data;
        
        // Check for completion signal
        if (data === "[DONE]") {
          setIsComplete(true);
          setIsLoading(false);
          eventSource.close();
        } else {
          // Append the new chunk to our content
          setContent(prevContent => prevContent + data);
        }
      };

      // Handle connection established
      eventSource.onopen = () => {
        setIsLoading(true);
      };

      // Handle errors
      eventSource.onerror = (event) => {
        console.error('Error in message stream:', event);
        setError(new Error('Connection to message stream failed'));
        setIsLoading(false);
        eventSource.close();
      };
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError(err instanceof Error ? err : new Error('Failed to connect to message stream'));
      setIsLoading(false);
    }

    // Clean up the connection when the component unmounts or messageId changes
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [conversationId, messageId]);

  return {
    content,
    isLoading,
    isComplete,
    error,
  };
}
