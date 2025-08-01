import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import ScholarlyProgressBar from '../../common/ScholarlyProgressBar';

interface BlockNavigatorPillProps {
  currentIndex: number;
  totalBlocks: number;
  onPrevious: () => void;
  onNext: () => void;
}

export default function BlockNavigatorPill({
  currentIndex,
  totalBlocks,
  onPrevious,
  onNext
}: BlockNavigatorPillProps) {
  const progress = ((currentIndex + 1) / totalBlocks) * 100;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalBlocks - 1;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-surface-parchment to-library-cream-100 border-2 border-library-sage-300 rounded-journal shadow-book"
    >
      {/* Back button with scholarly styling */}
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className={`group p-1.5 rounded-book transition-all duration-300 ${
          canGoPrevious 
            ? 'hover:bg-library-cream-200 text-library-mahogany-600 hover:text-library-mahogany-800' 
            : 'text-library-sage-400 cursor-not-allowed'
        }`}
        aria-label="Previous passage"
      >
        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
      </button>

      {/* Forward button with scholarly styling */}
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={`group p-1.5 rounded-book transition-all duration-300 ${
          canGoNext 
            ? 'hover:bg-library-cream-200 text-library-mahogany-600 hover:text-library-mahogany-800' 
            : 'text-library-sage-400 cursor-not-allowed'
        }`}
        aria-label="Next passage"
      >
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </motion.div>
  );
}