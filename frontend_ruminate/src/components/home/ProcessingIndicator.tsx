"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useProcessing } from '@/contexts/ProcessingContext';
import ProcessingModal from './ProcessingModal';

export default function ProcessingIndicator() {
  const { activeCount, processingDocuments, openProcessingModal, selectedDocumentId, isModalOpen, closeProcessingModal } = useProcessing();
  
  // Don't show indicator if no active processing or modal is open
  if (activeCount === 0 || isModalOpen) {
    return null;
  }

  // Get the first processing document to show in the indicator
  const firstProcessingDoc = Array.from(processingDocuments.values())
    .find(doc => !['READY', 'ERROR'].includes(doc.status));

  return (
    <>
      {/* Floating indicator */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-30"
        >
          <button
            onClick={() => firstProcessingDoc && openProcessingModal(firstProcessingDoc.documentId)}
            className="bg-white shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 hover:shadow-xl transition-shadow border border-gray-200"
          >
            {/* Spinner */}
            <div className="relative">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-library-mahogany-500"></div>
              {activeCount > 1 && (
                <div className="absolute -top-1 -right-1 bg-library-mahogany-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                  {activeCount}
                </div>
              )}
            </div>
            
            {/* Text */}
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">
                Processing {activeCount} document{activeCount > 1 ? 's' : ''}
              </p>
              {firstProcessingDoc && (
                <p className="text-xs text-gray-500 max-w-[200px] truncate">
                  {firstProcessingDoc.title}
                </p>
              )}
            </div>
            
            {/* Arrow */}
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Processing Modal - now controlled by global state */}
      {selectedDocumentId && (
        <ProcessingModal
          documentId={selectedDocumentId}
          isOpen={isModalOpen}
          onClose={closeProcessingModal}
        />
      )}
    </>
  );
}