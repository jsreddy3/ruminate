import React, { useRef, useEffect } from 'react';

interface ChatInputProps {
  value: string;
  isLoading: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  placeholder?: string;
}

export default function ChatInput({ 
  value, 
  isLoading, 
  onChange, 
  onSend,
  placeholder = "Ask about this block..."
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4 border-t border-neutral-200 bg-white">
      <div className="flex items-center space-x-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 p-3 border border-neutral-300 rounded-lg text-sm min-h-[40px] max-h-[200px] resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 overflow-y-auto"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
          }}
          disabled={isLoading}
        />
        <button
          onClick={onSend}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg text-white transition-colors duration-200 ${
            isLoading ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
