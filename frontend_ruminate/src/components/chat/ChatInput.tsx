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
    <div className="border-t p-3 bg-white">
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