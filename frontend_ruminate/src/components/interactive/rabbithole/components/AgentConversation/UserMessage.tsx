// src/components/interactive/rabbithole/components/AgentConversation/UserMessage.tsx
import { Message } from "../../../../../types/chat";

interface UserMessageProps {
  message: Message;
}

export default function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="bg-blue-600 text-white p-3 rounded-lg shadow-sm max-w-[85%]">
        {message.content}
      </div>
    </div>
  );
}