import React, { useState, useEffect } from 'react';
import { MessageNode, MessageRole, GeneratedSummary } from '../../../types/chat';
import MessageContentRenderer from './MessageContentRenderer';

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

  // Handle role-based styling with DRAMATIC manuscript aesthetics
  const getRoleStyles = () => {
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
        {/* ORNATE message header with illuminated manuscript styling */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-library-sage-200/50 min-h-[3rem]">
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Role icon with dramatic styling */}
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
                <svg className="w-5 h-5 text-library-cream-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 3.5C14.8 3.4 14.4 3.3 14 3.3C13.6 3.3 13.2 3.4 13 3.5L7 7V9C7 9.6 7.4 10 8 10S9 9.6 9 9V8.2L12 6.7L15 8.2V9C15 9.6 15.4 10 16 10S17 9.6 17 9M8 11.5V13C8 13.5 8.5 14 9 14H15C15.5 14 16 13.5 16 13V11.5L12 9.5L8 11.5Z"/>
                </svg>
              ) : message.role === MessageRole.ASSISTANT ? (
                <svg className="w-5 h-5 text-library-cream-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12.5,7H11V12.5L15.75,15.1L16.5,13.9L12.5,11.7V7Z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-library-cream-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
                </svg>
              )}
            </div>
            
            {/* Ornate role title */}
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
            {/* ORNATE streaming indicator */}
            {isStreaming && message.role === MessageRole.ASSISTANT && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-library-forest-100 to-library-sage-100 rounded-book border border-library-forest-200">
                <span className="text-sm font-serif text-library-forest-700">Contemplating...</span>
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-library-forest-500 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-library-forest-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 bg-library-forest-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
            
            {/* ELEGANT edit button with manuscript styling */}
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
        
        {/* LUXURIOUS message content with manuscript styling */}
        <div className="relative">
          {isEditing ? (
            <div className="space-y-4">
              {/* ORNATE text editor */}
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
              
              {/* ORNATE action buttons */}
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
              {/* Message content rendered through dedicated component */}
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
        
        
        {/* ELEGANT timestamp with version navigation */}
        <div className="flex items-center justify-between mt-4 pt-2 border-t border-library-sage-200/30">
          {/* Version navigation - minimal arrows (only show if multiple versions) */}
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
          
          {/* Timestamp */}
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

export default MessageItem;