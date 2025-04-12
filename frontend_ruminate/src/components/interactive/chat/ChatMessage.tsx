import React from 'react';
import { Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Message } from '../../../types/chat';

interface ChatMessageProps {
  message: Message;
  editingMessageId: string | null;
  editingContent: string;
  isLoading: boolean;
  messagesById: Map<string, Message>;
  onStartEdit: (message: Message) => void;
  onChangeEdit: (content: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string) => void;
  onVersionSwitch: (message: Message, newVersionId: string) => void;
}

const getVersionInfo = (message: Message, messagesById: Map<string, Message>) => {
  if (!message.parent_id) return null;
  
  const parent = messagesById.get(message.parent_id);
  if (!parent) return null;

  const siblings = parent.children;
  const currentIndex = siblings.findIndex(m => m.id === message.id);
  
  return {
    siblings,
    currentIndex,
    total: siblings.length,
    hasPrev: currentIndex > 0,
    hasNext: currentIndex < siblings.length - 1,
    prevMessage: currentIndex > 0 ? siblings[currentIndex - 1] : null,
    nextMessage: currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null
  };
};

export default function ChatMessage({
  message,
  editingMessageId,
  editingContent,
  isLoading,
  messagesById,
  onStartEdit,
  onChangeEdit,
  onCancelEdit,
  onSaveEdit,
  onVersionSwitch
}: ChatMessageProps) {
  const isEditing = editingMessageId === message.id;
  const versionInfo = message.role === 'user' ? getVersionInfo(message, messagesById) : null;

  if (isEditing) {
    return (
      <div className="flex flex-col w-full">
        <div className="flex flex-col space-y-2">
          <textarea
            value={editingContent}
            onChange={(e) => onChangeEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSaveEdit(message.id);
              }
            }}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[40px] max-h-[200px] resize-none overflow-y-auto"
            disabled={isLoading}
            placeholder="Edit your message..."
            autoFocus
            ref={(textareaRef) => {
              if (textareaRef) {
                textareaRef.style.height = 'auto';
                textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 200)}px`;
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={onCancelEdit}
              disabled={isLoading}
              className="px-3 py-1 bg-neutral-200 text-neutral-700 rounded-md hover:bg-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={() => onSaveEdit(message.id)}
              disabled={isLoading}
              className={`px-3 py-1 rounded-md transition-colors duration-200 ${
                isLoading
                  ? 'bg-primary-400 text-white cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className={`flex items-start ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      } w-full`}>
        {message.role === 'user' && (
          <button
            onClick={() => onStartEdit(message)}
            className="text-neutral-400 hover:text-neutral-600 transition-colors duration-200 mr-2 mt-2"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <div
          className={`whitespace-pre-wrap break-words ${
            message.role === 'assistant'
              ? 'bg-primary-50 text-neutral-800 p-3 rounded-lg shadow-sm w-fit max-w-[70%] border border-primary-100'
              : message.role === 'system'
              ? 'bg-neutral-100 text-neutral-600 p-3 rounded-lg shadow-sm w-fit max-w-[70%] border border-neutral-200 italic'
              : 'bg-primary-600 text-white p-3 rounded-lg shadow-sm w-fit max-w-[70%]'
          }`}
        >
          {message.content}
        </div>
      </div>

      {/* Version controls */}
      {message.role === 'user' && versionInfo && versionInfo.total > 1 && (
        <div className="flex justify-end items-center space-x-2 mt-1 text-neutral-400">
          <button
            onClick={() => versionInfo.prevMessage && onVersionSwitch(message, versionInfo.prevMessage.id)}
            disabled={!versionInfo.hasPrev}
            className={`p-1 rounded hover:bg-neutral-100 ${!versionInfo.hasPrev ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm">
            {versionInfo.currentIndex + 1}/{versionInfo.total}
          </span>
          <button
            onClick={() => versionInfo.nextMessage && onVersionSwitch(message, versionInfo.nextMessage.id)}
            disabled={!versionInfo.hasNext}
            className={`p-1 rounded hover:bg-neutral-100 ${!versionInfo.hasNext ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}