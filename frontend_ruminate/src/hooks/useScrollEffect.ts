import { useEffect } from 'react';
import { Message } from '../types/chat';

export function useScrollEffect(displayedThread: Message[]) {
  useEffect(() => {
    if (displayedThread.length > 0) {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  }, [displayedThread]);
}