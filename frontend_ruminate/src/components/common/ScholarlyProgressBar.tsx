import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Settings, Upload, Sparkles } from 'lucide-react';

interface ScholarlyProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  variant?: 'reading' | 'processing' | 'uploading' | 'general';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

/**
 * A beautiful but practical progress bar with scholarly aesthetics
 * Less ambitious than the Chronicle but still elegant and library-themed
 */
const ScholarlyProgressBar: React.FC<ScholarlyProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  variant = 'general',
  size = 'md',
  animated = true,
  className = ''
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setDisplayProgress(progress), 100);
      return () => clearTimeout(timer);
    } else {
      setDisplayProgress(progress);
    }
  }, [progress, animated]);

  // Get variant colors - using actual hex values to avoid CSS var issues
  const getVariantColors = () => {
    switch (variant) {
      case 'reading':
        return {
          bg: 'bg-library-forest-500',
          text: 'text-library-forest-700',
          icon: <Book className="w-4 h-4" />
        };
      case 'processing':
        return {
          bg: 'bg-library-mahogany-500',
          text: 'text-library-mahogany-700',
          icon: <Settings className="w-4 h-4" />
        };
      case 'uploading':
        return {
          bg: 'bg-library-gold-500',
          text: 'text-library-gold-700',
          icon: <Upload className="w-4 h-4" />
        };
      default:
        return {
          bg: 'bg-library-mahogany-500',
          text: 'text-library-mahogany-700',
          icon: <Sparkles className="w-4 h-4" />
        };
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          height: 'h-2',
          container: 'w-48',
          text: 'text-xs',
          spacing: 'gap-2'
        };
      case 'lg':
        return {
          height: 'h-4',
          container: 'w-80',
          text: 'text-base',
          spacing: 'gap-4'
        };
      default:
        return {
          height: 'h-3',
          container: 'w-64',
          text: 'text-sm',
          spacing: 'gap-3'
        };
    }
  };

  const colors = getVariantColors();
  const sizeStyles = getSizeStyles();

  return (
    <div className={`flex flex-col ${sizeStyles.spacing} ${className}`}>
      {/* Label and percentage */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <div className="flex items-center gap-2">
              <span className={`${colors.text} flex items-center`}>{colors.icon}</span>
              <span className={`font-serif font-medium ${colors.text} ${sizeStyles.text}`}>
                {label}
              </span>
            </div>
          )}
          {showPercentage && (
            <span className={`font-serif font-semibold ${colors.text} ${sizeStyles.text}`}>
              {Math.round(displayProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar container */}
      <div className={`${sizeStyles.container} ${sizeStyles.height} bg-library-sage-200 rounded-book overflow-hidden shadow-paper border border-library-sage-300`}>
        {/* Progress fill */}
        <motion.div
          className={`${sizeStyles.height} ${colors.bg} rounded-book shadow-inner`}
          initial={{ width: '0%' }}
          animate={{ width: `${displayProgress}%` }}
          transition={{ 
            duration: animated ? 0.8 : 0, 
            ease: 'easeOut' 
          }}
        >
          {/* Subtle highlight on top */}
          <div className="w-full h-1/3 bg-white/20 rounded-book"></div>
        </motion.div>

        {/* Completion sparkle */}
        <AnimatePresence>
          {displayProgress >= 100 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="w-4 h-4 text-library-gold-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress milestones for larger bars only */}
      {size === 'lg' && (
        <div className="flex justify-between mt-1">
          {[0, 25, 50, 75, 100].map((milestone) => (
            <div key={milestone} className="flex flex-col items-center">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  displayProgress >= milestone 
                    ? colors.bg.replace('bg-', 'bg-') + ' shadow-sm'
                    : 'bg-library-sage-300'
                }`}
              />
              {(milestone === 0 || milestone === 100) && (
                <span className="text-xs text-reading-muted font-serif mt-1 opacity-60">
                  {milestone === 0 ? 'Start' : 'Done'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScholarlyProgressBar;