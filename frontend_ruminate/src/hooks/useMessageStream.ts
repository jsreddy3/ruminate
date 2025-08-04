import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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

  // Reset isComplete when messageId changes
  useEffect(() => {
    if (messageId !== currentMessageRef.current) {
      // console.log('[useMessageStream] Message ID changed:', {
      //   oldId: currentMessageRef.current,
      //   newId: messageId,
      //   conversationId
      // });
      setIsComplete(false);
      currentMessageRef.current = messageId;
    }
  }, [conversationId, messageId]);

  useEffect(() => {
    // Don't attempt to stream if we don't have both IDs
    if (!conversationId || !messageId) {
      // console.log('[useMessageStream] Skipping stream - missing IDs:', { conversationId, messageId });
      return;
    }

    console.log('[useMessageStream] Starting stream for message:', messageId);
    // Reset state when message ID changes
    setContent('');
    setIsLoading(true);
    setIsComplete(false);
    setError(null);

    // Creating EventSource for streaming
    
    // Create EventSource for SSE connection with authentication
    const token = localStorage.getItem('auth_token');
    const streamUrl = `${API_BASE_URL}/conversations/streams/${messageId}`;
    const authenticatedStreamUrl = token ? `${streamUrl}?token=${token}` : streamUrl;
    let eventSource: EventSource;

    try {
      eventSource = new EventSource(authenticatedStreamUrl);

      // Handle incoming message chunks
      eventSource.onmessage = (event) => {
        const data = event.data;
        
        // Check for completion signal
        if (data === "[DONE]") {
          console.log('[useMessageStream] Stream completed for message:', messageId);
          setIsComplete(true);
          setIsLoading(false);
          eventSource.close();
        } else {
          // Append the new chunk to our content
          // console.log('[useMessageStream] Received chunk:', { 
          //   messageId, 
          //   chunkLength: data.length,
          //   chunkPreview: data.substring(0, 50) 
          // });
          setContent(prevContent => {
            const newContent = prevContent + data;
            // console.log('[useMessageStream] Content accumulated:', {
            //   messageId,
            //   totalLength: newContent.length
            // });
            return newContent;
          });
        }
      };

      // Handle connection established
      eventSource.onopen = () => {
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
        // console.log('[useMessageStream] Cleaning up EventSource for message:', messageId);
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
