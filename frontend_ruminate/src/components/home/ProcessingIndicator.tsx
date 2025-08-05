"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useProcessing } from '@/contexts/ProcessingContext';
import ProcessingModal from './ProcessingModal';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export default function ProcessingIndicator() {
  const { activeCount, processingDocuments, openProcessingModal, selectedDocumentId, isModalOpen, closeProcessingModal } = useProcessing();
  
  // Get the first processing document to show in the indicator
  const firstProcessingDoc = Array.from(processingDocuments.values())
    .find(doc => !['READY', 'ERROR'].includes(doc.status));

  return (
    <>
      {/* Floating indicator - only show when there's processing and modal is closed */}
      {activeCount > 0 && !isModalOpen && (
        <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="fixed bottom-6 right-6 z-30"
        >
          <button
            onClick={() => firstProcessingDoc && openProcessingModal(firstProcessingDoc.documentId)}
            className="bg-surface-parchment shadow-book rounded-journal px-5 py-3 flex items-center gap-3 hover:shadow-lg transition-all border border-library-cream-300 hover:border-library-cream-400"
          >
            {/* Spinner with count badge */}
            <div className="relative">
              <div className="w-5 h-5 border-2 border-library-mahogany-200 border-t-library-mahogany-600 rounded-full animate-spin" />
              {activeCount > 1 && (
                <div className="absolute -top-2 -right-2 bg-library-mahogany-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium shadow-sm">
                  {activeCount}
                </div>
              )}
            </div>
            
            {/* Text */}
            <div className="text-left">
              <p className="text-sm font-medium text-reading-primary">
                Processing {activeCount > 1 ? `${activeCount} documents` : 'document'}
              </p>
              {firstProcessingDoc && (
                <p className="text-xs text-reading-muted max-w-[200px] truncate">
                  {firstProcessingDoc.title}
                </p>
              )}
            </div>
            
            {/* Arrow */}
            <ChevronRightIcon className="w-4 h-4 text-library-sage-500" />
          </button>
        </motion.div>
        </AnimatePresence>
      )}

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