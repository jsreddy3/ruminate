import React, { useState, useEffect, memo } from 'react';
import { MessageNode, MessageRole, GeneratedSummary } from '../../../types/chat';
import MessageContentRenderer from './MessageContentRenderer';
import { PenTool, Glasses, Settings } from 'lucide-react';

interface MessageItemProps {
  message: MessageNode;
  isActive: boolean;
  versions: MessageNode[];
  isStreaming?: boolean;
  streamingContent?: string | null;
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  conversationId?: string;
  isCompact?: boolean;
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
  conversationId,
  isCompact = false
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
    if (isCompact) {
      return {
        container: message.role === MessageRole.USER ? 'bg-white border border-gray-200' : 'bg-gray-50 border border-gray-200',
        accent: '',
        glow: ''
      };
    }
    switch (message.role) {
      case MessageRole.USER:
        return {
          container: 'bg-gradient-to-br from-library-mahogany-50 via-surface-parchment to-library-cream-100 border-2 border-library-mahogany-300 shadow-deep',
          accent: 'border-l-4 border-library-mahogany-500',
          glow: 'shadow-[0_0_20px_rgba(175,95,55,0.3)]'
        };
      case MessageRole.ASSISTANT:
        return {
          container: 'bg-gradient-to-br from-library-forest-50 via-library-sage-50 to-surface-parchment border-2 border-library-forest-300 shadow-deep',
          accent: 'border-l-4 border-library-forest-500',
          glow: 'shadow-[0_0_20px_rgba(90,115,95,0.3)]'
        };
      case MessageRole.SYSTEM:
        return {
          container: 'bg-gradient-to-br from-library-gold-50 via-surface-aged to-library-cream-100 border-2 border-library-gold-300 shadow-shelf',
          accent: 'border-l-4 border-library-gold-500',
          glow: 'shadow-[0_0_15px_rgba(249,207,95,0.4)]'
        };
      default:
        return {
          container: 'bg-gradient-to-br from-surface-paper to-library-cream-100 border-2 border-library-sage-300 shadow-paper',
          accent: 'border-l-4 border-library-sage-400',
          glow: 'shadow-[0_0_10px_rgba(121,135,121,0.2)]'
        };
    }
  };

  // Update edit content when message content changes
  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  const styles = getRoleStyles();
  
  if (isCompact) {
    // Ultra-compact rendering for rabbitholes with minimal labels
    const roleLabel = message.role === MessageRole.USER ? 'You' : message.role === MessageRole.ASSISTANT ? 'Co-Reader' : 'System';
    const dotColor = message.role === MessageRole.USER ? 'bg-library-mahogany-500' : message.role === MessageRole.ASSISTANT ? 'bg-library-forest-500' : 'bg-library-gold-500';

    return (
      <div className={`flex ${message.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[92%] rounded-md ${styles.container} p-2`}> 
          {/* Tiny header row */}
          <div className="flex items-center justify-between gap-1.5 mb-1 min-h-[14px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
              <span className="text-[11px] font-medium text-gray-600 truncate max-w-[70%]">{roleLabel}</span>
            </div>
            {canEdit && !isStreaming && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                title={isEditing ? 'Cancel editing' : 'Edit message'}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                </svg>
              </button>
            )}
          </div>
          <div className="text-sm leading-6 text-reading-primary px-1.5 py-0.5">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="w-full p-2 text-sm font-serif border border-gray-300 rounded focus:outline-none focus:border-gray-500 bg-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    className="px-2 py-1 text-xs rounded bg-library-mahogany-600 text-white hover:bg-library-mahogany-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <MessageContentRenderer
                content={message.content}
                role={message.role as MessageRole}
                isStreaming={isStreaming}
                streamingContent={streamingContent}
                disableDropCap={true}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex ${message.role === MessageRole.USER ? 'justify-end' : 'justify-start'} mb-8 px-4`}>
      {/* DRAMATIC manuscript-style message container */}
      <div
        className={`
          relative max-w-[90%] rounded-journal backdrop-blur-sm
          ${styles.container}
          ${styles.glow}
          transition-all duration-500 ease-out
          hover:shadow-[0_0_30px_rgba(0,0,0,0.15)]
          transform hover:scale-[1.02]
        `}
      >
        
        {/* Elegant border accent */}
        <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${styles.accent.replace('border-l-4', 'bg-gradient-to-b from-transparent via-current to-transparent')}`}></div>
        
        <div className="relative p-6"
          style={{
            background: `
              radial-gradient(circle at top left, rgba(249, 207, 95, 0.05) 0%, transparent 50%),
              radial-gradient(circle at bottom right, rgba(175, 95, 55, 0.05) 0%, transparent 50%)
            `
          }}
        >
        {/* ORNATE message header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-library-sage-200/50 min-h-[3rem]">
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Role icon */}
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${message.role === MessageRole.USER 
                ? 'bg-gradient-to-br from-library-mahogany-400 to-library-mahogany-600 shadow-[0_0_15px_rgba(175,95,55,0.4)]' 
                : message.role === MessageRole.ASSISTANT
                  ? 'bg-gradient-to-br from-library-forest-400 to-library-forest-600 shadow-[0_0_15px_rgba(90,115,95,0.4)]'
                  : 'bg-gradient-to-br from-library-gold-400 to-library-gold-600 shadow-[0_0_15px_rgba(249,207,95,0.4)]'
              }
            `}>
              {message.role === MessageRole.USER ? (
                <PenTool className="w-4 h-4 text-library-cream-50" />
              ) : message.role === MessageRole.ASSISTANT ? (
                <Glasses className="w-5 h-5 text-library-cream-50" />
              ) : (
                <Settings className="w-4 h-4 text-library-cream-50" />
              )}
            </div>
            
            {/* Role title */}
            <div className="flex flex-col">
              <div className={`font-serif font-bold text-base whitespace-nowrap ${
                message.role === MessageRole.USER ? 'text-library-mahogany-700' :
                message.role === MessageRole.ASSISTANT ? 'text-library-forest-700' : 'text-library-gold-700'
              }`}>
                {message.role === MessageRole.USER ? 'Inquirer' : 
                  message.role === MessageRole.ASSISTANT ? 'Co-Reader' : 'Scribe'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
            {isStreaming && message.role === MessageRole.ASSISTANT && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-library-forest-100 to-library-sage-100 rounded-book border border-library-forest-200">
                <span className="text-sm font-serif text-library-forest-700">Contemplating...</span>
              </div>
            )}
            
            {canEdit && !isStreaming && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="group flex items-center justify-center w-8 h-8 bg-gradient-to-r from-library-mahogany-100 to-library-mahogany-200 hover:from-library-mahogany-200 hover:to-library-mahogany-300 text-library-mahogany-700 hover:text-library-mahogany-800 rounded-book transition-all duration-300 shadow-paper hover:shadow-book border border-library-mahogany-200"
                title={isEditing ? 'Cancel editing' : 'Edit message'}
              >
                <svg className="w-3 h-3 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                </svg>
              </button>
            )}
            
          </div>
        </div>
        
        {/* Message content */}
        <div className="relative">
          {isEditing ? (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full p-4 font-serif text-reading-primary bg-gradient-to-br from-surface-paper to-library-cream-50 border-2 border-library-sage-300 rounded-journal focus:outline-none focus:border-library-mahogany-400 shadow-inner transition-all duration-300 placeholder:text-reading-muted placeholder:italic"
                  placeholder="Refine your scholarly thoughts..."
                  style={{
                    background: `
                      linear-gradient(135deg, #fefcf7 0%, #fcf0d2 100%),
                      repeating-linear-gradient(0deg, transparent 0px, transparent 22px, rgba(175, 95, 55, 0.03) 22px, rgba(175, 95, 55, 0.03) 24px)
                    `,
                    lineHeight: '1.8'
                  }}
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-library-sage-100 to-library-sage-200 hover:from-library-sage-200 hover:to-library-sage-300 text-library-sage-700 hover:text-library-sage-800 rounded-book transition-all duration-300 shadow-paper hover:shadow-book border border-library-sage-300"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                  <span className="text-sm font-serif font-medium">Cancel</span>
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-library-mahogany-500 to-library-mahogany-600 hover:from-library-mahogany-600 hover:to-library-mahogany-700 text-library-cream-50 rounded-book transition-all duration-300 shadow-book hover:shadow-deep border border-library-mahogany-400"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                  </svg>
                  <span className="text-sm font-serif font-medium">Preserve</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="font-serif text-lg leading-relaxed text-reading-primary">
                <MessageContentRenderer
                  content={message.content}
                  role={message.role as MessageRole}
                  isStreaming={isStreaming}
                  streamingContent={streamingContent}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with versions and timestamp */}
        <div className="flex items-center justify-between mt-4 pt-2 border-t border-library-sage-200/30">
          {hasVersions && versions.length > 1 && !isStreaming && (() => {
            const currentIndex = versions.findIndex(v => v.id === message.id);
            const totalVersions = versions.length;
            const canGoPrev = currentIndex > 0;
            const canGoNext = currentIndex < totalVersions - 1;
            
            return (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => canGoPrev && onSwitchVersion(versions[currentIndex - 1].id)}
                  className={`p-1 rounded-full transition-all duration-200 ${
                    canGoPrev 
                      ? 'text-reading-muted hover:text-reading-primary hover:bg-library-sage-100' 
                      : 'text-library-sage-300 cursor-not-allowed'
                  }`}
                  disabled={!canGoPrev}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/>
                  </svg>
                </button>
                
                <span className="text-sm text-reading-muted font-mono">
                  {currentIndex + 1}/{totalVersions}
                </span>
                
                <button
                  onClick={() => canGoNext && onSwitchVersion(versions[currentIndex + 1].id)}
                  className={`p-1 rounded-full transition-all duration-200 ${
                    canGoNext 
                      ? 'text-reading-muted hover:text-reading-primary hover:bg-library-sage-100' 
                      : 'text-library-sage-300 cursor-not-allowed'
                  }`}
                  disabled={!canGoNext}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
                  </svg>
                </button>
              </div>
            );
          })()}
          
          <div className="flex items-center gap-2 text-sm text-reading-muted font-sans italic">
            <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12.5,7H11V12.5L15.75,15.1L16.5,13.9L12.5,11.7V7Z"/>
            </svg>
            <span>
              {new Date(message.created_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </span>
          </div>
        </div>
        </div>
      </div>

    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(MessageItem, (prevProps, nextProps) => {
  // Custom comparison function for optimization
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.streamingContent === nextProps.streamingContent &&
    prevProps.versions.length === nextProps.versions.length &&
    prevProps.isCompact === nextProps.isCompact
  );
});