import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedTextSelectionProps {
  isVisible: boolean;
  delay?: number;
  targetText?: string;
}

export const AnimatedTextSelection: React.FC<AnimatedTextSelectionProps> = ({
  isVisible,
  delay = 2000,
  targetText = "Try selecting some text like this to discover what you can do with it!"
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectionProgress, setSelectionProgress] = useState(0);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setIsAnimating(false);
      setSelectionProgress(0);
      setShowCursor(false);
      return;
    }

    // Start animation after delay
    const startTimer = setTimeout(() => {
      setShowCursor(true);
      setIsAnimating(true);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [isVisible, delay]);

  useEffect(() => {
    if (!isAnimating) return;

    // Animate selection progress from 0 to 100
    const duration = 2000; // 2 seconds for full selection
    const steps = 60; // 60fps
    const increment = 100 / steps;
    const stepDuration = duration / steps;

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += increment;
      setSelectionProgress(currentProgress);

      if (currentProgress >= 100) {
        clearInterval(interval);
        // Keep selection visible for a moment, then restart
        setTimeout(() => {
          setSelectionProgress(0);
          setIsAnimating(false);
          setShowCursor(false);
          
          // Restart after a pause
          setTimeout(() => {
            if (isVisible) { // Only restart if still visible
              setShowCursor(true);
              setIsAnimating(true);
            }
          }, 1500);
        }, 1500);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isAnimating]);

  if (!isVisible) return null;

  // Calculate how many characters to show as selected
  const selectedLength = Math.floor((targetText.length * selectionProgress) / 100);
  const selectedText = targetText.substring(0, selectedLength);
  const remainingText = targetText.substring(selectedLength);

  return (
    <div className="relative inline-block">
      {/* Animated cursor */}
      <AnimatePresence>
        {showCursor && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute pointer-events-none z-20"
            style={{
              // Position cursor at the end of current selection
              left: `${(selectedLength / targetText.length) * 100}%`,
              top: '-8px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="relative">
              {/* Cursor body */}
              <motion.div
                animate={{
                  y: [0, -2, 0],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-5 h-5 bg-library-gold/80 rounded-full shadow-lg border-2 border-white"
              />
              {/* Cursor trail */}
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.2, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 w-5 h-5 bg-library-gold/30 rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo text with selection effect */}
      <div className="text-[15px] leading-relaxed font-iowan text-reading-primary p-3 bg-white rounded-lg border border-library-cream-300 shadow-sm max-w-sm">
        <span
          className="bg-library-gold/30 text-reading-primary transition-all duration-75 ease-out"
          style={{
            backgroundImage: selectionProgress > 0 ? 'linear-gradient(120deg, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.2) 100%)' : 'none',
            borderRadius: selectionProgress > 0 ? '2px' : '0px',
            boxShadow: selectionProgress > 0 ? 'inset 0 0 0 1px rgba(251, 191, 36, 0.4)' : 'none'
          }}
        >
          {selectedText}
        </span>
        <span className="text-reading-primary">
          {remainingText}
        </span>
      </div>
    </div>
  );
};