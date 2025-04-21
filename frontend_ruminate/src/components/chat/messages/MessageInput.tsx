import React, { useState, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  isDisabled?: boolean;
  placeholder?: string;
}

/**
 * Component for typing and sending messages
 */
const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isDisabled = false,
  placeholder = 'Type your message...'
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

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
    <div className="flex items-end space-x-2">
      <div className="flex-1">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          className={`w-full border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isDisabled ? 'bg-gray-100 text-gray-500' : 'bg-white'
          }`}
          rows={3}
        />
        <div className="text-xs text-gray-500 mt-1 text-right">
          Press Ctrl+Enter to send
        </div>
      </div>
      <button
        onClick={handleSend}
        disabled={isDisabled || !message.trim() || isSending}
        className={`px-4 py-2 rounded-md ${
          isDisabled || !message.trim() || isSending
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
};

export default MessageInput; 