"use client";

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProcessingProgress from './ProcessingProgress';
import { useProcessing } from '@/contexts/ProcessingContext';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ProcessingModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProcessingModal({ documentId, isOpen, onClose }: ProcessingModalProps) {
  const { getProcessing } = useProcessing();
  
  // Get processing document from context
  const processingDoc = getProcessing(documentId);
  
  // Extract current status and error from events
  const { currentStatus, error } = useMemo(() => {
    if (!processingDoc) {
      return { currentStatus: 'PENDING' as const, error: null };
    }
    
    const lastEvent = processingDoc.events[processingDoc.events.length - 1];
    const errorEvent = processingDoc.events.find(e => e.status === 'ERROR');
    
    return {
      currentStatus: processingDoc.status,
      error: errorEvent?.error || errorEvent?.message || null
    };
  }, [processingDoc]);

  return (
    <AnimatePresence>
      {isOpen && processingDoc && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 z-40"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="bg-surface-parchment rounded-journal shadow-book border border-library-cream-300 w-full max-w-2xl p-8 pointer-events-auto">
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-serif font-semibold text-reading-primary">
                    Processing Document
                  </h2>
                  <p className="text-base text-reading-muted mt-1 max-w-md truncate">
                    {processingDoc.title}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-library-cream-200 transition-colors text-library-sage-600 hover:text-library-sage-800"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Content */}
              <div className="mb-6">
                <ProcessingProgress 
                  events={processingDoc.events}
                  currentStatus={currentStatus}
                  error={error || undefined}
                />
              </div>
              
              {/* Footer Info */}
              <div className="mt-8 pt-6 border-t border-library-cream-300">
                {currentStatus === 'ERROR' ? (
                  <div className="text-center">
                    <p className="text-sm text-red-700 font-medium mb-3">
                      Processing failed and cannot be recovered.
                    </p>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-library-mahogany-500 text-white rounded-book hover:bg-library-mahogany-600 transition-colors text-sm font-medium"
                    >
                      Close and Upload Again
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-reading-muted text-center">
                    You can close this window and continue browsing. 
                    Processing will continue in the background.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}