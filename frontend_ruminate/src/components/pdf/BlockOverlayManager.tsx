import React, { useState, useCallback } from 'react';
import { Block } from './PDFViewer';
import { createRabbithole } from '../../services/rabbithole';
import BlockOverlay from './BlockOverlay';
import BasePopover from '../common/BasePopover';
import ChatContainer from '../chat/ChatContainer';

interface RabbitholeConversation {
  id: string;
  title: string;
  selectionText: string;
  blockId: string;
}

interface BlockOverlayManagerProps {
  // Data
  blocks: Block[];
  flattenedBlocks: Block[];
  documentId: string;
  currentPanelSizes: number[];
  mainConversationId: string | null;
  
  // Rabbithole data
  rabbitholeConversations: RabbitholeConversation[];
  onSetRabbitholeConversations: (conversations: RabbitholeConversation[] | ((prev: RabbitholeConversation[]) => RabbitholeConversation[])) => void;
  onSetActiveConversationId: (id: string | null) => void;
  
  // Callbacks
  onAddTextToChat: (text: string) => void;
  onUpdateBlockMetadata: (blockId: string, metadata: any) => void;
  onFetchBlocks: () => void;
  onFetchBlockImages: (blockId: string) => void;
  getRabbitholeHighlightsForBlock: (blockId: string) => any[];
  
  // Block selection mode
  isBlockSelectionMode: boolean;
  onBlockSelectionComplete: ((blockId: string) => void) | null;
  onSetBlockSelectionMode: (mode: boolean) => void;
  onSetBlockSelectionComplete: (callback: ((blockId: string) => void) | null) => void;
  
  // Rabbithole management
  onHandleRabbitholeCreated: (conversationId: string, selectedText: string, blockId: string) => void;
  onAddRabbitholeConversation: (blockId: string, conversationId: string, selectedText: string, startOffset: number, endOffset: number) => void;
  
  // Onboarding
  onTextSelectionForOnboarding?: () => void;
  isOnboardingStep4?: boolean;
  isOnboardingStep5?: boolean;
  isOnboardingStep6?: boolean;
  isOnboardingStep7?: boolean;
  isOnboardingStep8?: boolean;
  onCreateChatForOnboarding?: () => void;
  onCompleteOnboarding?: () => void;
  
  // PDF Integration
  refreshRabbitholesFnRef: React.MutableRefObject<(() => void) | null>;
  onScrollToBlock?: (block: Block) => void;
}

interface BlockOverlayManagerReturn {
  // State
  selectedBlock: Block | null;
  isBlockOverlayOpen: boolean;
  
  // Handlers for PDF integration
  handleBlockClick: (block: Block) => void;
  handleOpenBlockWithNote: (blockId: string, noteId: string) => void;
  handleBlockSelect: (blockId: string) => void;
  
  // Block overlay component
  blockOverlayComponent: React.ReactNode;
}

export const useBlockOverlayManager = (props: BlockOverlayManagerProps): BlockOverlayManagerReturn => {
  const {
    blocks,
    flattenedBlocks,
    documentId,
    currentPanelSizes,
    mainConversationId,
    rabbitholeConversations,
    onSetRabbitholeConversations,
    onSetActiveConversationId,
    onAddTextToChat,
    onUpdateBlockMetadata,
    onFetchBlocks,
    onFetchBlockImages,
    getRabbitholeHighlightsForBlock,
    isBlockSelectionMode,
    onBlockSelectionComplete,
    onSetBlockSelectionMode,
    onSetBlockSelectionComplete,
    onHandleRabbitholeCreated,
    onAddRabbitholeConversation,
    onTextSelectionForOnboarding,
    isOnboardingStep4,
    isOnboardingStep5,
    isOnboardingStep6,
    isOnboardingStep7,
    isOnboardingStep8,
    onCreateChatForOnboarding,
    onCompleteOnboarding,
    refreshRabbitholesFnRef,
    onScrollToBlock,
  } = props;

  // Block overlay state
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isBlockOverlayOpen, setIsBlockOverlayOpen] = useState(false);

  // Rabbithole chat popover state
  const [openRabbitholePopover, setOpenRabbitholePopover] = useState<{
    conversationId: string;
    position: { x: number; y: number };
    selectedText?: string;
  } | null>(null);

  // Reusable function for block selection with lazy loading
  const handleBlockSelection = useCallback((block: Block) => {
    // Lazy load images if needed
    if (block.images && Object.values(block.images).includes("LAZY_LOAD")) {
      onFetchBlockImages(block.id);
    }
    
    setSelectedBlock(block);
  }, [onFetchBlockImages]);

  // Handle block click to select and view it
  const handleBlockClick = useCallback((block: Block) => {
    console.log(`[Block Selected in Manager] Type: ${block.type || block.block_type}, ID: ${block.id}`);
    handleBlockSelection(block);
    setIsBlockOverlayOpen(true);
  }, [handleBlockSelection]);

  // Programmatically open a block (for auto-navigation after note generation)
  const handleOpenBlockWithNote = useCallback((blockId: string, noteId: string) => {
    const targetBlock = flattenedBlocks.find(block => block.id === blockId);
    if (targetBlock) {
      setSelectedBlock(targetBlock);
      setIsBlockOverlayOpen(true);
      
      // After block opens, automatically click the generated note to show it
      setTimeout(() => {
        const icon = document.querySelector('button[title*="Generated note"], button svg[class*="lucide-lightbulb"]');
        const generatedNoteElement = icon ? (icon.closest('button') as HTMLElement | null) : null;
        if (generatedNoteElement) {
          generatedNoteElement.click();
        }
      }, 800); // Slightly longer delay to ensure block overlay is fully rendered
    } else {
      console.error('Block not found:', blockId);
    }
  }, [flattenedBlocks]);

  // Handle block selection for chat
  const handleBlockSelect = useCallback((blockId: string) => {
    if (onBlockSelectionComplete) {
      onBlockSelectionComplete(blockId);
      onSetBlockSelectionMode(false);
      onSetBlockSelectionComplete(null);
    }
  }, [onBlockSelectionComplete, onSetBlockSelectionMode, onSetBlockSelectionComplete]);

  // Handle rabbithole click -> open a popover chat instead of switching sidebar
  const handleRabbitholeClick = useCallback((
    rabbitholeId: string,
    selectedText: string,
    _start?: number,
    _end?: number,
    position?: { x: number; y: number }
  ) => {
    const title = selectedText && selectedText.length > 30 
      ? `${selectedText.substring(0, 30)}...` 
      : selectedText || "Rabbithole Chat";
    
    // Ensure this rabbithole is tracked for persistence (optional)
    const exists = rabbitholeConversations.find(c => c.id === rabbitholeId);
    if (!exists) {
      onSetRabbitholeConversations(prev => ([...prev, { id: rabbitholeId, title, selectionText: selectedText || '', blockId: selectedBlock?.id || '' }]));
    }

    // Open or focus popover
    setOpenRabbitholePopover({
      conversationId: rabbitholeId,
      position: position || { x: window.innerWidth / 2, y: window.innerHeight / 3 },
      selectedText,
    });
  }, [rabbitholeConversations, onSetRabbitholeConversations, selectedBlock]);

  // Handle rabbithole creation
  const handleCreateRabbithole = useCallback((text: string, startOffset: number, endOffset: number) => {
    if (documentId && selectedBlock) {
      createRabbithole({
        document_id: documentId,
        block_id: selectedBlock.id,
        selected_text: text,
        start_offset: startOffset,
        end_offset: endOffset,
        type: 'rabbithole'
      }).then((conversation_id) => {
        onHandleRabbitholeCreated(conversation_id, text, selectedBlock.id);
        
        // Optimistically add the new rabbithole conversation
        onAddRabbitholeConversation(selectedBlock.id, conversation_id, text, startOffset, endOffset);
        
        // Update block metadata optimistically with new rabbithole conversation ID
        const currentRabbitholeIds = selectedBlock.metadata?.rabbithole_conversation_ids || [];
        const newMetadata = {
          rabbithole_conversation_ids: [...currentRabbitholeIds, conversation_id]
        };
        onUpdateBlockMetadata(selectedBlock.id, newMetadata);
        
        // Immediately open the chat popover at the center if creation came from tooltip (no explicit position)
        setOpenRabbitholePopover({
          conversationId: conversation_id,
          position: { x: window.innerWidth / 2, y: window.innerHeight / 3 },
          selectedText: text,
        });
      }).catch(error => {
        console.error("Error creating rabbithole:", error);
      });
    }
  }, [documentId, selectedBlock, onHandleRabbitholeCreated, onAddRabbitholeConversation, onUpdateBlockMetadata]);

  // Block overlay component
  const blockOverlayComponent = (
    <>
      <BlockOverlay
        isOpen={isBlockOverlayOpen}
        selectedBlock={selectedBlock}
        flattenedBlocks={flattenedBlocks}
        documentId={documentId}
        pdfPanelWidth={currentPanelSizes[0]}
        getRabbitholeHighlightsForBlock={getRabbitholeHighlightsForBlock}
        onClose={() => {
          setIsBlockOverlayOpen(false);
          setSelectedBlock(null);
        }}
        onBlockChange={(block) => {
          handleBlockSelection(block);
          // Auto-scroll PDF to follow block navigation
          if (onScrollToBlock) {
            onScrollToBlock(block);
          }
        }}
        onRefreshRabbitholes={(refreshFn) => {
          refreshRabbitholesFnRef.current = refreshFn;
        }}
        onAddTextToChat={onAddTextToChat}
        onUpdateBlockMetadata={onUpdateBlockMetadata}
        onRabbitholeClick={handleRabbitholeClick}
        onCreateRabbithole={handleCreateRabbithole}
        onSwitchToMainChat={() => onSetActiveConversationId(null)}
        onTextSelectionForOnboarding={onTextSelectionForOnboarding}
        isOnboardingStep4={isOnboardingStep4}
        isOnboardingStep5={isOnboardingStep5}
        isOnboardingStep6={isOnboardingStep6}
        isOnboardingStep7={isOnboardingStep7}
        isOnboardingStep8={isOnboardingStep8}
        onCreateChatForOnboarding={onCreateChatForOnboarding}
        onCompleteOnboarding={onCompleteOnboarding}
        mainConversationId={mainConversationId ?? undefined}
      />

      {/* Rabbithole chat popover - draggable/resizable via BasePopover */}
      {openRabbitholePopover && (
        <BasePopover
          isVisible={true}
          position={openRabbitholePopover.position}
          onClose={() => setOpenRabbitholePopover(null)}
          title={openRabbitholePopover.selectedText || 'Rabbithole Chat'}
          draggable={true}
          resizable={true}
          initialWidth={640}
          initialHeight={500}
          minWidth={380}
          minHeight={320}
          maxWidth={800}
          maxHeight={'85vh'}
        >
          <div className="h-full w-full flex flex-col">
            <div className="flex-1 min-h-0">
              <ChatContainer
                documentId={documentId}
                selectedBlock={selectedBlock || null}
                conversationId={openRabbitholePopover.conversationId}
                conversationType="rabbithole"
                rabbitholeMetadata={openRabbitholePopover.selectedText ? {
                  source_block_id: selectedBlock?.id || '',
                  selected_text: openRabbitholePopover.selectedText
                } : undefined}
                onUpdateBlockMetadata={onUpdateBlockMetadata}
                onBlockMetadataUpdate={onFetchBlocks}
                getBlockMetadata={() => ({})}
                blocks={blocks}
              />
            </div>
          </div>
        </BasePopover>
      )}
    </>
  );

  return {
    selectedBlock,
    isBlockOverlayOpen,
    handleBlockClick,
    handleOpenBlockWithNote,
    handleBlockSelect,
    blockOverlayComponent,
  };
};