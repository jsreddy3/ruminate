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
    }
  }, [isStreamingComplete, streamingMessageId, onStreamComplete, streamingContent]);

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