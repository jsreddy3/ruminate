import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Block } from './PDFViewer';
import BlockNavigator from '../interactive/blocks/BlockNavigator';

interface BlockOverlayProps {
  isOpen: boolean;
  selectedBlock: Block | null;
  flattenedBlocks: Block[];
  documentId: string;
  pdfPanelWidth: number; // Add this to track the PDF panel width
  onClose: () => void;
  onBlockChange: (block: Block) => void;
  onRefreshRabbitholes: (refreshFn: () => void) => void;
  onAddTextToChat: (text: string) => void;
  onBlockMetadataUpdate: () => void;
  onRabbitholeClick: (rabbitholeId: string, selectedText: string) => void;
  onCreateRabbithole: (text: string, startOffset: number, endOffset: number) => void;
}

export default function BlockOverlay({
  isOpen,
  selectedBlock,
  flattenedBlocks,
  documentId,
  pdfPanelWidth,
  onClose,
  onBlockChange,
  onRefreshRabbitholes,
  onAddTextToChat,
  onBlockMetadataUpdate,
  onRabbitholeClick,
  onCreateRabbithole
}: BlockOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Handle backdrop clicks to close overlay
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key to close overlay
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when overlay is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && selectedBlock && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex pointer-events-none"
          onClick={handleBackdropClick}
        >
          {/* Left side - Modal content over PDF area */}
          <div className="relative pointer-events-auto" style={{ width: `${pdfPanelWidth}%` }}>
            {/* Backdrop with dimmed PDF visibility */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            
            {/* Modal content */}
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative h-full flex items-center justify-center p-8"
            >
              <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Block Details - {selectedBlock.block_type}
                    </h2>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Navigation arrows */}
                    <button
                      onClick={() => {
                        const currentIndex = flattenedBlocks.findIndex(b => b.id === selectedBlock.id);
                        if (currentIndex > 0) {
                          onBlockChange(flattenedBlocks[currentIndex - 1]);
                        }
                      }}
                      disabled={flattenedBlocks.findIndex(b => b.id === selectedBlock.id) === 0}
                      className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous block"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => {
                        const currentIndex = flattenedBlocks.findIndex(b => b.id === selectedBlock.id);
                        if (currentIndex < flattenedBlocks.length - 1) {
                          onBlockChange(flattenedBlocks[currentIndex + 1]);
                        }
                      }}
                      disabled={flattenedBlocks.findIndex(b => b.id === selectedBlock.id) === flattenedBlocks.length - 1}
                      className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next block"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    {/* Close button */}
                    <button
                      onClick={onClose}
                      className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800"
                      title="Close (Esc)"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  <BlockNavigator
                    blocks={flattenedBlocks}
                    currentBlockId={selectedBlock.id}
                    documentId={documentId}
                    onBlockChange={onBlockChange}
                    onRefreshRabbitholes={onRefreshRabbitholes}
                    onAddTextToChat={onAddTextToChat}
                    onBlockMetadataUpdate={onBlockMetadataUpdate}
                    onRabbitholeClick={onRabbitholeClick}
                    onCreateRabbithole={onCreateRabbithole}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right side - Transparent spacer to prevent clicks on chat */}
          <div className="flex-1 pointer-events-none" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}