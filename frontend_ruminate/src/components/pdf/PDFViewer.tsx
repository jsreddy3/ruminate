"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { documentApi } from "../../services/api/document";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import PDFBlockOverlay from "./PDFBlockOverlay";
import PDFToolbar from "./PDFToolbar";
import ChatSidebar from "./ChatSidebar";
import { useBlockOverlayManager } from "./BlockOverlayManager";
import VirtualizedPDFViewer from "./VirtualizedPDFWrapper";
import MainConversationButton from "../chat/MainConversationButton";
import { useReadingProgress } from "../../hooks/useReadingProgress";
import { useViewportReadingTracker } from "../../hooks/useViewportReadingTracker";
import GlossaryView from "../interactive/blocks/GlossaryView";
import AnnotationsView from "../interactive/blocks/AnnotationsView";
import { useVirtualizedPDF } from "./hooks/useVirtualizedPDF";
import { useViewMode } from "./hooks/useViewMode";
import { useBlockManagement } from "./hooks/useBlockManagement";
import { useConversations } from "./hooks/useConversations";
import { useOnboarding } from "./hooks/useOnboarding";
import { pdfViewerGlobalStyles } from "./PDFViewerStyles";
import { OnboardingOverlays } from "./components/OnboardingOverlays";
import { PDFLoadingUI } from "./components/PDFLoadingUI";
import { usePanelStorage } from "../../hooks/usePanelStorage";
import DefinitionPopup from "../interactive/blocks/text/TooltipManager/DefinitionPopup";
import { useTextEnhancements } from "../../hooks/useTextEnhancements";

export interface Block {
  id: string;
  type: string;
  block_type: string;
  html_content: string;
  polygon: number[][];
  page_number?: number;
  pageIndex?: number;
  children?: Block[];
  images?: { [key: string]: string };
  metadata?: {
    definitions?: {
      [term: string]: {
        term: string;
        definition: string;
        created_at: string;
      };
    };
    annotations?: {
      [key: string]: {
        id: string;
        text: string;
        note: string;
        text_start_offset: number;
        text_end_offset: number;
        created_at: string;
        updated_at: string;
      };
    };
    rabbithole_conversation_ids?: string[];  // Just the conversation IDs
    [key: string]: any;
  };
}


interface PDFViewerProps {
  initialPdfFile: string;
  initialDocumentId: string;
}


function PDFViewerInner({ initialPdfFile, initialDocumentId }: PDFViewerProps) {
  const router = useRouter();

  const [pdfFile] = useState<string>(initialPdfFile);
  const [documentId] = useState<string>(initialDocumentId);
  // Combine document state to reduce renders
  const [documentState, setDocumentState] = useState<{
    title: string;
    data: any;
  }>({ title: '', data: null });
  
  // Use the virtualized PDF hook for all PDF-related state and logic
  const {
    pdfLoadingState,
    currentPage,
    totalPages,
    scale,
    forceRefreshKey,
    handleDocumentLoad,
    handlePageChange,
    handleForceRefresh,
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    setCurrentPage,
    scrollToPageRef,
  } = useVirtualizedPDF({ pdfFile, documentId });

  // Block overlay state now managed by useBlockOverlayManager hook
  
  
  // Block selection mode state
  const [isBlockSelectionMode, setIsBlockSelectionMode] = useState(false);
  const [blockSelectionPrompt, setBlockSelectionPrompt] = useState<string>("Select a block");
  const [onBlockSelectionComplete, setOnBlockSelectionComplete] = useState<((blockId: string) => void) | null>(null);
  
  
  
  // View mode management
  const {
    viewMode,
    isViewDropdownOpen,
    viewDropdownPosition,
    setViewMode,
    handleViewDropdownToggle,
    closeViewDropdown,
    handleViewModeSelect,
  } = useViewMode();
  
  // Add state for pending text to be added to chat
  const [pendingChatText, setPendingChatText] = useState<string>('');
  
  // Add ref to store the rabbithole refresh function
  const refreshRabbitholesFnRef = useRef<(() => void) | null>(null);
  
  // Definition approval flow removed: revert to inline definition popup behavior


  // Block management - first without updateProgress
  const blockManagement = useBlockManagement({
    documentId,
    updateProgress: undefined // Will be set later
  });
  
  const { blocks, flattenedBlocks, fetchBlocks, fetchBlockImages, updateBlockMetadata: updateBlockMetadataBase } = blockManagement;
  
  // Reading Progress Hook - initialized after flattenedBlocks are set
  const { updateProgress, scrollToFurthestBlock, initializeProgress, getFurthestProgress } = useReadingProgress({
    documentId,
    flattenedBlocks
  });
  
  // Wrap updateBlockMetadata to include progress tracking
  const updateBlockMetadata = useCallback((blockId: string, newMetadata: any) => {
    updateBlockMetadataBase(blockId, newMetadata);
    if (updateProgress) {
      updateProgress(blockId);
    }
  }, [updateBlockMetadataBase, updateProgress]);
  
  // Text enhancements management
  const {
    enhancements: textEnhancements,
    // loading: textEnhancementsLoading,
    // error: textEnhancementsError,
    refetch: refetchTextEnhancements,
    getDefinitionsForBlock,
    getAnnotationsForBlock,
    getRabbitholesForBlock,
  } = useTextEnhancements(documentId);
  
  // Convert text enhancement rabbitholes to the format expected by existing components
  const getRabbitholeHighlightsForBlockNew = useCallback((blockId: string) => {
    const rabbitholes = getRabbitholesForBlock(blockId);
    return rabbitholes.map(r => ({
      id: r.data.conversation_id || r.id,
      selected_text: r.text,
      text_start_offset: r.text_start_offset,
      text_end_offset: r.text_end_offset,
      created_at: r.created_at,
      conversation_id: r.data.conversation_id,
    }));
  }, [getRabbitholesForBlock]);
  
  // Conversation management
  const {
    activeConversationId,
    rabbitholeConversations,
    rabbitholeData,
    setActiveConversationId,
    setRabbitholeConversations,
    handleRabbitholeCreated: handleRabbitholeCreatedBase,
    addRabbitholeConversation,
    getRabbitholeHighlightsForBlock,
    switchToMainConversation,
  } = useConversations({
    documentId,
    mainConversationId: documentState.data?.main_conversation_id,
  });
  
  // Wrap handleRabbitholeCreated to include progress tracking
  const handleRabbitholeCreated = useCallback((
    conversationId: string,
    selectedText: string,
    blockId: string
  ) => {
    handleRabbitholeCreatedBase(conversationId, selectedText, blockId);
    // Update reading progress when user creates a rabbithole
    if (blockId && updateProgress) {
      updateProgress(blockId);
    }
  }, [handleRabbitholeCreatedBase, updateProgress]);


  // Fetch document title and initialize reading progress
  useEffect(() => {
    const fetchDocumentTitle = async () => {
      try {
        const docData = await documentApi.getDocument(documentId);
        // Single state update instead of two
        setDocumentState({ 
          title: docData.title, 
          data: docData 
        });
        
        // Initialize reading progress from document data
        if (initializeProgress) {
          initializeProgress(docData);
        }
      } catch (error) {
        console.error('Error fetching document title:', error);
        setDocumentState(prev => ({ ...prev, title: 'Unknown Document' }));
      }
    };

    if (documentId) {
      fetchDocumentTitle();
    }
  }, [documentId, initializeProgress]);

  // Block interaction handlers now managed by useBlockOverlayManager hook
  

  // renderOverlay moved to after blockOverlayManager hook

  // Use our custom hook for the main panel layout (PDF vs chat)
  const [mainPanelSizes, saveMainPanelSizes] = usePanelStorage('main', [40, 60]);
  
  // Track current panel sizes for overlay
  const [currentPanelSizes, setCurrentPanelSizes] = useState(mainPanelSizes);

  // Collapsible main chat
  const chatPanelRef = useRef<ImperativePanelHandle | null>(null);
  const pdfPanelRef = useRef<ImperativePanelHandle | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [lastChatSize, setLastChatSize] = useState<number>(mainPanelSizes[1]);
  const collapseChat = useCallback(() => {
    // Remember current size from layout state, then hard-resize to 0
    if (Array.isArray(currentPanelSizes) && currentPanelSizes.length > 1) {
      setLastChatSize(currentPanelSizes[1] || 30);
    }
    chatPanelRef.current?.resize?.(0);
    pdfPanelRef.current?.resize?.(100);
    setIsChatCollapsed(true);
  }, [currentPanelSizes]);
  const expandChat = useCallback(() => {
    // Restore to last known size (fallback to 40 if missing)
    const target = lastChatSize && lastChatSize > 0 ? lastChatSize : 40;
    chatPanelRef.current?.resize?.(target);
    pdfPanelRef.current?.resize?.(100 - target);
    setIsChatCollapsed(false);
  }, [lastChatSize]);
  
  // Ensure panel sizes are applied correctly
  useEffect(() => {
    // Allow layout to fully settle after mounting
    const timer = setTimeout(() => {
      // Force a resize event to ensure PDF viewer recalculates layouts
      window.dispatchEvent(new Event('resize'));
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // Run once on mount


  // Add handlers for pending text management
  const handleAddTextToChat = useCallback((text: string) => {
    setPendingChatText(text);
  }, []);

  const handleTextAdded = useCallback(() => {
    setPendingChatText('');
  }, []);

  // Get furthest progress for later use
  const furthestProgress = getFurthestProgress();


  // State for temporarily highlighted block
  const [temporarilyHighlightedBlockId, setTemporarilyHighlightedBlockId] = useState<string | null>(null);

  // Add effect to log active conversation changes and scroll to block
  // Removed duplicate effect - scrolling is now handled by handleConversationChangeWithScroll



  // Scroll to specific block using virtualized viewer
  const scrollToBlock = useCallback(async (block: Block) => {
    if (!block.polygon || typeof block.page_number !== 'number') return;
    
    try {
      // Use the virtualized scroll function (convert 0-indexed to 1-indexed)
      goToPage(block.page_number + 1);
    } catch (error) {
      console.error('Failed to scroll to block:', error);
      // Fallback to setting current page
      setCurrentPage(block.page_number + 1);
    }
  }, [goToPage, setCurrentPage]);

  // Use the onboarding hook
  const onboarding = useOnboarding({
    blocks,
    flattenedBlocks,
    onBlockClick: (block) => blockOverlayManager?.handleBlockClick(block),
    viewMode,
    closeViewDropdown,
  });

  // Effect to handle onboarding progression from step 2 to 3
  useEffect(() => {
    // If we're in step 2 and the PDF viewer is ready, advance to step 3
    if (onboarding.onboardingState.isActive && 
        onboarding.onboardingState.currentStep === 2 &&
        pdfLoadingState === 'loaded' &&
        flattenedBlocks.length > 0 &&
        currentPage === 1) { // Ensure we're on the first page
      // Advance to step 3 now that everything is ready
      onboarding.setStep(3);
    }
  }, [onboarding.onboardingState.isActive, onboarding.onboardingState.currentStep,
      pdfLoadingState, flattenedBlocks.length, currentPage, onboarding.setStep]);

  // Effect to handle onboarding step 3 - scroll to target block
  useEffect(() => {
    if (onboarding.onboardingState.isActive && 
        onboarding.onboardingState.currentStep === 3 && 
        onboarding.onboardingTargetBlockId && 
        flattenedBlocks.length > 0) {
      const targetBlock = flattenedBlocks.find(b => b.id === onboarding.onboardingTargetBlockId);
      if (targetBlock) {
        // Ensure we're on the right page first
        if (currentPage !== (targetBlock.page_number ?? 0) + 1) {
          scrollToBlock(targetBlock);
        }
      }
    }
  }, [onboarding.onboardingState.isActive, onboarding.onboardingState.currentStep, 
      onboarding.onboardingTargetBlockId, flattenedBlocks, scrollToBlock, currentPage]);

  // Block Overlay Manager - handles block selection and interactions
  const blockOverlayManager = useBlockOverlayManager({
    blocks,
    flattenedBlocks,
    documentId,
    currentPanelSizes,
    mainConversationId: documentState.data?.main_conversation_id,
    rabbitholeConversations,
    onSetRabbitholeConversations: setRabbitholeConversations,
    onSetActiveConversationId: setActiveConversationId,
    onAddTextToChat: handleAddTextToChat,
    onUpdateBlockMetadata: updateBlockMetadata,
    onFetchBlocks: fetchBlocks,
    onFetchBlockImages: fetchBlockImages,
    getRabbitholeHighlightsForBlock,
    isBlockSelectionMode,
    onBlockSelectionComplete,
    onSetBlockSelectionMode: setIsBlockSelectionMode,
    onSetBlockSelectionComplete: setOnBlockSelectionComplete,
    onHandleRabbitholeCreated: handleRabbitholeCreated,
    onAddRabbitholeConversation: addRabbitholeConversation,
    ...onboarding.getBlockOverlayManagerProps(),
    refreshRabbitholesFnRef,
    onScrollToBlock: scrollToBlock,
  });

  // Viewport Reading Tracker - for timer-based progress tracking (only when block is selected)
  useViewportReadingTracker({
    blocks,
    flattenedBlocks,
    onProgressUpdate: updateProgress,
    lastInteractionBlockId: furthestProgress.furthestBlockId,
    lastInteractionPosition: furthestProgress.furthestPosition,
    selectedBlockId: blockOverlayManager.selectedBlock?.id || null
  });


  // Handle block selection requests from chat - now has access to blockOverlayManager
  const handleBlockSelectionRequest = useCallback((config: {
    prompt: string;
    onComplete: (blockId: string) => void;
  }) => {
    // Auto-select if block overlay is open with a selected block
    if (blockOverlayManager.selectedBlock && blockOverlayManager.isBlockOverlayOpen) {
      config.onComplete(blockOverlayManager.selectedBlock.id);
      return;
    }
    
    // Otherwise use manual selection
    setIsBlockSelectionMode(true);
    setBlockSelectionPrompt(config.prompt);
    setOnBlockSelectionComplete(() => config.onComplete);
  }, [blockOverlayManager.selectedBlock, blockOverlayManager.isBlockOverlayOpen]);

  // PDF overlay renderer - using refs to avoid dependency changes
  // Pre-compute blocks by page for efficient lookup
  // Use a ref to track if blocks content actually changed
  const prevBlocksRef = useRef<Block[]>([]);
  const blocksByPageRef = useRef<Map<number, Block[]>>(new Map());
  
  const blocksByPage = useMemo(() => {
    // Deep comparison - only recompute if blocks actually changed
    const blocksChanged = blocks.length !== prevBlocksRef.current.length ||
      blocks.some((block, i) => {
        const prevBlock = prevBlocksRef.current[i];
        return !prevBlock || 
          block.id !== prevBlock.id || 
          block.page_number !== prevBlock.page_number ||
          block.block_type !== prevBlock.block_type ||
          block.metadata !== prevBlock.metadata; // Check metadata changes too!
      });
    
    if (!blocksChanged && blocksByPageRef.current.size > 0) {
      return blocksByPageRef.current;
    }
    const map = new Map<number, Block[]>();
    blocks.forEach(block => {
      const pageNum = block.page_number ?? 0;
      if (block.block_type !== "Page") {
        if (!map.has(pageNum)) {
          map.set(pageNum, []);
        }
        map.get(pageNum)!.push(block);
      }
    });
    
    prevBlocksRef.current = blocks;
    blocksByPageRef.current = map;
    return map;
  }, [blocks]);

  // Track PDFViewer renders and state changes
  const viewerRenderRef = useRef(0);
  const prevStateRef = useRef({
    currentPage,
    totalPages,
    scale,
    blocksLength: blocks.length,
    isBlockSelectionMode,
    activeConversationId,
    viewMode
  });
  
  viewerRenderRef.current++;
  
  const stateChanges = [];
  if (prevStateRef.current.currentPage !== currentPage) 
    stateChanges.push(`currentPage(${prevStateRef.current.currentPage}→${currentPage})`);
  if (prevStateRef.current.totalPages !== totalPages) 
    stateChanges.push(`totalPages(${prevStateRef.current.totalPages}→${totalPages})`);
  if (prevStateRef.current.scale !== scale) 
    stateChanges.push(`scale(${prevStateRef.current.scale}→${scale})`);
  if (prevStateRef.current.blocksLength !== blocks.length) 
    stateChanges.push(`blocks(${prevStateRef.current.blocksLength}→${blocks.length})`);
  if (prevStateRef.current.isBlockSelectionMode !== isBlockSelectionMode) 
    stateChanges.push(`selectionMode(${prevStateRef.current.isBlockSelectionMode}→${isBlockSelectionMode})`);
  if (prevStateRef.current.activeConversationId !== activeConversationId) 
    stateChanges.push(`activeConv(${prevStateRef.current.activeConversationId}→${activeConversationId})`);
  if (prevStateRef.current.viewMode !== viewMode) 
    stateChanges.push(`viewMode(${prevStateRef.current.viewMode}→${viewMode})`);
    
  prevStateRef.current = {
    currentPage,
    totalPages,
    scale,
    blocksLength: blocks.length,
    isBlockSelectionMode,
    activeConversationId,
    viewMode
  };

  // Memoize renderLoader to prevent recreating on every render
  const renderLoader = useCallback((percentages: number) => (
    <PDFLoadingUI 
      percentages={percentages}
      pdfLoadingState={pdfLoadingState}
      pdfFile={pdfFile}
      onForceRefresh={handleForceRefresh}
    />
  ), [pdfLoadingState, pdfFile, handleForceRefresh]);

  // Removed renderOverlay - now handled by PDFPageOverlay component directly

  // Enhanced search functionality with scroll-to-block
  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    // Search through flattened blocks for text content
    const searchTerm = query.toLowerCase();
    const matchingBlock = flattenedBlocks.find(block => {
      if (!block.html_content) return false;
      // Strip HTML tags and search in the text content
      const textContent = block.html_content.replace(/<[^>]*>/g, '').toLowerCase();
      return textContent.includes(searchTerm);
    });
    
    
    
    if (matchingBlock && typeof matchingBlock.page_number === 'number' && matchingBlock.page_number >= 0) {
      // First scroll to the block position (this handles the page navigation)
      scrollToBlock(matchingBlock);
      
      // Then open the block overlay after a longer delay to ensure navigation completes
      setTimeout(() => {
        blockOverlayManager.handleBlockClick(matchingBlock);
      }, 800);
    } else {
    }
  }, [flattenedBlocks, blockOverlayManager, setCurrentPage, scrollToBlock]);

  // Resume reading functionality
  const handleResumeReading = useCallback(async () => {
    const furthestBlockId = scrollToFurthestBlock();
    if (furthestBlockId) {
      const block = flattenedBlocks.find(b => b.id === furthestBlockId);
      if (block) {
        await scrollToBlock(block);
        setTimeout(() => {
          blockOverlayManager.handleBlockClick(block);
        }, 500);
      }
    }
  }, [scrollToFurthestBlock, flattenedBlocks, scrollToBlock, blockOverlayManager]);

  // Handle conversation change with scrolling to associated block
  const handleConversationChangeWithScroll = useCallback(async (conversationId: string | null) => {
    // First, change the active conversation
    setActiveConversationId(conversationId);
    
    // If it's a rabbithole conversation, scroll to its block
    if (conversationId) {
      const rabbitholeConv = rabbitholeConversations.find(conv => conv.id === conversationId);
      if (rabbitholeConv && rabbitholeConv.blockId) {
        const block = flattenedBlocks.find(b => b.id === rabbitholeConv.blockId);
        if (block) {
          // Small delay to ensure conversation switch happens first
          setTimeout(async () => {
            await scrollToBlock(block);
            
            // Add temporary highlight effect
            setTemporarilyHighlightedBlockId(block.id);
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
              setTemporarilyHighlightedBlockId(null);
            }, 2000);
          }, 100);
        }
      }
    }
  }, [setActiveConversationId, rabbitholeConversations, flattenedBlocks, scrollToBlock]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Command+F or Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        // Focus the search input in the toolbar
        const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
      
      // Arrow keys for page navigation
      // Only trigger if not focused on an input/textarea
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      );
      
      if (!isInputFocused) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          goToPreviousPage();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          goToNextPage();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [goToPreviousPage, goToNextPage]);


  return (
    <>
      <style jsx global>{`
        ${pdfViewerGlobalStyles}
        
        @keyframes glow {
          0% {
            box-shadow: 0 0 20px rgba(249, 207, 95, 0.8), 0 0 40px rgba(249, 207, 95, 0.4);
          }
          50% {
            box-shadow: 0 0 30px rgba(249, 207, 95, 1), 0 0 60px rgba(249, 207, 95, 0.6), 0 0 80px rgba(249, 207, 95, 0.3);
          }
          100% {
            box-shadow: 0 0 20px rgba(249, 207, 95, 0.8), 0 0 40px rgba(249, 207, 95, 0.4);
          }
        }
      `}</style>
      <div className="h-screen flex flex-col w-full overflow-hidden relative bg-surface-paper">
        {/* Scholarly header with warm library aesthetic */}
        <div className="relative">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-library-cream-50 via-surface-parchment to-library-cream-50"></div>
          
          {/* Content */}
          <div className={onboarding.getHeaderClassName('relative flex items-center gap-4 px-6 py-4 border-b border-library-sage-200 backdrop-blur-sm')}>
            <button
              onClick={() => router.push('/home')}
              className="group flex items-center gap-2 px-3 py-2 text-reading-secondary hover:text-reading-primary hover:bg-library-cream-100 rounded-book transition-all duration-300 shadow-paper hover:shadow-book"
              title="Return to Library"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-serif font-medium">Library</span>
            </button>
            
            {/* Elegant divider */}
            <div className="w-px h-5 bg-gradient-to-b from-transparent via-library-sage-300 to-transparent opacity-60"></div>
            
            {/* Document title with view mode dropdown */}
            <div className="flex-1 min-w-0 flex items-center gap-6">
              <div className="min-w-0">
                <h1 className="font-serif text-lg font-semibold text-reading-primary truncate tracking-wide">
                  {documentState.title || (
                    <span className="animate-pulse text-reading-muted">Loading manuscript...</span>
                  )}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-library-gold-400 opacity-60"></div>
                  <span className="text-xs font-sans text-reading-muted uppercase tracking-wider">
                    Research Document
                  </span>
                </div>
              </div>
              
              {/* View Mode Dropdown - mahogany styled, positioned to the right of title */}
              <div className="flex-shrink-0 relative">
                {/* Add glowing rings animation for step 9 - pointer-events-none so they don't block clicks */}
                {onboarding.onboardingState.isActive && onboarding.onboardingState.currentStep === 9 && (
                  <div className="pointer-events-none">
                    <div className="absolute inset-0 bg-library-gold-400 rounded-book animate-ping opacity-60" />
                    <div className="absolute inset-0 bg-library-gold-400 rounded-book animate-ping opacity-40" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute inset-0 bg-library-gold-300 rounded-book animate-ping opacity-20" style={{ animationDelay: '1s' }} />
                  </div>
                )}
                <button 
                  onClick={(e) => onboarding.handleViewDropdownToggle(e, handleViewDropdownToggle)}
                  className={onboarding.getViewDropdownClassName('w-32 h-12 flex items-center justify-center rounded-book border shadow-book hover:shadow-shelf transition-all font-serif font-medium')}
                  style={{ 
                    fontSize: '16px',
                    gap: '8px',
                    ...onboarding.getViewDropdownStyle()
                  }}
                  data-view-mode-dropdown
                >
                  <span>{viewMode === 'pdf' ? 'PDF View' : viewMode === 'glossary' ? 'Glossary' : 'Annotations'}</span>
                  <svg className={`w-4 h-4 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
            <MainConversationButton
              isActive={activeConversationId === null}
              onConversationChange={setActiveConversationId}
            />
          </div>
        </div>

        {/* Main content area with library atmosphere */}
        <div className="flex-1 flex w-full overflow-hidden relative bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
          {/* Elegant Block Selection Mode Banner */}
          {isBlockSelectionMode && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
              <div className="bg-gradient-to-r from-library-mahogany-500 to-library-mahogany-600 text-library-cream-50 px-8 py-4 rounded-journal shadow-deep border border-library-mahogany-400 backdrop-blur-paper">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-library-gold-300 rounded-full animate-pulse shadow-sm"></div>
                    <span className="font-serif font-medium text-base tracking-wide">{blockSelectionPrompt}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setIsBlockSelectionMode(false);
                      setOnBlockSelectionComplete(null);
                    }}
                    className="ml-4 text-library-cream-200 hover:text-library-cream-50 bg-library-mahogany-600/50 hover:bg-library-mahogany-600/80 rounded-full p-2 transition-all duration-200 shadow-paper hover:shadow-book"
                    title="Cancel selection"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Decorative flourish */}
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                  <div className="w-4 h-1 bg-library-gold-400 rounded-full opacity-60"></div>
                </div>
              </div>
            </div>
          )}
        {/* Custom Floating Toolbar Pill - positioned for PDF panel */}
        <div className={onboarding.getToolbarClassName()}>
          <PDFToolbar
            onGoToPreviousPage={goToPreviousPage}
            onGoToNextPage={goToNextPage}
            onZoomOut={zoomOut}
            onZoomIn={zoomIn}
            currentPage={currentPage}
            totalPages={totalPages}
            currentPanelSizes={currentPanelSizes}
            onSearch={handleSearch}
            onResumeReading={handleResumeReading}
            hasReadingProgress={!!scrollToFurthestBlock()}
          />
        </div>

        <PanelGroup 
          direction="horizontal" 
          onLayout={(sizes) => {
            saveMainPanelSizes(sizes);
            setCurrentPanelSizes(sizes);
          }}
          className="w-full"
        >
          {/* Content viewer - left panel (PDF or Glossary) */}
          <Panel 
            ref={pdfPanelRef}
            defaultSize={mainPanelSizes[0]} 
            minSize={20}
            maxSize={100}
            className="relative overflow-hidden"
          >
            {/* Manuscript-like background */}
            <div className="absolute inset-0 bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
              {/* Subtle paper texture overlay */}
              <div className="absolute inset-0 opacity-[0.02] bg-repeat" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Ccircle cx='3' cy='3' r='0.5'/%3E%3Ccircle cx='13' cy='13' r='0.5'/%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '20px 20px'
              }}></div>
            </div>
            
            {/* Conditional content based on view mode */}
            {viewMode === 'pdf' ? (
              /* PDF content with enhanced shadow */
              <div className="relative h-full shadow-inner"
                   style={{ boxShadow: 'inset 0 0 20px rgba(175, 95, 55, 0.03)' }}>
              <VirtualizedPDFViewer
                pdfFile={pdfFile}
                blocks={blocks}
                scale={scale}
                // New props for page-level rendering
                blocksByPage={blocksByPage}
                selectedBlock={blockOverlayManager.selectedBlock}
                isBlockSelectionMode={isBlockSelectionMode}
                temporarilyHighlightedBlockId={temporarilyHighlightedBlockId}
                onBlockClick={(block: Block) => {
                  if (onboarding.shouldProcessBlockForOnboarding(block)) {
                    onboarding.handleOnboardingBlockClick(block);
                  } else {
                    blockOverlayManager.handleBlockClick(block);
                  }
                }}
                onBlockSelect={blockOverlayManager.handleBlockSelect}
                onboardingTargetBlockId={onboarding.onboardingTargetBlockId}
                isOnboardingActive={onboarding.onboardingState.isActive}
                // Existing props
                onPageChange={handlePageChange}
                onDocumentLoadSuccess={handleDocumentLoad}
                scrollToPageRef={scrollToPageRef}
                forceRefreshKey={forceRefreshKey}
                pdfLoadingState={pdfLoadingState}
                onForceRefresh={handleForceRefresh}
                renderLoader={renderLoader}
              />

            {/* Block Overlay */}
            {blockOverlayManager.blockOverlayComponent}
            </div>
            ) : viewMode === 'glossary' ? (
              /* Glossary view */
              <div className="relative h-full">
                <GlossaryView
                  blocks={blocks}
                  onTermClick={(blockId, startOffset, endOffset) => {
                    // Switch back to PDF view and navigate to the block
                    setViewMode('pdf');
                    // Find the block and navigate to it
                    const targetBlock = blocks.find(b => b.id === blockId);
                    if (targetBlock) {
                      // Open the block overlay - we'll use a generic note ID since we're just navigating
                      blockOverlayManager.handleOpenBlockWithNote(blockId, `definition-${startOffset}-${endOffset}`);
                    }
                  }}
                />
              </div>
            ) : (
              /* Annotations view */
              <div className="relative h-full">
                <AnnotationsView
                  blocks={blocks}
                  onAnnotationClick={(blockId, startOffset, endOffset) => {
                    // Switch back to PDF view and navigate to the block
                    setViewMode('pdf');
                    // Find the block and navigate to it
                    const targetBlock = blocks.find(b => b.id === blockId);
                    if (targetBlock) {
                      // Open the block overlay - we'll use a generic note ID since we're just navigating
                      blockOverlayManager.handleOpenBlockWithNote(blockId, `annotation-${startOffset}-${endOffset}`);
                    }
                  }}
                />
              </div>
            )}
          </Panel>
          
          {/* Elegant resize handle between PDF and chat */}
          <PanelResizeHandle className="w-1 bg-gradient-to-b from-library-sage-100 via-library-sage-200 to-library-sage-100 hover:bg-gradient-to-b hover:from-library-gold-200 hover:via-library-gold-300 hover:to-library-gold-200 transition-all duration-300 cursor-col-resize group relative">
            {/* Subtle grip indicator */}
            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-0.5 bg-library-sage-300 group-hover:bg-library-gold-400 opacity-50 group-hover:opacity-80 transition-all duration-300"></div>
            {/* Collapse/Expand toggle on the divider - always visible */}
            <button
              onClick={isChatCollapsed ? expandChat : collapseChat}
              className="absolute top-1/2 -translate-y-1/2 px-1.5 py-1 text-[10px] font-sans rounded-full border border-library-sage-300 bg-white/90 hover:bg-white shadow-paper"
              title={isChatCollapsed ? 'Show Main Conversation' : 'Hide Main Conversation'}
              style={{
                // When collapsed, anchor into the PDF side; when expanded, anchor into the chat side
                left: isChatCollapsed ? '-0.75rem' as any : undefined,
                right: isChatCollapsed ? undefined : '-0.75rem' as any,
              }}
            >
              {isChatCollapsed ? '⟨⟨' : '⟩⟩'}
            </button>
          </PanelResizeHandle>
          
          {/* Chat panel - scholarly discussion area */}
          <Panel 
            ref={chatPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize={mainPanelSizes[1]} 
            minSize={0}
            maxSize={80}
            className="relative overflow-hidden"
          >
            {/* Study room atmosphere background */}
            <div className="absolute inset-0 bg-gradient-to-b from-library-cream-50 via-surface-parchment to-library-cream-100">
              {/* Subtle vertical lines suggesting notebook paper */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `linear-gradient(to right, transparent 0px, transparent 24px, #af5f37 24px, #af5f37 25px, transparent 25px)`,
                backgroundSize: '25px 100%'
              }}></div>
            </div>
            
            {/* Content with enhanced border */}
            <div className={onboarding.getChatClassName('relative h-full border-l border-library-sage-300 shadow-inner bg-gradient-to-r from-library-cream-50/30 to-transparent')}>
              {/* Chat content only when expanded */}
              {!isChatCollapsed && (
                <ChatSidebar
                  documentId={documentId}
                  selectedBlock={blockOverlayManager.selectedBlock}
                  mainConversationId={documentState.data?.main_conversation_id}
                  activeConversationId={activeConversationId}
                  rabbitholeConversations={rabbitholeConversations}
                  rabbitholeData={rabbitholeData}
                  pendingChatText={pendingChatText}
                  onSetActiveConversationId={setActiveConversationId}
                  onSetRabbitholeConversations={setRabbitholeConversations}
                  onTextAdded={handleTextAdded}
                  onBlockSelectionRequest={handleBlockSelectionRequest}
                  onUpdateBlockMetadata={updateBlockMetadata}
                  onFetchBlocks={fetchBlocks}
                  onOpenBlockWithNote={blockOverlayManager.handleOpenBlockWithNote}
                  getBlockMetadata={(blockId: string) => {
                    const block = blocks.find(b => b.id === blockId);
                    return block?.metadata || {};
                  }}
                  currentPage={currentPage}
                  blocks={blocks}
                />
              )}
            </div>
          </Panel>
        </PanelGroup>
        {/* Header contains the chat toggle button, so no extra overlay needed */}
        </div>
      </div>

      {/* All onboarding overlays and view mode selector */}
      <OnboardingOverlays
        onboarding={{
          ...onboarding,
          viewDropdownPosition: viewDropdownPosition
        }}
        viewMode={viewMode}
        isViewDropdownOpen={isViewDropdownOpen}
        closeViewDropdown={closeViewDropdown}
        handleViewModeSelect={handleViewModeSelect}
        blocks={blocks}
        scale={scale}
      />
      
      {/* Approval modal removed */}
      
      
    </>
  );
}

// Wrapper component that provides the context
export default function PDFViewer(props: PDFViewerProps) {
  return (
    <PDFViewerInner {...props} />
  );
}
