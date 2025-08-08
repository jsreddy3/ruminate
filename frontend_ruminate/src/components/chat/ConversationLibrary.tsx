import React, { useState, useRef } from 'react';
import BasePopover from '../common/BasePopover';

/**
 * Deprecated: ConversationLibrary is no longer used for rabbitholes.
 * Rabbithole chats now open as BasePopover windows anchored to highlights.
 */

interface Conversation {
  id: string | null;
  title: string;
  type: 'main' | 'rabbithole';
  selectionText?: string;
  isActive: boolean;
}

interface ConversationLibraryProps {
  conversations: Conversation[];
  activeConversationId?: string | null;
  onConversationChange: (conversationId: string | null) => void;
  disabled?: boolean;
}

const ConversationLibrary: React.FC<ConversationLibraryProps> = ({
  conversations,
  onConversationChange,
  disabled = false
}) => {
  // Keep implementation to avoid breaking imports; UI no longer used.
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const hasDiscussions = conversations.length > 0;
  const previewConversations = conversations.slice(0, 3);
  const hasMore = conversations.length > 3;

  const getIconStyles = (conversation: Conversation) => {
    const isActive = conversation.isActive;
    return {
      container: `relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
        isActive ? 'ring-2 ring-library-gold-400 shadow-book' : 'hover:ring-1 hover:ring-library-sage-300'
      }`,
      icon: 'flex items-center justify-center'
    };
  };

  const handleExpandClick = () => setIsExpanded(!isExpanded);

  return (
    <div className="relative flex items-center">
      <div 
        ref={containerRef} 
        className="flex items-center gap-2 bg-gradient-to-r from-surface-parchment to-library-cream-100 border-2 border-library-sage-300 rounded-journal shadow-book px-4 py-2 backdrop-blur-sm w-fit min-w-fit"
      >
        {hasDiscussions && (
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="font-serif text-sm font-semibold text-reading-primary">
              Discussions
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {previewConversations.map((conversation) => {
            const styles = getIconStyles(conversation);
            const conversationKey = conversation.id || 'main';
            return (
              <div
                key={conversationKey}
                className={styles.container}
                onClick={() => !disabled && onConversationChange(conversation.id)}
                title={conversation.title}
              >
                <div className={styles.icon}>
                  <div className="w-6 h-6 bg-library-forest-500 rounded-full flex items-center justify-center text-library-cream-50 text-xs font-bold">
                    {conversation.title.charAt(0).toUpperCase()}
                  </div>
                </div>
                {conversation.isActive && (
                  <div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-library-gold-400 rounded-full border-2 border-library-cream-50 shadow-lg"
                  />
                )}
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={handleExpandClick}
              className="px-2 py-1 text-xs font-serif bg-library-cream-100 rounded-book border border-library-sage-200 text-reading-secondary hover:text-reading-primary hover:bg-library-cream-200 transition-all"
              disabled={disabled}
            >
              +{conversations.length - 3}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
      <BasePopover
          isVisible={true}
          position={{ x: (containerRef.current?.getBoundingClientRect().right || 0) + 8, y: containerRef.current?.getBoundingClientRect().top || 0 }}
        onClose={() => setIsExpanded(false)}
          initialWidth={360}
          initialHeight={'auto'}
          showCloseButton
        >
          <div className="p-3">
            <div className="text-sm text-reading-secondary">Deprecated UI</div>
          </div>
      </BasePopover>
      )}
    </div>
  );
};

export default ConversationLibrary;