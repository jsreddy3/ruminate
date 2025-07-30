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
      if (onStreamComplete) {
        onStreamComplete();
      }
      setStreamingMessageId(null);
    }
  }, [isStreamingComplete, streamingMessageId, onStreamComplete]);

  const startStreaming = useCallback((messageId: string) => {
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