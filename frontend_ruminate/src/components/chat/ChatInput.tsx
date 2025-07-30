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