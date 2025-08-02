import React, { useState, useCallback } from 'react';
import { Block } from './PDFViewer';
import { createRabbithole } from '../../services/rabbithole';
import BlockOverlay from './BlockOverlay';

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
        const generatedNoteElement = document.querySelector('button[title*="Generated note"], button svg[class*="lucide-lightbulb"]')?.closest('button');
        if (generatedNoteElement) {
          (generatedNoteElement as HTMLElement).click();
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

  // Handle rabbithole click
  const handleRabbitholeClick = useCallback((rabbitholeId: string, selectedText: string) => {
    const existingConversation = rabbitholeConversations.find(c => c.id === rabbitholeId);
    if (existingConversation) {
      onSetActiveConversationId(rabbitholeId);
      return;
    }
    
    const title = selectedText && selectedText.length > 30 
      ? `${selectedText.substring(0, 30)}...` 
      : selectedText || "Rabbithole Chat";
    
    onSetRabbitholeConversations(prev => [
      ...prev, 
      {
        id: rabbitholeId,
        title,
        selectionText: selectedText || "",
        blockId: selectedBlock?.id || ""
      }
    ]);
    
    onSetActiveConversationId(rabbitholeId);
  }, [rabbitholeConversations, selectedBlock, onSetRabbitholeConversations, onSetActiveConversationId]);

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
      }).catch(error => {
        console.error("Error creating rabbithole:", error);
      });
    }
  }, [documentId, selectedBlock, onHandleRabbitholeCreated, onAddRabbitholeConversation, onUpdateBlockMetadata]);

  // Block overlay component
  const blockOverlayComponent = (
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