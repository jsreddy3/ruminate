import React from 'react';
import { Brain, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RuminateButtonProps {
  isRuminating: boolean;
  error?: string | null;
  status?: 'pending' | 'complete' | 'error';
  progress?: number;
  onRuminate: () => void;
  onCancel?: () => void;
}

export default function RuminateButton({ 
  isRuminating, 
  error, 
  status, 
  progress = 0,
  onRuminate,
  onCancel 
}: RuminateButtonProps) {
  const getButtonText = () => {
    if (error) return 'Error';
    if (status === 'complete') return 'Rumination Complete';
    if (isRuminating) return 'Ruminating...';
    return 'Ruminate';
  };

  const getButtonStyle = () => {
    if (error) return 'bg-red-600 hover:bg-red-700';
    if (status === 'complete') return 'bg-green-600 hover:bg-green-700';
    if (isRuminating) return 'bg-primary-400';
    return 'bg-primary-600 hover:bg-primary-700 hover:shadow-md';
  };

  return (
    <div className="flex items-center gap-2">
      <motion.div 
        className="relative"
        whileTap={{ scale: 0.95 }}
      >
        <button
          onClick={isRuminating ? onCancel : onRuminate}
          disabled={status === 'complete'}
          className={`
            px-4 py-2 rounded-lg text-white
            flex items-center gap-2
            transition-all duration-200
            ${getButtonStyle()}
            ${isRuminating ? 'pr-10' : ''}
            relative overflow-hidden
          `}
        >
          <motion.div
            animate={isRuminating ? {
              rotate: 360
            } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Brain className="w-5 h-5" />
          </motion.div>
          <span>{getButtonText()}</span>

          {/* Progress bar */}
          {isRuminating && (
            <motion.div 
              className="absolute bottom-0 left-0 h-1 bg-white/30"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          )}
        </button>

        {/* Cancel button */}
        {isRuminating && onCancel && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
            onClick={onCancel}
          >
            <X size={16} />
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="text-red-600 text-sm"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
} 