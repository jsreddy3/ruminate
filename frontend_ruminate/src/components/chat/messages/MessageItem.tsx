import React, { useState } from 'react';
import { MessageNode, MessageRole } from '../../../types/chat';

interface MessageItemProps {
  message: MessageNode;
  isActive: boolean;
  versions: MessageNode[];
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
}

/**
 * Renders a single message with editing and version controls
 */
const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isActive,
  versions,
  onSwitchVersion,
  onEditMessage
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
            {/* Edit button (for user messages) */}
            {canEdit && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-gray-500 hover:text-blue-600"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            )}
            
            {/* Version selector toggle (if multiple versions exist) */}
            {hasVersions && (
              <button
                onClick={() => setIsShowingVersions(!isShowingVersions)}
                className="text-xs text-gray-500 hover:text-blue-600"
              >
                {isShowingVersions ? 'Hide Versions' : 'Show Versions'}
              </button>
            )}
          </div>
        </div>
        
        {/* Message content - either editable or read-only */}
        {isEditing ? (
          <div className="mb-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleEditSubmit}
                className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none mb-2">
            {message.content}
          </div>
        )}
        
        {/* Version selector */}
        {isShowingVersions && hasVersions && (
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