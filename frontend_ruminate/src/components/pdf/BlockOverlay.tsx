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
  getRabbitholeHighlightsForBlock: (blockId: string) => any[];
  onClose: () => void;
  onBlockChange: (block: Block) => void;
  onRefreshRabbitholes: (refreshFn: () => void) => void;
  onAddTextToChat: (text: string) => void;
  onUpdateBlockMetadata: (blockId: string, newMetadata: any) => void;
  onRabbitholeClick: (rabbitholeId: string, selectedText: string) => void;
  onCreateRabbithole: (text: string, startOffset: number, endOffset: number) => void;
  onSwitchToMainChat?: () => void;
  mainConversationId?: string | undefined;
}

export default function BlockOverlay({
  isOpen,
  selectedBlock,
  flattenedBlocks,
  documentId,
  pdfPanelWidth,
  getRabbitholeHighlightsForBlock,
  onClose,
  onBlockChange,
  onRefreshRabbitholes,
  onAddTextToChat,
  onUpdateBlockMetadata,
  onRabbitholeClick,
  onCreateRabbithole,
  onSwitchToMainChat,
  mainConversationId
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
          {/* Left side - Modal content over PDF area - strictly constrained to panel */}
          <div className="relative pointer-events-auto overflow-hidden" style={{ width: `${pdfPanelWidth}%` }}>
            {/* Backdrop with dimmed PDF visibility */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            
            {/* Modal content */}
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative h-full flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-lg shadow-2xl max-h-[80vh] flex flex-col relative" style={{ width: '75%' }}>
                {/* Close button - positioned absolutely in top right corner */}
                <button
                  onClick={onClose}
                  className="absolute z-30 p-2 rounded-full bg-white shadow-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                  style={{ top: '12px', right: '12px' }}
                  title="Close (Esc)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Content - full height */}
                <div className="flex-1 overflow-hidden rounded-lg">
                  <BlockNavigator
                    blocks={flattenedBlocks}
                    currentBlockId={selectedBlock.id}
                    documentId={documentId}
                    getRabbitholeHighlightsForBlock={getRabbitholeHighlightsForBlock}
                    onBlockChange={onBlockChange}
                    onRefreshRabbitholes={onRefreshRabbitholes}
                    onAddTextToChat={onAddTextToChat}
                    onUpdateBlockMetadata={onUpdateBlockMetadata}
                    onRabbitholeClick={onRabbitholeClick}
                    onCreateRabbithole={onCreateRabbithole}
                    onSwitchToMainChat={onSwitchToMainChat}
                    mainConversationId={mainConversationId}
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