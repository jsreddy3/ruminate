import React from 'react';
import MessageInput from './messages/MessageInput';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isDisabled: boolean;
  pendingText?: string;
  onTextConsumed?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isDisabled,
  pendingText,
  onTextConsumed
}) => {
  return (
    <div className="border-t border-library-sage-200 p-4 bg-gradient-to-t from-surface-parchment to-library-cream-50 relative">
      {/* Decorative quill flourish */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-3 h-3 bg-library-gold-400 rounded-full shadow-sm opacity-60"></div>
      </div>
      
      <MessageInput
        onSendMessage={onSendMessage}
        isDisabled={isDisabled}
        pendingText={pendingText}
        onTextConsumed={onTextConsumed}
      />
    </div>
  );
};

export default ChatInput;