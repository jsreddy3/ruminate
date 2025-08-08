"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
// import MathJaxProvider from "../common/MathJaxProvider";
import { documentApi } from "../../services/api/document";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import PDFBlockOverlay from "./PDFBlockOverlay";
import PDFToolbar from "./PDFToolbar";
import ChatSidebar from "./ChatSidebar";
import { useBlockOverlayManager } from "./BlockOverlayManager";
import VirtualizedPDFViewer from "./VirtualizedPDFViewer";
import MainConversationButton from "../chat/MainConversationButton";
import { useReadingProgress } from "../../hooks/useReadingProgress";
import { useViewportReadingTracker } from "../../hooks/useViewportReadingTracker";
import GlossaryView from "../interactive/blocks/GlossaryView";
import AnnotationsView from "../interactive/blocks/AnnotationsView";
import { useViewMode } from "./hooks/useViewMode";
import { useBlockManagement } from "./hooks/useBlockManagement";
import { useConversations } from "./hooks/useConversations";
import { useOnboarding } from "./hooks/useOnboarding";
import { useVirtualizedPDF } from "./hooks/useVirtualizedPDF";
import { pdfViewerGlobalStyles } from "./PDFViewerStyles";
import { OnboardingOverlays } from "./components/OnboardingOverlays";
import { usePanelStorage } from "../../hooks/usePanelStorage";
import { Block } from "./PDFViewer";

interface PDFViewerVirtualizedProps {
  initialPdfFile: string;
  initialDocumentId: string;
}

export default function PDFViewerVirtualized({ 
  initialPdfFile, 
  initialDocumentId 
}: PDFViewerVirtualizedProps) {
  const router = useRouter();

  const [pdfFile] = useState<string>(initialPdfFile);
  const [documentId] = useState<string>(initialDocumentId);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [documentData, setDocumentData] = useState<any>(null);
  
  // Use the virtualized PDF hook instead of usePDFDocument
  const {
    pdfLoadingState,
    currentPage,
    totalPages,
    scale,
    handleDocumentLoad,
    handlePageChange,
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    scrollToPageRef,
  } = useVirtualizedPDF({ pdfFile, documentId });

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
    mainConversationId: documentData?.main_conversation_id,
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
        setDocumentData(docData);
        setDocumentTitle(docData.title);
        
        // Initialize reading progress from document data
        if (initializeProgress) {
          initializeProgress(docData);
        }
      } catch (error) {
        console.error('Error fetching document title:', error);
        setDocumentTitle('Unknown Document');
      }
    };

    if (documentId) {
      fetchDocumentTitle();
    }
  }, [documentId, initializeProgress]);

  // Use our custom hook for the main panel layout (PDF vs chat)
  const [mainPanelSizes, saveMainPanelSizes] = usePanelStorage('main', [40, 60]);
  
  // Track current panel sizes for overlay
  const [currentPanelSizes, setCurrentPanelSizes] = useState(mainPanelSizes);

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

  // Scroll to specific block using virtualized viewer
  const scrollToBlock = useCallback(async (block: Block) => {
    if (!block.polygon || typeof block.page_number !== 'number') return;
    
    try {
      // Use the virtualized scroll function
      goToPage(block.page_number + 1); // Convert 0-indexed to 1-indexed
    } catch (error) {
      console.error('Failed to scroll to block:', error);
    }
  }, [goToPage]);

  // Use the onboarding hook
  const onboarding = useOnboarding({
    blocks,
    flattenedBlocks,
    onBlockClick: (block) => blockOverlayManager?.handleBlockClick(block),
    viewMode,
    closeViewDropdown,
  });

  // Effect to handle onboarding step 3 - scroll to target block
  useEffect(() => {
    if (onboarding.onboardingState.isActive && 
        onboarding.onboardingState.currentStep === 3 && 
        onboarding.onboardingTargetBlockId && 
        flattenedBlocks.length > 0) {
      const targetBlock = flattenedBlocks.find(b => b.id === onboarding.onboardingTargetBlockId);
      if (targetBlock) {
        setTimeout(() => {
          scrollToBlock(targetBlock);
        }, 1000);
      }
    }
  }, [onboarding.onboardingState.isActive, onboarding.onboardingState.currentStep, 
      onboarding.onboardingTargetBlockId, flattenedBlocks, scrollToBlock]);

  // Block Overlay Manager - handles block selection and interactions
  const blockOverlayManager = useBlockOverlayManager({
    blocks,
    flattenedBlocks,
    documentId,
    currentPanelSizes,
    mainConversationId: documentData?.main_conversation_id,
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

  // PDF overlay renderer for virtualized viewer
  const renderOverlay = useCallback(
    (props: { pageIndex: number; scale: number; rotation: number }) => {
      return (
        <PDFBlockOverlay
          blocks={blocks}
          selectedBlock={blockOverlayManager.selectedBlock}
          pageIndex={props.pageIndex}
          scale={props.scale}
          onBlockClick={(block: Block) => {
            if (onboarding.shouldProcessBlockForOnboarding(block)) {
              onboarding.handleOnboardingBlockClick(block);
            } else {
              blockOverlayManager.handleBlockClick(block);
            }
          }}
          isSelectionMode={isBlockSelectionMode}
          onBlockSelect={blockOverlayManager.handleBlockSelect}
          temporarilyHighlightedBlockId={temporarilyHighlightedBlockId}
          {...onboarding.getPDFBlockOverlayProps()}
        />
      );
    },
    [blocks, blockOverlayManager.selectedBlock, blockOverlayManager.handleBlockClick, 
     isBlockSelectionMode, blockOverlayManager.handleBlockSelect, 
     temporarilyHighlightedBlockId, onboarding]
  );

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
    }
  }, [flattenedBlocks, blockOverlayManager, scrollToBlock]);

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
        
        /* Additional styles for virtualized viewer */
        .pdf-virtual-list {
          scrollbar-width: thin;
          scrollbar-color: rgba(175, 95, 55, 0.3) transparent;
        }
        
        .pdf-virtual-list::-webkit-scrollbar {
          width: 8px;
        }
        
        .pdf-virtual-list::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .pdf-virtual-list::-webkit-scrollbar-thumb {
          background-color: rgba(175, 95, 55, 0.3);
          border-radius: 4px;
        }
        
        .pdf-virtual-list::-webkit-scrollbar-thumb:hover {
          background-color: rgba(175, 95, 55, 0.5);
        }
        
        .pdf-page-container {
          padding: 16px 0;
        }
      `}</style>
      
      <div className="h-screen flex flex-col w-full overflow-hidden relative bg-surface-paper">
        {/* Header - same as original */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-library-cream-50 via-surface-parchment to-library-cream-50"></div>
          
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
            
            <div className="w-px h-5 bg-gradient-to-b from-transparent via-library-sage-300 to-transparent opacity-60"></div>
            
            <div className="flex-1 min-w-0 flex items-center gap-6">
              <div className="min-w-0">
                <h1 className="font-serif text-lg font-semibold text-reading-primary truncate tracking-wide">
                  {documentTitle || (
                    <span className="animate-pulse text-reading-muted">Loading manuscript...</span>
                  )}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-library-gold-400 opacity-60"></div>
                  <span className="text-xs font-sans text-reading-muted uppercase tracking-wider">
                    Research Document (Virtualized)
                  </span>
                </div>
              </div>
              
              <div className="flex-shrink-0 relative">
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

            <div className="flex-shrink-0">
              <MainConversationButton
                isActive={activeConversationId === null}
                onConversationChange={setActiveConversationId}
              />
            </div>

          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex w-full overflow-hidden relative bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
          {/* Block Selection Mode Banner */}
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
                
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                  <div className="w-4 h-1 bg-library-gold-400 rounded-full opacity-60"></div>
                </div>
              </div>
            </div>
          )}

          {/* Floating Toolbar */}
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
            {/* Content viewer - left panel */}
            <Panel 
              defaultSize={mainPanelSizes[0]} 
              minSize={20}
              maxSize={85}
              className="relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
                <div className="absolute inset-0 opacity-[0.02] bg-repeat" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Ccircle cx='3' cy='3' r='0.5'/%3E%3Ccircle cx='13' cy='13' r='0.5'/%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundSize: '20px 20px'
                }}></div>
              </div>
              
              {/* Conditional content based on view mode */}
              {viewMode === 'pdf' ? (
                <div className="relative h-full shadow-inner"
                     style={{ boxShadow: 'inset 0 0 20px rgba(175, 95, 55, 0.03)' }}>
                  {/* Use the virtualized PDF viewer */}
                  <VirtualizedPDFViewer
                    pdfFile={pdfFile}
                    blocks={blocks}
                    scale={scale}
                    renderOverlay={renderOverlay}
                    onPageChange={handlePageChange}
                    onDocumentLoadSuccess={handleDocumentLoad}
                    scrollToPageRef={scrollToPageRef}
                  />

                  {/* Block Overlay */}
                  {blockOverlayManager.blockOverlayComponent}
                </div>
              ) : viewMode === 'glossary' ? (
                <div className="relative h-full">
                  <GlossaryView
                    blocks={blocks}
                    onTermClick={(blockId, startOffset, endOffset) => {
                      setViewMode('pdf');
                      const targetBlock = blocks.find(b => b.id === blockId);
                      if (targetBlock) {
                        blockOverlayManager.handleOpenBlockWithNote(blockId, `definition-${startOffset}-${endOffset}`);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="relative h-full">
                  <AnnotationsView
                    blocks={blocks}
                    onAnnotationClick={(blockId, startOffset, endOffset) => {
                      setViewMode('pdf');
                      const targetBlock = blocks.find(b => b.id === blockId);
                      if (targetBlock) {
                        blockOverlayManager.handleOpenBlockWithNote(blockId, `annotation-${startOffset}-${endOffset}`);
                      }
                    }}
                  />
                </div>
              )}
            </Panel>
            
            <PanelResizeHandle className="w-1 bg-gradient-to-b from-library-sage-100 via-library-sage-200 to-library-sage-100 hover:bg-gradient-to-b hover:from-library-gold-200 hover:via-library-gold-300 hover:to-library-gold-200 transition-all duration-300 cursor-col-resize group relative">
              <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-0.5 bg-library-sage-300 group-hover:bg-library-gold-400 opacity-50 group-hover:opacity-80 transition-all duration-300"></div>
            </PanelResizeHandle>
            
            {/* Chat panel */}
            <Panel 
              defaultSize={mainPanelSizes[1]} 
              minSize={15}
              maxSize={80}
              className="relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-library-cream-50 via-surface-parchment to-library-cream-100">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `linear-gradient(to right, transparent 0px, transparent 24px, #af5f37 24px, #af5f37 25px, transparent 25px)`,
                  backgroundSize: '25px 100%'
                }}></div>
              </div>
              
              <div className={onboarding.getChatClassName('relative h-full border-l border-library-sage-300 shadow-inner bg-gradient-to-r from-library-cream-50/30 to-transparent')}>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-library-mahogany-400 via-library-mahogany-500 to-library-mahogany-600 shadow-sm"></div>
                <ChatSidebar
                  documentId={documentId}
                  selectedBlock={blockOverlayManager.selectedBlock}
                  mainConversationId={documentData?.main_conversation_id}
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
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {/* Onboarding overlays */}
      <OnboardingOverlays
        onboarding={{
          ...onboarding,
          viewDropdownPosition: viewDropdownPosition
        }}
        viewMode={viewMode}
        isViewDropdownOpen={isViewDropdownOpen}
        closeViewDropdown={closeViewDropdown}
        handleViewModeSelect={handleViewModeSelect}
      />
    </>
  );
}