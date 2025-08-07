import React, { useState, KeyboardEvent, useEffect } from 'react';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  isDisabled?: boolean;
  placeholder?: string;
  pendingText?: string;
  onTextConsumed?: () => void;
}

/**
 * Component for typing and sending messages
 */
const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isDisabled = false,
  placeholder = 'Type your message...',
  pendingText,
  onTextConsumed
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Handle pending text when it changes
  useEffect(() => {
    if (pendingText) {
      setMessage(prev => prev + (prev ? ' ' : '') + pendingText);
      onTextConsumed?.(); // Notify that text was consumed
    }
  }, [pendingText, onTextConsumed]);

  // Handle message submission
  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isDisabled || isSending) return;
    
    try {
      setIsSending(true);
      await onSendMessage(trimmedMessage);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      {/* Compact input area */}
      <div className="relative">
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Compose your message..."
            disabled={isDisabled}
            className={`
              w-full font-serif text-reading-primary resize-none text-base
              border border-library-sage-300 rounded-book
              focus:outline-none focus:border-library-mahogany-400
              shadow-inner transition-all duration-200 ease-out
              placeholder:text-reading-muted placeholder:italic placeholder:font-serif
              ${isDisabled 
                ? 'bg-library-sage-100 text-reading-muted cursor-not-allowed' 
                : 'bg-white'
              }
            `}
            style={{
              padding: '0.5rem 0.75rem',
              lineHeight: '1.4',
              minHeight: '44px',
              background: isDisabled ? undefined : 'white',
            }}
            rows={2}
          />
        </div>
        
        {/* Tight send row */}
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-1 text-xs text-reading-muted font-sans">
            <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13,3A9,9 0 0,0 4,12H1L4,15L7,12H4A7,7 0 0,1 11,5A7,7 0 0,1 18,12A7,7 0 0,1 11,19C10.5,19 10,18.9 9.5,18.8L8.8,20.3C9.9,20.8 10.9,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3M12,8V13L16.2,15.2L15,17L10,14.5V8H12Z"/>
            </svg>
            <span>Press ⌘+Enter</span>
          </div>
          
          <button
            onClick={handleSend}
            disabled={isDisabled || !message.trim() || isSending}
            className={`
              group relative px-3 py-1.5 rounded-book font-serif text-sm
              transition-all duration-150 ease-out
              ${isDisabled || !message.trim() || isSending
                ? 'bg-library-sage-200 text-library-sage-500 cursor-not-allowed shadow-none'
                : 'bg-library-mahogany-600 text-library-cream-50 hover:bg-library-mahogany-700'
              }
            `}
          >
            <div className="flex items-center gap-1.5">
              {isSending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                  </svg>
                  <span>Send</span>
                </>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput; 