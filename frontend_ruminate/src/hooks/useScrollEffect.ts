import { useEffect } from 'react';
import { Message } from '../types/chat';

export function useScrollEffect(displayedThread: Message[], isStreaming?: boolean) {
  useEffect(() => {
    // Scroll to bottom when messages change or streaming is active
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [displayedThread, isStreaming]);
}