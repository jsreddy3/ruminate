"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, TrashIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  isLoading = false
}: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={!isLoading ? onClose : undefined}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative bg-surface-parchment rounded-journal shadow-deep border border-library-cream-300 w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Paper texture overlay */}
              <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(0,0,0,0.1) 2px,
                    rgba(0,0,0,0.1) 4px
                  ), repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0,0,0,0.1) 2px,
                    rgba(0,0,0,0.1) 4px
                  )`
                }}
              />
              {/* Header Section with Icon */}
              <div className="bg-gradient-to-br from-library-cream-100 to-library-cream-200 px-8 py-6 border-b border-library-cream-300">
                <div className="flex items-center justify-center mb-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-paper ${
                    isDestructive 
                      ? 'bg-gradient-to-br from-library-mahogany-100 to-library-mahogany-200' 
                      : 'bg-gradient-to-br from-library-sage-100 to-library-sage-200'
                  }`}>
                    {isDestructive ? (
                      <TrashIcon className="w-7 h-7 text-library-mahogany-600" />
                    ) : (
                      <InformationCircleIcon className="w-7 h-7 text-library-sage-600" />
                    )}
                  </div>
                </div>
                
                {/* Title */}
                <h2 className="text-2xl font-serif font-semibold text-reading-primary text-center">
                  {title}
                </h2>
              </div>

              {/* Content Section */}
              <div className="px-8 py-6">
                {/* Message */}
                <p className="text-lg text-reading-secondary leading-relaxed text-center font-serif whitespace-pre-line">
                  {message}
                </p>
              </div>

              {/* Actions */}
              <div className="px-8 pb-8 pt-2">
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 px-5 py-3 text-lg font-medium text-reading-primary bg-library-cream-100 hover:bg-library-cream-200 rounded-book border border-library-sage-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-paper"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className={`flex-1 px-5 py-3 text-lg font-medium text-white rounded-book transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-paper ${
                      isDestructive 
                        ? 'bg-library-mahogany-600 hover:bg-library-mahogany-700 border border-library-mahogany-700' 
                        : 'bg-library-forest-600 hover:bg-library-forest-700 border border-library-forest-700'
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      confirmText
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}