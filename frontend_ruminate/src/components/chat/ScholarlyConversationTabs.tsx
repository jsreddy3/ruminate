import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Library, Book, Search } from 'lucide-react';

interface Conversation {
  id: string | null;
  title: string;
  type: 'main' | 'rabbithole';
  selectionText?: string;
  isActive: boolean;
}

interface ScholarlyConversationTabsProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationChange: (id: string | null) => void;
  onConversationClose?: (id: string) => void;
}

/**
 * A more reliable, container-friendly version of the conversation switcher
 * Uses elegant book-style tabs that work within existing layouts
 */
const ScholarlyConversationTabs: React.FC<ScholarlyConversationTabsProps> = ({
  conversations,
  activeConversationId,
  onConversationChange,
  onConversationClose
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getTabStyles = (conversation: Conversation) => {
    const isMain = conversation.type === 'main';
    const isActive = conversation.isActive;
    const isHovered = hoveredId === conversation.id;
    
    return {
      container: `
        relative cursor-pointer transition-all duration-300 ease-out
        ${isActive ? 'z-10' : 'z-0'}
        ${isHovered ? 'transform -translate-y-1' : ''}
      `,
      tab: `
        px-4 py-2 rounded-t-journal border-2 border-b-0 font-serif text-sm
        transition-all duration-300 ease-out
        ${isMain 
          ? `${isActive 
              ? 'bg-gradient-to-b from-library-mahogany-100 to-library-mahogany-50 border-library-mahogany-300 text-library-mahogany-800' 
              : 'bg-gradient-to-b from-library-mahogany-50 to-surface-parchment border-library-mahogany-200 text-library-mahogany-600 hover:border-library-mahogany-300'
            }` 
          : `${isActive 
              ? 'bg-gradient-to-b from-library-forest-100 to-library-forest-50 border-library-forest-300 text-library-forest-800' 
              : 'bg-gradient-to-b from-library-forest-50 to-surface-parchment border-library-forest-200 text-library-forest-600 hover:border-library-forest-300'
            }`
        }
        ${isActive ? 'shadow-book' : 'shadow-paper hover:shadow-book'}
      `
    };
  };

  return (
    <div className="relative">
      {/* Tab Header */}
      <div className="flex items-end gap-1 px-3 pt-3 bg-gradient-to-r from-surface-parchment to-library-cream-100 border-b-2 border-library-sage-300">
        {/* Expand/Collapse Button */}
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group flex items-center gap-2 px-3 py-1.5 bg-gradient-to-b from-library-gold-100 to-library-gold-50 border-2 border-library-gold-300 rounded-t-journal text-library-gold-700 hover:text-library-gold-800 font-serif text-xs shadow-paper hover:shadow-book transition-all duration-300"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
        >
          <Library className="w-3 h-3" />
          <span className="font-semibold">
            {isExpanded ? 'Hide' : 'Show'} Discussions
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7,10L12,15L17,10H7Z"/>
            </svg>
          </motion.div>
        </motion.button>

        {/* Show active conversation count when collapsed */}
        {!isExpanded && (
          <div className="px-2 py-1 bg-gradient-to-b from-library-sage-100 to-library-sage-50 border border-library-sage-200 rounded-t-book text-xs font-serif text-reading-muted">
            {conversations.length} volume{conversations.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Expandable Tab Container */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden bg-gradient-to-r from-surface-parchment to-library-cream-100 border-b-2 border-library-sage-300"
          >
            <div className="flex flex-wrap gap-1 p-3">
              {conversations.map((conversation) => {
                const styles = getTabStyles(conversation);
                
                return (
                  <motion.div
                    key={conversation.id || 'main'}
                    className={styles.container}
                    onMouseEnter={() => setHoveredId(conversation.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onConversationChange(conversation.id)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={styles.tab}>
                      <div className="flex items-center gap-2">
                        {/* Book icon */}
                        {conversation.type === 'main' ? (
                          <Book className="w-3 h-3" />
                        ) : (
                          <Search className="w-3 h-3" />
                        )}
                        
                        {/* Title */}
                        <span className="font-medium">
                          {conversation.title.length > 15 
                            ? conversation.title.substring(0, 15) + '...' 
                            : conversation.title}
                        </span>
                        
                        {/* Close button for rabbitholes */}
                        {conversation.type === 'rabbithole' && onConversationClose && (
                          <button
                            className="ml-1 w-4 h-4 bg-library-mahogany-400 hover:bg-library-mahogany-500 text-library-cream-50 rounded-full flex items-center justify-center text-xs transition-colors duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConversationClose(conversation.id as string);
                            }}
                            title="Close Discussion"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      
                      {/* Active indicator */}
                      {conversation.isActive && (
                        <motion.div
                          className="absolute bottom-0 left-2 right-2 h-0.5 bg-library-gold-400 rounded-full"
                          layoutId="activeTab"
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </div>
                    
                    {/* Hover tooltip */}
                    <AnimatePresence>
                      {hoveredId === conversation.id && conversation.selectionText && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute top-full left-0 mt-2 z-20 pointer-events-none"
                        >
                          <div className="bg-gradient-to-br from-surface-paper to-library-cream-100 border-2 border-library-sage-300 rounded-journal p-3 shadow-shelf max-w-xs">
                            <div className="text-xs text-reading-muted mb-1 font-serif italic">
                              Selected text:
                            </div>
                            <div className="text-sm text-reading-secondary font-serif">
                              "{conversation.selectionText.length > 80 
                                ? conversation.selectionText.substring(0, 80) + '...' 
                                : conversation.selectionText}"
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScholarlyConversationTabs;