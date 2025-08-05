import { useState, useEffect, useCallback } from 'react';
import { useMessageStream } from './useMessageStream';

interface UseMessageStreamHandlerProps {
  conversationId: string | null;
  onStreamComplete?: () => void;
}

interface UseMessageStreamHandlerReturn {
  streamingMessageId: string | null;
  streamingContent: string;
  isStreamingComplete: boolean;
  isStreamingActive: boolean;
  streamingError: Error | null;
  webSearchEvent: any | null;
  startStreaming: (messageId: string) => void;
  stopStreaming: () => void;
}

/**
 * Higher-level hook that manages message streaming state and handles completion callbacks.
 * Coordinates between the streaming hook and the message tree refresh.
 */
export const useMessageStreamHandler = ({
  conversationId,
  onStreamComplete
}: UseMessageStreamHandlerProps): UseMessageStreamHandlerReturn => {
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // Get streaming state from the lower-level hook
  const {
    content: streamingContent,
    isComplete: isStreamingComplete,
    isLoading: isStreamingActive,
    error: streamingError,
    webSearchEvent
  } = useMessageStream(conversationId, streamingMessageId);

  // Handle successful stream completion
  useEffect(() => {
    if (isStreamingComplete && streamingMessageId) {
      // Trigger callback to refresh the message tree
      if (onStreamComplete) {
        onStreamComplete();
      }
      
      // Clear streaming state with a small delay to ensure refresh has time to fetch
      // Since backend now saves before [DONE], 500ms should be plenty
      const cleanupTimeout = setTimeout(() => {
        setStreamingMessageId(null);
      }, 500); // Half second delay to let refresh complete
      
      return () => clearTimeout(cleanupTimeout);
    }
  }, [isStreamingComplete, streamingMessageId, streamingContent, onStreamComplete]);

  // Handle streaming errors with fallback to refresh
  useEffect(() => {
    if (streamingError && streamingMessageId) {
      // Wait a bit for the message to be processed server-side
      const fallbackTimeout = setTimeout(() => {
        // Don't immediately clear streaming state here either
        // Let the refresh handle it
        
        // Refresh to get the final message
        if (onStreamComplete) {
          onStreamComplete();
        }
        
        // Add delayed cleanup as fallback
        setTimeout(() => {
          setStreamingMessageId(null);
        }, 3000);
      }, 2000);
      
      return () => clearTimeout(fallbackTimeout);
    }
  }, [streamingError, streamingMessageId, onStreamComplete]);

  // Start streaming for a message
  const startStreaming = useCallback((messageId: string) => {
    setStreamingMessageId(messageId);
  }, []);

  // Stop streaming manually
  const stopStreaming = useCallback(() => {
    setStreamingMessageId(null);
  }, []);

  return {
    streamingMessageId,
    streamingContent,
    isStreamingComplete,
    isStreamingActive,
    streamingError,
    webSearchEvent,
    startStreaming,
    stopStreaming
  };
};