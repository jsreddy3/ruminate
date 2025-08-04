import { useState, useEffect, useCallback } from 'react';
import { useMessageStream } from './useMessageStream';

interface UseMessageStreamHandlerProps {
  conversationId: string | null;
  onStreamComplete?: () => void;
}

export const useMessageStreamHandler = ({
  conversationId,
  onStreamComplete
}: UseMessageStreamHandlerProps) => {
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [failedStreamAttempts, setFailedStreamAttempts] = useState<number>(0);
  
  // Stream content for chats
  const {
    content: streamingContent,
    isComplete: isStreamingComplete,
    isLoading: isStreamingActive,
    error: streamingError
  } = useMessageStream(conversationId, streamingMessageId);

  // When streaming completes, call the callback and clear streaming state
  useEffect(() => {
    if (isStreamingComplete && streamingMessageId) {
      console.log('[useMessageStreamHandler] Stream complete, clearing state:', {
        streamingMessageId,
        contentLength: streamingContent.length
      });
      if (onStreamComplete) {
        onStreamComplete();
      }
      setStreamingMessageId(null);
      setFailedStreamAttempts(0);
    }
  }, [isStreamingComplete, streamingMessageId, onStreamComplete, streamingContent]);

  // Handle streaming errors with a delay before fallback
  useEffect(() => {
    if (streamingError && streamingMessageId) {
      console.log('[useMessageStreamHandler] Stream error detected, will fallback after delay:', {
        messageId: streamingMessageId,
        error: streamingError.message
      });
      
      // Wait 2 seconds before falling back to refresh
      // This gives the backend time to process the message
      const fallbackTimeout = setTimeout(() => {
        console.log('[useMessageStreamHandler] Falling back to refresh after stream error');
        setStreamingMessageId(null);
        setFailedStreamAttempts(0);
        if (onStreamComplete) {
          onStreamComplete(); // This will trigger refreshTree
        }
      }, 2000);
      
      return () => clearTimeout(fallbackTimeout);
    }
  }, [streamingError, streamingMessageId, onStreamComplete]);

  const startStreaming = useCallback((messageId: string) => {
    console.log('[useMessageStreamHandler] Starting stream for message:', messageId);
    setStreamingMessageId(messageId);
  }, []);

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