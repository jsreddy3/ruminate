import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import GeneratedNoteBadges from './GeneratedNoteBadges';

interface BlockNavigatorPillProps {
  currentIndex: number;
  totalBlocks: number;
  onPrevious: () => void;
  onNext: () => void;
  currentBlockMetadata?: { [key: string]: any };
  onViewConversation?: (conversationId: string) => void;
}

export default function BlockNavigatorPill({
  currentIndex,
  totalBlocks,
  onPrevious,
  onNext,
  currentBlockMetadata,
  onViewConversation
}: BlockNavigatorPillProps) {
  const progress = ((currentIndex + 1) / totalBlocks) * 100;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalBlocks - 1;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-3 px-2 py-1.5 bg-white border border-gray-200 rounded-full shadow-xl"
    >
      {/* Back button */}
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className={`p-1.5 rounded-full transition-all ${
          canGoPrevious 
            ? 'hover:bg-gray-100 text-gray-600 hover:text-gray-800' 
            : 'text-gray-300 cursor-not-allowed'
        }`}
        aria-label="Previous block"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <div className="w-40 h-2 bg-gray-100 rounded-full relative">
        <div 
          className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Progress numbers */}
      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
        {currentIndex + 1}/{totalBlocks}
      </span>

      {/* Generated note badges */}
      <GeneratedNoteBadges
        annotations={currentBlockMetadata?.annotations}
        onViewConversation={onViewConversation}
      />

      {/* Forward button */}
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={`p-1.5 rounded-full transition-all ${
          canGoNext 
            ? 'hover:bg-gray-100 text-gray-600 hover:text-gray-800' 
            : 'text-gray-300 cursor-not-allowed'
        }`}
        aria-label="Next block"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}