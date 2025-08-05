"use client";

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadProgressSteps from './UploadProgressSteps';
import { useProcessing } from '@/contexts/ProcessingContext';

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

  // The document is already being tracked by ProcessingContext, no need for SSE here
  
  // Can close modal anytime now
  const canClose = true;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={canClose ? onClose : undefined}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Processing Your Document
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <UploadProgressSteps 
                  events={processingDoc?.events || []}
                  currentStatus={currentStatus}
                  error={error || undefined}
                />
                
                {/* Info message about background processing */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> You can close this window and continue using the app. 
                    Processing will continue in the background.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}