import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BasePopover from '../common/BasePopover';

interface Conversation {
  id: string | null;
  title: string;
  type: 'main' | 'rabbithole';
  selectionText?: string;
  isActive: boolean;
}

interface ConversationLibraryProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationChange: (id: string | null) => void;
}

/**
 * A compact conversation library that sits in the top-left corner
 * Always visible with small, elegant icons for each conversation
 */
const ConversationLibrary: React.FC<ConversationLibraryProps> = ({
  conversations,
  activeConversationId,
  onConversationChange
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

  const getIconStyles = (conversation: Conversation) => {
    const isActive = conversation.isActive;
    const isHovered = hoveredId === conversation.id;
    
    return {
      container: `
        relative w-10 h-10 rounded-book cursor-pointer transition-all duration-300 ease-out
        ${isActive 
          ? 'bg-library-forest-500 shadow-book ring-2 ring-library-gold-400' 
          : 'bg-library-forest-400 hover:bg-library-forest-500 hover:shadow-book'
        }
        ${isHovered ? 'scale-110 z-20' : 'scale-100'}
      `,
      icon: `
        w-full h-full flex items-center justify-center text-library-cream-50 text-base
        ${isActive ? 'drop-shadow-lg' : ''}
      `
    };
  };

  const maxPreviewIcons = 3;
  const previewConversations = conversations.slice(0, maxPreviewIcons);
  const hasMore = conversations.length > maxPreviewIcons;
  
  // Check if there are any discussions (non-main conversations)
  const hasDiscussions = conversations.some(conv => conv.type === 'rabbithole');

  const handleExpandClick = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPopoverPosition({
        x: rect.left,           // Align with left edge of discussions bar
        y: rect.bottom + 8      // Position below the discussions bar
      });
    }
    setIsExpanded(true);
  };

  return (
    <div className="relative flex items-center">
      {/* Main conversation strip */}
      <div ref={containerRef} className="flex items-center gap-2 bg-gradient-to-r from-surface-parchment to-library-cream-100 border-2 border-library-sage-300 rounded-journal shadow-book px-4 py-2 backdrop-blur-sm">
        {/* Library label - only show if there are discussions */}
        {hasDiscussions && (
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="font-serif text-sm font-semibold text-reading-primary">
              Discussions
            </span>
          </div>
        )}

        {/* Preview Icons - only 2-3 shown */}
        <div className="flex items-center gap-2">
          {previewConversations.map((conversation, index) => {
            const styles = getIconStyles(conversation);
            const conversationKey = conversation.id || 'main';
            
            return (
              <motion.div
                key={conversationKey}
                className={styles.container}
                onMouseEnter={() => setHoveredId(conversation.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onConversationChange(conversation.id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.9 }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                title={conversation.title}
              >
                <div className={styles.icon}>
                  <div className="w-6 h-6 bg-library-forest-500 rounded-full flex items-center justify-center text-library-cream-50 text-xs font-bold">
                    {conversation.title.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Active indicator dot */}
                {conversation.isActive && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-library-gold-400 rounded-full border-2 border-library-cream-50 shadow-lg"
                    layoutId="activeIndicator"
                    transition={{ duration: 0.3 }}
                  />
                )}

              </motion.div>
            );
          })}

          {/* Show +N indicator if there are more conversations */}
          {hasMore && (
            <button
              onClick={handleExpandClick}
              className="flex items-center justify-center w-10 h-10 bg-library-sage-300 hover:bg-library-sage-400 text-library-cream-50 rounded-book font-serif text-sm font-bold transition-all duration-200 shadow-paper hover:shadow-book"
              title={`Show ${conversations.length - maxPreviewIcons} more conversations`}
            >
              +{conversations.length - maxPreviewIcons}
            </button>
          )}
        </div>
      </div>

      {/* EXPANDED LIBRARY - Using BasePopover for proper positioning */}
      <BasePopover
        isVisible={isExpanded}
        position={popoverPosition}
        onClose={() => setIsExpanded(false)}
        title="📚 Conversation Library"
        initialWidth={400}
        initialHeight={300}
        draggable={true}
        resizable={true}
        minWidth={350}
        minHeight={200}
        maxWidth={600}
        preventOverflow={true}
        offsetY={-10}
      >
        <div className="p-4 h-full overflow-y-auto">
          {/* Clean list layout instead of cramped grid */}
          <div className="space-y-2">
            {conversations.map((conversation, index) => {
              const isActive = conversation.isActive;
              
              return (
                <motion.button
                  key={conversation.id || 'main'}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-book text-left
                    transition-all duration-200 hover:shadow-paper
                    ${isActive 
                      ? 'bg-gradient-to-r from-library-gold-50 to-library-gold-100 border-2 border-library-gold-300 shadow-paper' 
                      : 'bg-gradient-to-r from-surface-parchment to-library-cream-50 border border-library-sage-200 hover:border-library-sage-300 hover:bg-library-cream-100'
                    }
                  `}
                  onClick={() => {
                    onConversationChange(conversation.id);
                    setIsExpanded(false);
                  }}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {/* Clean icon */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-library-forest-500 rounded-full flex items-center justify-center text-library-cream-50 font-bold text-sm">
                      {conversation.title.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-serif font-semibold text-reading-primary text-sm mb-1">
                      {conversation.title}
                    </div>
                    <div className="text-xs text-reading-muted">
                      Side Discussion
                      {conversation.selectionText && ` • "${conversation.selectionText.substring(0, 40)}${conversation.selectionText.length > 40 ? '...' : ''}"`}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="flex-shrink-0 w-2 h-2 bg-library-gold-500 rounded-full"></div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Empty state */}
          {conversations.length === 0 && (
            <div className="text-center py-8">
              <div className="text-reading-muted font-serif text-base mb-2">
                No conversations yet
              </div>
              <div className="text-sm text-reading-muted font-serif italic">
                Select text in the document to start a discussion
              </div>
            </div>
          )}
        </div>
      </BasePopover>
    </div>
  );
};

export default ConversationLibrary;