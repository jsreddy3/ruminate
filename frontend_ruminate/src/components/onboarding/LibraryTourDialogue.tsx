import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface LibraryTourDialogueProps {
  isVisible: boolean;
  onNext: () => void;
  position?: { top?: string; left?: string; right?: string; bottom?: string };
}

export const LibraryTourDialogue: React.FC<LibraryTourDialogueProps> = ({
  isVisible,
  onNext,
  position = { top: '50%', left: '50%' }
}) => {
  const hasShownRef = useRef(false);
  const [shouldShowArrow, setShouldShowArrow] = useState(false);
  
  useEffect(() => {
    if (isVisible && !hasShownRef.current) {
      hasShownRef.current = true;
      const timer = setTimeout(() => {
        setShouldShowArrow(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <>
          {/* Subtle backdrop with mahogany gradient */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="fixed inset-0 pointer-events-none z-40"
            style={{
              background: `radial-gradient(ellipse at 50% 60%, transparent 20%, rgba(158, 86, 50, 0.12) 70%, rgba(158, 86, 50, 0.18) 100%)`
            }}
          />
          
          {/* Dialogue box */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ 
              duration: 0.5,
              ease: [0.23, 1, 0.32, 1],
              delay: 0.2 
            }}
            className="fixed z-50 pointer-events-none -translate-x-1/2"
            style={{ ...position, left: '50%' }}
          >
            <div className="relative">
              {/* Main dialogue content */}
              <div className="relative">
                {/* Paper texture overlay */}
                <div className="absolute inset-0 rounded-book opacity-[0.03] pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5' /%3E%3C/svg%3E")`
                  }}
                />
                
                <div className="backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-7 max-w-sm relative overflow-hidden"
                  style={{ 
                    backgroundColor: 'rgba(158, 86, 50, 0.24)',
                    backgroundImage: 'linear-gradient(145deg, rgba(215, 184, 140, 0.15) 0%, rgba(158, 86, 50, 0.12) 40%, rgba(139, 155, 132, 0.08) 100%)',
                    boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 80px rgba(158, 86, 50, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(20px) saturate(1.5)'
                  }}>
                  {/* Multiple glass layers for depth */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.15] via-transparent to-transparent pointer-events-none" />
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-library-gold/[0.08] rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-library-mahogany/[0.02] to-transparent pointer-events-none" />
                  
                  <div className="flex items-start gap-3 relative z-10">
                    <div className="mt-0.5">
                      <BookOpen className="w-5 h-5 text-library-mahogany/80" strokeWidth={1.5} />
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-library-mahogany/90 font-iowan font-medium leading-relaxed text-[16px] tracking-wide"
                         style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}>
                        Click on your first document to begin reading.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
    </>
  );
};