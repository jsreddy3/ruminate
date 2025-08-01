import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, Sparkles } from 'lucide-react';

interface TextSelectionTourDialogueProps {
  isVisible: boolean;
  onComplete: () => void;
  position?: { top?: string; left?: string; right?: string; bottom?: string };
}

export const TextSelectionTourDialogue: React.FC<TextSelectionTourDialogueProps> = ({
  isVisible,
  onComplete,
  position = { top: '20%', left: '20%' }
}) => {
  const hasShownRef = useRef(false);
  const [shouldShowPointer, setShouldShowPointer] = useState(false);
  
  useEffect(() => {
    if (isVisible && !hasShownRef.current) {
      hasShownRef.current = true;
      const timer = setTimeout(() => {
        setShouldShowPointer(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <>
      {/* Subtle backdrop with golden gradient */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed inset-0 pointer-events-none z-40"
        style={{
          background: `radial-gradient(ellipse at 30% 40%, transparent 15%, rgba(251, 191, 36, 0.08) 60%, rgba(251, 191, 36, 0.12) 100%)`
        }}
      />
      
      {/* Dialogue box */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ 
          duration: 0.6,
          ease: [0.23, 1, 0.32, 1],
          delay: 0.3 
        }}
        className="fixed z-50 pointer-events-none -translate-x-1/2"
        style={{ ...position, left: position.left || '50%' }}
      >
        <div className="relative">
          {/* Main dialogue content */}
          <div className="relative">
            {/* Paper texture overlay */}
            <div className="absolute inset-0 rounded-book opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5' /%3E%3C/svg%3E")`
              }}
            />
            
            <div className="backdrop-blur-xl border border-white/25 rounded-3xl shadow-2xl p-7 max-w-sm relative overflow-hidden"
              style={{ 
                backgroundColor: 'rgba(251, 191, 36, 0.18)',
                backgroundImage: 'linear-gradient(145deg, rgba(255, 255, 255, 0.12) 0%, rgba(251, 191, 36, 0.08) 40%, rgba(139, 155, 132, 0.06) 100%)',
                boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.15), 0 0 100px rgba(251, 191, 36, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(24px) saturate(1.8)'
              }}>
              {/* Multiple glass layers for depth */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.18] via-transparent to-transparent pointer-events-none" />
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-library-gold/[0.12] rounded-full blur-3xl pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-library-gold/[0.03] to-transparent pointer-events-none" />
              
              <div className="flex items-start gap-4 relative z-10">
                <div className="mt-1 flex-shrink-0">
                  <div className="relative">
                    <MousePointer2 className="w-6 h-6 text-library-gold/90" strokeWidth={1.5} />
                    {shouldShowPointer && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="absolute -top-1 -right-1"
                      >
                        <Sparkles className="w-3 h-3 text-library-gold animate-pulse" strokeWidth={2} />
                      </motion.div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1">
                  <p className="text-library-gold/95 font-iowan font-medium leading-relaxed text-[16px] tracking-wide mb-3"
                     style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}>
                    Try selecting some text to discover what you can do with it!
                  </p>
                  
                  {shouldShowPointer && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                    >
                      <p className="text-library-gold/70 font-iowan text-[14px] italic leading-relaxed"
                         style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}>
                        Click and drag to select any word or phrase...
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};