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
      {/* ORNATE manuscript-style input area */}
      <div className="relative">
        {/* LUXURIOUS textarea with calligraphy styling */}
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Compose your message..."
            disabled={isDisabled}
            className={`
              w-full font-serif text-reading-primary resize-none text-xl 
              border-2 border-library-sage-300 rounded-journal
              focus:outline-none focus:border-library-mahogany-400
              shadow-inner transition-all duration-500 ease-out
              placeholder:text-reading-muted placeholder:italic placeholder:font-serif
              ${isDisabled 
                ? 'bg-library-sage-100 text-reading-muted cursor-not-allowed' 
                : 'bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment hover:from-library-cream-50 hover:to-library-cream-100'
              }
            `}
            style={{
              padding: '0.75rem 1rem',
              lineHeight: '1.6',
              minHeight: '60px',
              background: isDisabled ? undefined : `
                linear-gradient(135deg, #fefcf7 0%, #fcf0d2 50%, #fef9ed 100%),
                repeating-linear-gradient(0deg, transparent 0px, transparent 24px, rgba(175, 95, 55, 0.02) 24px, rgba(175, 95, 55, 0.02) 26px)
              `,
              boxShadow: `
                inset 0 2px 4px rgba(175, 95, 55, 0.08),
                inset 0 -1px 2px rgba(249, 207, 95, 0.1),
                0 4px 8px rgba(0, 0, 0, 0.05)
              `
            }}
            rows={2}
          />
          
        </div>
        
        {/* ELEGANT send button with manuscript styling */}
        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center gap-2 text-base text-reading-muted font-sans italic">
            <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13,3A9,9 0 0,0 4,12H1L4,15L7,12H4A7,7 0 0,1 11,5A7,7 0 0,1 18,12A7,7 0 0,1 11,19C10.5,19 10,18.9 9.5,18.8L8.8,20.3C9.9,20.8 10.9,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3M12,8V13L16.2,15.2L15,17L10,14.5V8H12Z"/>
            </svg>
            <span>Press ⌘+Enter to submit</span>
          </div>
          
          <button
            onClick={handleSend}
            disabled={isDisabled || !message.trim() || isSending}
            className={`
              group relative px-6 py-3 rounded-journal font-serif font-semibold text-base
              transition-all duration-300 ease-out
              ${isDisabled || !message.trim() || isSending
                ? 'bg-library-sage-200 text-library-sage-500 cursor-not-allowed shadow-none'
                : `bg-gradient-to-r from-library-mahogany-500 to-library-mahogany-600 
                   hover:from-library-mahogany-600 hover:to-library-mahogany-700
                   text-library-cream-50 shadow-book hover:shadow-deep
                   border border-library-mahogany-400 hover:scale-105
                   focus:outline-none focus:ring-4 focus:ring-library-gold-300`
              }
            `}
          >
            {/* Ornate button content */}
            <div className="flex items-center gap-2">
              {isSending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Inscribing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                  </svg>
                  <span>Send</span>
                </>
              )}
            </div>
            
            {/* Ornate button decoration */}
            {!isDisabled && !isSending && message.trim() && (
              <div className="absolute inset-0 bg-gradient-to-r from-library-gold-400/20 to-library-cream-100/20 rounded-journal opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput; 