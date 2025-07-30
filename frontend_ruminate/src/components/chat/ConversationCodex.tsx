import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Conversation {
  id: string | null;
  title: string;
  type: 'main' | 'rabbithole';
  selectionText?: string;
  isActive: boolean;
}

interface ConversationCodexProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationChange: (id: string | null) => void;
  onConversationClose?: (id: string) => void;
}

/**
 * A magnificent library codex system for conversation navigation
 * Transforms ugly tabs into an ornate manuscript-style book spine collection
 */
const ConversationCodex: React.FC<ConversationCodexProps> = ({
  conversations,
  activeConversationId,
  onConversationChange,
  onConversationClose
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const codexRef = useRef<HTMLDivElement>(null);

  // Auto-collapse when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (codexRef.current && !codexRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBookSpineStyles = (conversation: Conversation) => {
    const isMain = conversation.type === 'main';
    const isActive = conversation.isActive;
    const isHovered = hoveredId === conversation.id;
    
    return {
      container: `
        relative group cursor-pointer transition-all duration-500 ease-out
        transform hover:scale-105 hover:-translate-y-1
        ${isActive ? 'z-20 scale-105 -translate-y-1' : 'z-10'}
        ${isHovered ? 'drop-shadow-2xl' : 'drop-shadow-lg'}
      `,
      spine: `
        relative h-48 w-8 rounded-l-lg border-2 overflow-hidden
        ${isMain 
          ? `bg-gradient-to-b from-library-mahogany-600 via-library-mahogany-700 to-library-mahogany-800 
             border-library-mahogany-500 shadow-[inset_2px_0_4px_rgba(0,0,0,0.3)]` 
          : `bg-gradient-to-b from-library-forest-600 via-library-forest-700 to-library-forest-800 
             border-library-forest-500 shadow-[inset_2px_0_4px_rgba(0,0,0,0.3)]`
        }
        ${isActive ? 'ring-4 ring-library-gold-400 ring-opacity-70' : ''}
        ${isHovered ? 'shadow-[0_0_30px_rgba(175,95,55,0.4)]' : ''}
      `,
      title: `
        absolute inset-0 flex items-center justify-center
        writing-mode-vertical text-library-cream-50 font-serif font-bold text-xs
        text-shadow-lg transform rotate-180 px-1
        ${isActive ? 'text-library-gold-100' : ''}
      `,
      activeIndicator: isActive ? `
        absolute -right-1 top-1/2 transform -translate-y-1/2
        w-3 h-8 bg-library-gold-400 rounded-r-full
        shadow-[0_0_10px_rgba(249,207,95,0.6)]
        border border-library-gold-300
      ` : '',
      glow: isActive ? `
        absolute inset-0 bg-gradient-to-b 
        from-library-gold-400/20 via-transparent to-library-gold-400/20
        pointer-events-none rounded-l-lg
      ` : ''
    };
  };

  const codexToggleButton = (
    <motion.button
      onClick={() => setIsExpanded(!isExpanded)}
      className={`
        fixed top-1/2 right-0 transform -translate-y-1/2 z-30
        w-12 h-24 bg-gradient-to-l from-library-mahogany-600 to-library-mahogany-700
        border-2 border-library-mahogany-500 border-r-0
        rounded-l-xl shadow-deep hover:shadow-shelf
        flex items-center justify-center group
        transition-all duration-500 ease-out
        ${isExpanded ? 'translate-x-0' : 'translate-x-8 hover:translate-x-6'}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={isExpanded ? "Close Scholar's Codex" : "Open Scholar's Codex"}
    >
      {/* Ornate book spine decoration */}
      <div className="absolute inset-y-2 left-1 w-0.5 bg-library-gold-400 rounded-full opacity-60"></div>
      <div className="absolute inset-y-4 left-2.5 w-0.5 bg-library-gold-400 rounded-full opacity-40"></div>
      
      {/* Toggle icon */}
      <motion.svg 
        className="w-6 h-6 text-library-cream-50 group-hover:text-library-gold-200 transition-colors duration-300"
        fill="currentColor" 
        viewBox="0 0 24 24"
        animate={{ rotate: isExpanded ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <path d="M7,10L12,15L17,10H7Z"/>
      </motion.svg>
      
      {/* Manuscript-style label */}
      <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 -rotate-90">
        <span className="text-xs font-serif text-library-cream-50 opacity-80 whitespace-nowrap tracking-wider">
          CODEX
        </span>
      </div>
    </motion.button>
  );

  return (
    <>
      {/* Codex Toggle Button */}
      {codexToggleButton}
      
      {/* The Magnificent Scholar's Codex */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            ref={codexRef}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-1/2 right-0 transform -translate-y-1/2 z-25"
          >
            {/* Ornate Library Shelf */}
            <div className="relative">
              {/* Shelf background with manuscript texture */}
              <div className="
                bg-gradient-to-l from-surface-aged via-library-cream-200 to-surface-parchment
                border-2 border-library-sage-400 border-r-0
                rounded-l-2xl shadow-shelf p-6 pr-4
                backdrop-blur-sm
              ">
                {/* Decorative shelf molding */}
                <div className="absolute top-0 left-4 right-4 h-2 bg-gradient-to-r from-library-mahogany-400 via-library-gold-300 to-library-mahogany-400 rounded-b-lg opacity-60"></div>
                <div className="absolute bottom-0 left-4 right-4 h-2 bg-gradient-to-r from-library-mahogany-400 via-library-gold-300 to-library-mahogany-400 rounded-t-lg opacity-60"></div>
                
                {/* Scholarly Title */}
                <div className="mb-6 text-center">
                  <h3 className="font-serif text-lg font-bold text-library-mahogany-800 mb-1">
                    Scholar's Codex
                  </h3>
                  <div className="text-xs text-reading-muted italic">
                    Discourse Collection
                  </div>
                  {/* Ornate divider */}
                  <div className="flex items-center justify-center mt-2">
                    <div className="h-px bg-library-sage-400 flex-1 opacity-60"></div>
                    <div className="mx-2 text-library-gold-500">❦</div>
                    <div className="h-px bg-library-sage-400 flex-1 opacity-60"></div>
                  </div>
                </div>
                
                {/* Book Collection */}
                <div className="flex items-end gap-1 justify-center min-h-[200px]">
                  {conversations.map((conversation) => {
                    const styles = getBookSpineStyles(conversation);
                    
                    return (
                      <motion.div
                        key={conversation.id || 'main'}
                        className={styles.container}
                        onMouseEnter={() => setHoveredId(conversation.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => onConversationChange(conversation.id)}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Book Spine */}
                        <div className={styles.spine}>
                          {/* Active glow effect */}
                          {conversation.isActive && (
                            <div className={styles.glow}></div>
                          )}
                          
                          {/* Ornate book binding details */}
                          <div className="absolute top-4 left-1 right-1 h-px bg-library-gold-400 opacity-40"></div>
                          <div className="absolute bottom-4 left-1 right-1 h-px bg-library-gold-400 opacity-40"></div>
                          <div className="absolute top-8 left-1 right-1 h-px bg-library-cream-50 opacity-20"></div>
                          <div className="absolute bottom-8 left-1 right-1 h-px bg-library-cream-50 opacity-20"></div>
                          
                          {/* Book Title */}
                          <div 
                            className={styles.title}
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                          >
                            {conversation.title.length > 12 
                              ? conversation.title.substring(0, 12) + '...' 
                              : conversation.title}
                          </div>
                          
                          {/* Active page marker */}
                          {conversation.isActive && (
                            <div className={styles.activeIndicator}></div>
                          )}
                          
                          {/* Close button for rabbithole conversations */}
                          {conversation.type === 'rabbithole' && onConversationClose && (
                            <motion.button
                              className="absolute -top-2 -right-2 w-5 h-5 bg-library-mahogany-500 hover:bg-library-mahogany-600 text-library-cream-50 rounded-full flex items-center justify-center text-xs shadow-lg z-30"
                              onClick={(e) => {
                                e.stopPropagation();
                                onConversationClose(conversation.id as string);
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              title="Close Discussion"
                            >
                              ×
                            </motion.button>
                          )}
                        </div>
                        
                        {/* Hover tooltip with conversation details */}
                        <AnimatePresence>
                          {hoveredId === conversation.id && (
                            <motion.div
                              initial={{ opacity: 0, x: 20, scale: 0.9 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: 20, scale: 0.9 }}
                              className="absolute right-12 top-1/2 transform -translate-y-1/2 z-40 pointer-events-none"
                            >
                              <div className="bg-gradient-to-br from-surface-paper to-library-cream-100 border-2 border-library-sage-300 rounded-journal p-4 shadow-shelf max-w-xs">
                                <div className="font-serif font-bold text-reading-primary text-sm mb-2">
                                  {conversation.title}
                                </div>
                                <div className="text-xs text-reading-muted mb-2">
                                  {conversation.type === 'main' ? 'Primary Discourse' : 'Scholarly Investigation'}
                                </div>
                                {conversation.selectionText && (
                                  <div className="text-xs text-reading-secondary italic border-l-2 border-library-gold-300 pl-2">
                                    "{conversation.selectionText.length > 60 
                                      ? conversation.selectionText.substring(0, 60) + '...' 
                                      : conversation.selectionText}"
                                  </div>
                                )}
                              </div>
                              {/* Tooltip arrow */}
                              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-3 h-3 bg-surface-paper border-l-2 border-b-2 border-library-sage-300 rotate-45"></div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
                
                {/* Elegant conversation count */}
                <div className="mt-4 text-center text-xs text-reading-muted font-serif italic">
                  {conversations.length} {conversations.length === 1 ? 'Volume' : 'Volumes'}
                </div>
              </div>
              
              {/* Ornate bracket decoration */}
              <div className="absolute -left-2 top-8 bottom-8 w-4">
                <div className="h-full w-1 bg-gradient-to-b from-library-mahogany-400 via-library-gold-300 to-library-mahogany-400 rounded-full opacity-70"></div>
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-library-mahogany-400 rounded-tl-lg"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-library-mahogany-400 rounded-bl-lg"></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ConversationCodex;