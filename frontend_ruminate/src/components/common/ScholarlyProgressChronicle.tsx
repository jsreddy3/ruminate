import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Settings, ScrollText, Sparkles } from 'lucide-react';

interface ProgressChronicleProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  variant?: 'reading' | 'processing' | 'uploading' | 'general';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showQuill?: boolean;
  className?: string;
}

/**
 * A magnificent illuminated manuscript-style progress indicator
 * Features ornate decorations, animated quill, and scholarly aesthetics
 */
const ScholarlyProgressChronicle: React.FC<ProgressChronicleProps> = ({
  progress,
  label,
  showPercentage = true,
  variant = 'general',
  size = 'md',
  animated = true,
  showQuill = true,
  className = ''
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Smooth progress animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);

    if (progress >= 100) {
      const completeTimer = setTimeout(() => {
        setIsComplete(true);
      }, 500);
      return () => {
        clearTimeout(timer);
        clearTimeout(completeTimer);
      };
    } else {
      setIsComplete(false);
    }

    return () => clearTimeout(timer);
  }, [progress]);

  // Get variant-specific styling
  const getVariantStyles = () => {
    switch (variant) {
      case 'reading':
        return {
          primary: 'library-forest',
          secondary: 'library-sage', 
          accent: 'library-gold',
          icon: <Book className="w-4 h-4" />,
          title: 'Reading Chronicle'
        };
      case 'processing':
        return {
          primary: 'library-mahogany',
          secondary: 'library-cream', 
          accent: 'library-gold',
          icon: <Settings className="w-4 h-4" />,
          title: 'Processing Manuscript'
        };
      case 'uploading':
        return {
          primary: 'library-gold',
          secondary: 'surface-aged', 
          accent: 'library-mahogany',
          icon: <ScrollText className="w-4 h-4" />,
          title: 'Archiving Document'
        };
      default:
        return {
          primary: 'library-mahogany',
          secondary: 'library-sage', 
          accent: 'library-gold',
          icon: <Sparkles className="w-4 h-4" />,
          title: 'Progress Chronicle'
        };
    }
  };

  // Get size-specific measurements
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          height: 'h-8',
          width: 'w-64',
          padding: 'p-3',
          fontSize: 'text-xs',
          iconSize: 'w-4 h-4'
        };
      case 'lg':
        return {
          height: 'h-16',
          width: 'w-96', 
          padding: 'p-6',
          fontSize: 'text-base',
          iconSize: 'w-8 h-8'
        };
      default:
        return {
          height: 'h-12',
          width: 'w-80',
          padding: 'p-4',
          fontSize: 'text-sm',
          iconSize: 'w-6 h-6'
        };
    }
  };

  const styles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <div className={`relative ${sizeStyles.width} ${className}`}>
      {/* Ornate manuscript container */}
      <div className={`
        relative ${sizeStyles.height} bg-gradient-to-r from-surface-parchment via-surface-paper to-surface-parchment
        border-2 border-library-sage-300 rounded-journal shadow-book
        overflow-hidden backdrop-blur-sm
      `}>
        {/* Decorative manuscript border */}
        <div className="absolute inset-0 rounded-journal border-2 border-library-gold-200/30 pointer-events-none"></div>
        
        {/* Ornate corner flourishes */}
        <div className="absolute -top-1 -left-1 w-6 h-6 opacity-70">
          <svg viewBox="0 0 24 24" className="w-full h-full text-library-gold-500">
            <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z" />
          </svg>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 opacity-70 rotate-90">
          <svg viewBox="0 0 24 24" className="w-full h-full text-library-gold-500">
            <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -left-1 w-6 h-6 opacity-70 rotate-270">
          <svg viewBox="0 0 24 24" className="w-full h-full text-library-gold-500">
            <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 opacity-70 rotate-180">
          <svg viewBox="0 0 24 24" className="w-full h-full text-library-gold-500">
            <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z" />
          </svg>
        </div>

        {/* Progress track with manuscript texture */}
        <div className="absolute inset-2 rounded-lg overflow-hidden">
          <div className={`
            w-full h-full bg-gradient-to-r from-surface-aged/50 to-library-cream-100/50
            border border-library-sage-200/50 rounded-lg
          `}>
            {/* Manuscript ruling lines */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/4 left-0 right-0 h-px bg-library-sage-400"></div>
              <div className="absolute top-2/4 left-0 right-0 h-px bg-library-sage-300"></div>  
              <div className="absolute top-3/4 left-0 right-0 h-px bg-library-sage-400"></div>
            </div>
          </div>

          {/* Progress fill with illuminated manuscript effects */}
          <motion.div
            className={`
              absolute inset-0 rounded-lg overflow-hidden
              bg-gradient-to-r from-${styles.primary}-400 via-${styles.accent}-300 to-${styles.primary}-500
              shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]
            `}
            initial={{ width: '0%' }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: animated ? 1.2 : 0, ease: 'easeOut' }}
            style={{
              background: `
                linear-gradient(90deg, 
                  var(--${styles.primary}) 0%, 
                  var(--${styles.accent}) 50%, 
                  var(--${styles.primary}) 100%
                ),
                repeating-linear-gradient(45deg, 
                  transparent 0px, 
                  transparent 8px, 
                  rgba(255,255,255,0.1) 8px, 
                  rgba(255,255,255,0.1) 12px
                )
              `
            }}
          >
            {/* Shimmer effect for active progress */}
            {animated && displayProgress < 100 && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            )}
            
            {/* Golden highlight edge */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-${styles.accent}-200 opacity-60`}></div>
          </motion.div>
        </div>

        {/* Animated Quill Pen */}
        <AnimatePresence>
          {showQuill && displayProgress < 100 && (
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 z-20"
              initial={{ left: '0%' }}
              animate={{ left: `${Math.max(0, displayProgress - 5)}%` }}
              transition={{ duration: animated ? 1.2 : 0, ease: 'easeOut' }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="relative">
                {/* Quill pen */}
                <motion.div
                  className="w-6 h-6 text-reading-primary"
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg fill="currentColor" viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg">
                    <path d="M3,21H5L16,10L14,8L3,19V21M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M21,19L19,21L17,19V15L13,11V7L11,5L13,3L17,7H21L21,19Z"/>
                  </svg>
                </motion.div>
                
                {/* Ink drops */}
                <motion.div
                  className="absolute -bottom-1 left-2 w-1 h-1 bg-reading-primary rounded-full opacity-60"
                  animate={{ scale: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion celebration */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-library-gold-500 text-2xl"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              >
                <Sparkles className="w-8 h-8" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress information */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <span className={`text-reading-primary flex items-center`}>{styles.icon}</span>
          <span className={`font-serif font-medium text-reading-primary ${sizeStyles.fontSize}`}>
            {label || styles.title}
          </span>
        </div>
        
        {showPercentage && (
          <motion.span 
            className={`font-serif font-bold text-${styles.primary}-700 ${sizeStyles.fontSize}`}
            key={Math.floor(displayProgress)}
            initial={{ scale: 1.2, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {Math.round(displayProgress)}%
          </motion.span>
        )}
      </div>

      {/* Ornate progress milestones */}
      <div className="relative mt-2 flex justify-between">
        {[0, 25, 50, 75, 100].map((milestone) => (
          <div key={milestone} className="flex flex-col items-center">
            <motion.div
              className={`
                w-2 h-2 rounded-full border-2 transition-all duration-500
                ${displayProgress >= milestone 
                  ? `bg-${styles.primary}-500 border-${styles.accent}-400 shadow-[0_0_8px_rgba(175,95,55,0.4)]` 
                  : `bg-${styles.secondary}-200 border-${styles.secondary}-300`
                }
              `}
              animate={{
                scale: displayProgress >= milestone ? 1.2 : 1,
              }}
              transition={{ delay: milestone * 0.05 }}
            />
            <span className={`text-xs text-reading-muted font-serif mt-1 ${milestone === 0 || milestone === 100 ? 'opacity-100' : 'opacity-60'}`}>
              {milestone === 0 ? 'Begin' : milestone === 100 ? 'Complete' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScholarlyProgressChronicle;