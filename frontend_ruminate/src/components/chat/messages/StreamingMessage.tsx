import React from 'react';
import { MessageRole } from '../../../types/chat';

interface StreamingMessageProps {
  messageId: string;
  content: string;
}

/**
 * Component to display a message that's currently being streamed/generated
 */
const StreamingMessage: React.FC<StreamingMessageProps> = ({ messageId, content }) => {
  return (
    <div className="rounded-lg border p-3 bg-green-50 border-green-200 transition-all animate-pulse">
      {/* Message header */}
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm">
          AI Assistant
        </div>
        
        <div className="flex items-center space-x-1">
          <span className="text-xs text-gray-500">Generating</span>
          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
        </div>
      </div>
      
      {/* Streamed content */}
      <div className="prose prose-sm max-w-none mb-2">
        {content || 'Thinking...'}
      </div>
      
      {/* Timestamp */}
      <div className="text-xs text-gray-400 mt-1">
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default StreamingMessage; 