import { useState, useEffect, useRef } from 'react';

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
  const currentMessageRef = useRef<string | null>(null);

  // Add logging for when stream parameters change
  useEffect(() => {
    console.log("Stream params changed - conversationId:", conversationId, "messageId:", messageId);
    
    // Important: Reset isComplete when messageId changes
    // This prevents stale isComplete values from affecting new messages
    if (messageId !== currentMessageRef.current) {
      console.log(`Message ID changed from ${currentMessageRef.current} to ${messageId}, resetting isComplete`);
      setIsComplete(false);
      currentMessageRef.current = messageId;
    }
  }, [conversationId, messageId]);

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

    console.log(`Creating stream for message: ${messageId}. isComplete: ${isComplete}`);
    
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
          console.log(`Stream completed for message: ${messageId}`);
          setIsComplete(true);
          setIsLoading(false);
          eventSource.close();
        } else {
          // Log chunk size for debugging
          if (data.length > 0 && data.length % 50 === 0) {
            console.log(`Received ${data.length} chars for message: ${messageId}`);
          }
          
          // Append the new chunk to our content
          setContent(prevContent => prevContent + data);
        }
      };

      // Handle connection established
      eventSource.onopen = () => {
        console.log(`Stream connection opened for message: ${messageId}`);
        setIsLoading(true);
      };

      // Handle errors
      eventSource.onerror = (event) => {
        console.error(`Error in message stream for ${messageId}:`, event);
        setError(new Error('Connection to message stream failed'));
        setIsLoading(false);
        eventSource.close();
      };
    } catch (err) {
      console.error(`Failed to create EventSource for ${messageId}:`, err);
      setError(err instanceof Error ? err : new Error('Failed to connect to message stream'));
      setIsLoading(false);
    }

    // Clean up the connection when the component unmounts or messageId changes
    return () => {
      if (eventSource) {
        console.log(`Cleaning up stream for message: ${messageId}`);
        eventSource.close();
      }
    };
  }, [conversationId, messageId, isComplete]);

  return {
    content,
    isLoading,
    isComplete,
    error,
  };
}
