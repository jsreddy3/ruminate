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
    error: streamingError
  } = useMessageStream(conversationId, streamingMessageId);

  // Handle successful stream completion
  useEffect(() => {
    if (isStreamingComplete && streamingMessageId) {
      // Clear streaming state
      setStreamingMessageId(null);
      
      // Trigger callback to refresh the message tree
      if (onStreamComplete) {
        onStreamComplete();
      }
    }
  }, [isStreamingComplete, streamingMessageId, onStreamComplete]);

  // Handle streaming errors with fallback to refresh
  useEffect(() => {
    if (streamingError && streamingMessageId) {
      // Wait a bit for the message to be processed server-side
      const fallbackTimeout = setTimeout(() => {
        // Clear streaming state
        setStreamingMessageId(null);
        
        // Refresh to get the final message
        if (onStreamComplete) {
          onStreamComplete();
        }
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
    startStreaming,
    stopStreaming
  };
};