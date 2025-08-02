import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';

interface PDFTourDialogueProps {
  isVisible: boolean;
  targetRect: { x: number; y: number; width: number; height: number } | null;
  scale: number;
}

export const PDFTourDialogue: React.FC<PDFTourDialogueProps> = ({
  isVisible,
  targetRect,
  scale
}) => {
  if (!isVisible || !targetRect) return null;
  
  // Calculate position - place it to the right of the block with some padding
  const dialogueX = targetRect.x + targetRect.width + 20;
  const dialogueY = targetRect.y + (targetRect.height / 2) - 40; // Center vertically
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ 
            duration: 0.5,
            ease: [0.23, 1, 0.32, 1],
            delay: 0.2 
          }}
          className="absolute z-50 pointer-events-none"
          style={{ 
            left: `${dialogueX}px`,
            top: `${dialogueY}px`
          }}
        >
          <div className="relative">
            {/* Arrow pointing left to the block */}
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="12" height="20" viewBox="0 0 12 20" className="text-library-mahogany/50">
                <path
                  d="M12 10 L0 2 L0 18 Z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {/* Main dialogue content */}
            <div className="relative">
              {/* Paper texture overlay */}
              <div className="absolute inset-0 rounded-book opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5' /%3E%3C/svg%3E")`
                }}
              />
              
              <div className="backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-5 max-w-xs relative overflow-hidden"
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
                    <FileText className="w-5 h-5 text-library-mahogany/80" strokeWidth={1.5} />
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-library-mahogany/90 font-iowan font-medium leading-relaxed text-[15px] tracking-wide"
                       style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}>
                      Tap a block of text to start reading
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};