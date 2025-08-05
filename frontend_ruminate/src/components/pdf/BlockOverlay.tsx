import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Block } from './PDFViewer';
import BlockNavigator from '../interactive/blocks/BlockNavigator';
import { TextSelectionTourDialogue } from '../onboarding/TextSelectionTourDialogue';

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
  onTextSelectionForOnboarding?: () => void;
  isOnboardingStep4?: boolean; // New prop to indicate onboarding step 4
  isOnboardingStep5?: boolean; // New prop to indicate onboarding step 5
  isOnboardingStep6?: boolean; // New prop to indicate onboarding step 6
  isOnboardingStep7?: boolean; // New prop to indicate onboarding step 7
  isOnboardingStep8?: boolean; // New prop to indicate onboarding step 8
  onCreateChatForOnboarding?: () => void; // Callback for create chat onboarding
  onCompleteOnboarding?: () => void; // Callback to complete onboarding
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
  onTextSelectionForOnboarding,
  isOnboardingStep4,
  isOnboardingStep5,
  isOnboardingStep6,
  isOnboardingStep7,
  isOnboardingStep8,
  onCreateChatForOnboarding,
  onCompleteOnboarding,
  mainConversationId,
}: BlockOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Handle backdrop clicks to close overlay
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    console.log('Backdrop click:', e.target === e.currentTarget ? 'on backdrop' : 'on child element');
    // Only close if clicking the backdrop itself (not bubbled from children)
    if (e.target === e.currentTarget) {
      // Ensure we're not in a restricted onboarding step
      if (!isOnboardingStep4 && !isOnboardingStep5 && !isOnboardingStep6 && !isOnboardingStep7) {
        onClose();
      }
    }
  }, [onClose, isOnboardingStep4, isOnboardingStep5, isOnboardingStep6, isOnboardingStep7]);

  // Handle escape key to close overlay
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isOnboardingStep4 && !isOnboardingStep5 && !isOnboardingStep6 && !isOnboardingStep7) {
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
  }, [isOpen, onClose, isOnboardingStep4, isOnboardingStep5, isOnboardingStep6, isOnboardingStep7]);

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
        >
          {/* Left side - Modal content over PDF area - strictly constrained to panel */}
          <div 
            className="relative pointer-events-auto overflow-hidden" 
            style={{ width: `${pdfPanelWidth}%` }}
          >
            {/* Backdrop with dimmed PDF visibility - clicking this closes the modal */}
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" 
              onClick={handleBackdropClick}
            />
            
            
            {/* Modal content - pointer-events-none on wrapper, pointer-events-auto on content */}
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative h-full flex items-center justify-center p-4 pointer-events-none"
            >
              <div 
                ref={modalContentRef}
                className={`bg-white rounded-lg shadow-2xl max-h-[80vh] flex flex-col relative overflow-hidden transition-all duration-300 pointer-events-auto ${
                isOnboardingStep7 ? 'opacity-50' : ''
              }`} style={{ width: '75%' }}>
                {/* Close button - positioned absolutely in top right corner */}
                <div className="absolute z-30" style={{ top: '12px', right: '12px' }}>
                  {/* Add glowing rings animation for step 8 */}
                  {isOnboardingStep8 && (
                    <>
                      <div className="absolute inset-0 bg-library-gold-400 rounded-full animate-ping opacity-75" />
                      <div className="absolute inset-0 bg-library-gold-400 rounded-full animate-ping opacity-50" style={{ animationDelay: '0.5s' }} />
                      <div className="absolute inset-0 bg-library-gold-300 rounded-full animate-ping opacity-30" style={{ animationDelay: '1s' }} />
                    </>
                  )}
                  <button
                    onClick={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7) ? undefined : () => {
                      onClose();
                      // Advance to step 9 if we're in step 8
                      if (isOnboardingStep8 && onCompleteOnboarding) {
                        onCompleteOnboarding(); // This should advance to step 9, not complete onboarding
                      }
                    }}
                    className={`relative p-2 rounded-full shadow-lg transition-all duration-300 ${
                      (isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7) 
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                        : isOnboardingStep8
                          ? 'bg-gradient-to-br from-library-gold-400 to-library-gold-500 text-white shadow-2xl ring-4 ring-library-gold-300/70 scale-125 hover:scale-130'
                          : 'bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800'
                    }`}
                    style={isOnboardingStep8 ? {
                      animation: 'glow 2s ease-in-out infinite',
                      boxShadow: '0 0 20px rgba(249, 207, 95, 0.8), 0 0 40px rgba(249, 207, 95, 0.4)'
                    } : {}}
                    title={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7) ? "Complete the tutorial to continue" : isOnboardingStep8 ? "Click here to complete the tour!" : "Close (Esc)"}
                    disabled={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7)}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content - full height */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                  <BlockNavigator
                    blocks={flattenedBlocks}
                    currentBlockId={selectedBlock.id}
                    documentId={documentId}
                    getRabbitholeHighlightsForBlock={getRabbitholeHighlightsForBlock}
                    onBlockChange={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7) ? undefined : onBlockChange}
                    onRefreshRabbitholes={onRefreshRabbitholes}
                    onAddTextToChat={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7) ? undefined : onAddTextToChat}
                    onUpdateBlockMetadata={onUpdateBlockMetadata}
                    onRabbitholeClick={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7) ? undefined : onRabbitholeClick}
                    onCreateRabbithole={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep7) ? undefined : onCreateRabbithole}
                    onSwitchToMainChat={(isOnboardingStep4 || isOnboardingStep5 || isOnboardingStep6 || isOnboardingStep7) ? undefined : onSwitchToMainChat}
                    onTextSelectionForOnboarding={onTextSelectionForOnboarding}
                    isOnboardingStep4={isOnboardingStep4}
                    isOnboardingStep5={isOnboardingStep5}
                    isOnboardingStep6={isOnboardingStep6}
                    isOnboardingStep7={isOnboardingStep7}
                    isOnboardingStep8={isOnboardingStep8}
                    onCreateChatForOnboarding={onCreateChatForOnboarding}
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