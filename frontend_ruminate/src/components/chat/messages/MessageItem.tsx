import React, { useState, useEffect } from 'react';
import { MessageNode, MessageRole } from '../../../types/chat';

interface MessageItemProps {
  message: MessageNode;
  isActive: boolean;
  versions: MessageNode[];
  isStreaming?: boolean;
  streamingContent?: string | null;
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  conversationId?: string;
}

/**
 * Renders a single message with editing and version controls
 */
const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isActive,
  versions,
  isStreaming = false,
  streamingContent = null,
  onSwitchVersion,
  onEditMessage,
  conversationId
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isShowingVersions, setIsShowingVersions] = useState(false);
  
  // Determine if this message can be edited (only user messages)
  const canEdit = message.role === MessageRole.USER;
  
  // Determine if this message has multiple versions
  const hasVersions = versions.length > 0;
  
  // Handle edit submission
  const handleEditSubmit = async () => {
    if (!canEdit || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    
    try {
      await onEditMessage(message.id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  // Handle role-based styling
  const getRoleStyles = () => {
    switch (message.role) {
      case MessageRole.USER:
        return 'bg-blue-50 border-blue-200';
      case MessageRole.ASSISTANT:
        return 'bg-green-50 border-green-200';
      case MessageRole.SYSTEM:
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  // Update edit content when message content changes
  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  return (
    <div className={`flex ${message.role === MessageRole.USER ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
          max-w-[85%] px-4 py-3 rounded-lg
          ${message.role === MessageRole.USER 
            ? 'bg-primary-50 text-black' 
            : 'bg-gray-100 text-black'}
          ${hasVersions && isActive ? 'border-2 border-primary-300' : ''}
        `}
      >
        {/* Message header */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-sm">
            {message.role === MessageRole.USER ? 'You' : 
              message.role === MessageRole.ASSISTANT ? 'AI Assistant' : 'System'}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Streaming indicator */}
            {isStreaming && message.role === MessageRole.ASSISTANT && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">Generating</span>
                <span className="inline-block w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse"></span>
              </div>
            )}
            
            {/* Edit button (for user messages) */}
            {canEdit && !isStreaming && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-gray-500 hover:text-blue-600"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            )}
            
            {/* Version selector toggle (if multiple versions exist) */}
            {hasVersions && !isStreaming && (
              <button
                onClick={() => setIsShowingVersions(!isShowingVersions)}
                className="text-xs text-gray-500 hover:text-blue-600"
              >
                {isShowingVersions ? 'Hide Versions' : 'Show Versions'}
              </button>
            )}
          </div>
        </div>
        
        {/* Message content */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Edit your message..."
              />
              <div className="flex justify-end mt-2 space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="px-3 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div>
              {message.role === MessageRole.ASSISTANT && isStreaming ? (
                // Show streaming content for assistant messages
                <>
                  {console.log(`MessageItem ${message.id}: streaming=${isStreaming}, content length=${streamingContent?.length || 0}, content="${streamingContent}"`)}
                  {streamingContent || 'AI is responding...'}
                </>
              ) : (
                // Show regular content
                message.content
              )}
            </div>
          )}
        </div>
        
        {/* Message versions */}
        {isShowingVersions && hasVersions && !isStreaming && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="text-xs font-medium mb-1">Message Versions:</div>
            <div className="space-y-1">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => onSwitchVersion(version.id)}
                  className={`text-xs w-full text-left px-2 py-1 rounded ${
                    version.id === message.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {version.content.substring(0, 50)}
                  {version.content.length > 50 ? '...' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Timestamp */}
        <div className="text-xs text-gray-400 mt-1">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;