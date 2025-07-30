import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Conversation {
  id: string | null;
  title: string;
  type: 'main' | 'rabbithole';
  selectionText?: string;
  isActive: boolean;
}

interface MysticalConversationOrbsProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onConversationChange: (id: string | null) => void;
  onConversationClose?: (id: string) => void;
}

/**
 * Floating mystical orbs for conversation switching
 * Each conversation appears as a glowing orb that follows physics and responds to interaction
 */
const MysticalConversationOrbs: React.FC<MysticalConversationOrbsProps> = ({
  conversations,
  activeConversationId,
  onConversationChange,
  onConversationClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse position for orb attraction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const getOrbStyles = (conversation: Conversation, index: number) => {
    const isMain = conversation.type === 'main';
    const isActive = conversation.isActive;
    const isHovered = hoveredId === conversation.id;
    
    return {
      colors: isMain 
        ? { bg: 'from-library-mahogany-400 to-library-mahogany-600', glow: 'shadow-[0_0_30px_rgba(175,95,55,0.6)]' }
        : { bg: 'from-library-forest-400 to-library-forest-600', glow: 'shadow-[0_0_30px_rgba(90,115,95,0.6)]' },
      size: isActive ? 'w-16 h-16' : isHovered ? 'w-12 h-12' : 'w-10 h-10',
      position: {
        // Arrange in a gentle arc
        x: 60 + (index * 80) + Math.sin(index * 0.5) * 20,
        y: 60 + Math.cos(index * 0.3) * 15
      }
    };
  };

  return (
    <>
      {/* Mystical Toggle - appears as floating rune */}
      <motion.button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed top-20 right-6 z-50 w-12 h-12 bg-gradient-to-br from-library-gold-400 to-library-gold-600 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(249,207,95,0.7)] border-2 border-library-gold-300"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ 
          rotate: [0, 10, -10, 0],
          boxShadow: [
            '0 0 25px rgba(249,207,95,0.7)',
            '0 0 35px rgba(249,207,95,0.9)',
            '0 0 25px rgba(249,207,95,0.7)'
          ]
        }}
        transition={{ 
          rotate: { duration: 4, repeat: Infinity },
          boxShadow: { duration: 2, repeat: Infinity }
        }}
        title={isVisible ? "Hide Conversation Orbs" : "Show Conversation Orbs"}
      >
        <motion.div
          animate={{ rotate: isVisible ? 180 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <svg className="w-6 h-6 text-library-cream-50" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L11,7.5V10.5H16V13.5H11V16.5Z"/>
          </svg>
        </motion.div>
      </motion.button>

      {/* Mystical Orb Container */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-40"
            style={{ background: 'radial-gradient(circle at center, rgba(0,0,0,0.1) 0%, transparent 70%)' }}
          >
            {/* Floating Orbs */}
            {conversations.map((conversation, index) => {
              const styles = getOrbStyles(conversation, index);
              const orbKey = conversation.id || 'main';
              
              return (
                <motion.div
                  key={orbKey}
                  className="absolute pointer-events-auto cursor-pointer"
                  initial={{ 
                    scale: 0, 
                    x: styles.position.x, 
                    y: styles.position.y,
                    opacity: 0 
                  }}
                  animate={{ 
                    scale: 1,
                    x: styles.position.x,
                    y: styles.position.y,
                    opacity: 1
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ 
                    type: 'spring', 
                    damping: 20, 
                    stiffness: 150,
                    delay: index * 0.1 
                  }}
                  whileHover={{ 
                    scale: 1.2,
                    rotate: [0, -5, 5, 0],
                    transition: { 
                      scale: { duration: 0.2 },
                      rotate: { duration: 0.6, repeat: Infinity }
                    }
                  }}
                  whileTap={{ scale: 0.9 }}
                  onMouseEnter={() => setHoveredId(conversation.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onConversationChange(conversation.id)}
                >
                  {/* Main Orb */}
                  <div className={`
                    ${styles.size} bg-gradient-to-br ${styles.colors.bg} rounded-full 
                    ${styles.colors.glow} ${conversation.isActive ? 'ring-4 ring-library-gold-300 ring-opacity-70' : ''}
                    transition-all duration-300 ease-out flex items-center justify-center
                    border-2 border-white/20 backdrop-blur-sm
                  `}>
                    {/* Inner glow */}
                    <div className="w-3/4 h-3/4 bg-white/20 rounded-full flex items-center justify-center">
                      {/* Icon */}
                      <span className="text-library-cream-50 text-lg font-bold">
                        {conversation.type === 'main' ? '📖' : '🔍'}
                      </span>
                    </div>

                    {/* Floating particles around active orb */}
                    {conversation.isActive && (
                      <div className="absolute inset-0">
                        {[...Array(6)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-library-gold-300 rounded-full"
                            animate={{
                              x: [0, Math.cos(i * 60 * Math.PI / 180) * 30],
                              y: [0, Math.sin(i * 60 * Math.PI / 180) * 30],
                              opacity: [0, 1, 0]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: i * 0.3,
                              ease: 'easeInOut'
                            }}
                            style={{
                              left: '50%',
                              top: '50%',
                              marginLeft: '-2px',
                              marginTop: '-2px'
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Close button for rabbitholes */}
                    {conversation.type === 'rabbithole' && onConversationClose && (
                      <motion.button
                        className="absolute -top-1 -right-1 w-5 h-5 bg-library-mahogany-500 hover:bg-library-mahogany-600 text-library-cream-50 rounded-full flex items-center justify-center text-xs shadow-lg z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConversationClose(conversation.id as string);
                        }}
                        whileHover={{ scale: 1.2, rotate: 90 }}
                        whileTap={{ scale: 0.8 }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        ×
                      </motion.button>
                    )}
                  </div>

                  {/* Floating Label */}
                  <AnimatePresence>
                    {hoveredId === conversation.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: -10, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.8 }}
                        className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 pointer-events-none z-10"
                      >
                        <div className="bg-gradient-to-br from-surface-paper to-library-cream-100 border-2 border-library-sage-300 rounded-journal p-3 shadow-shelf max-w-xs">
                          <div className="font-serif font-bold text-reading-primary text-sm mb-1">
                            {conversation.title}
                          </div>
                          <div className="text-xs text-reading-muted mb-2">
                            {conversation.type === 'main' ? 'Primary Discourse' : 'Investigation'}
                          </div>
                          {conversation.selectionText && (
                            <div className="text-xs text-reading-secondary italic border-l-2 border-library-gold-300 pl-2">
                              "{conversation.selectionText.length > 50 
                                ? conversation.selectionText.substring(0, 50) + '...' 
                                : conversation.selectionText}"
                            </div>
                          )}
                        </div>
                        {/* Tooltip arrow */}
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-3 h-3 bg-surface-paper border-l-2 border-t-2 border-library-sage-300 rotate-45"></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Mystical Background Effect */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-library-gold-300/30 rounded-full"
                  animate={{
                    x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
                    y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
                    opacity: [0, 0.6, 0]
                  }}
                  transition={{
                    duration: 8 + Math.random() * 4,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: 'linear'
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MysticalConversationOrbs;