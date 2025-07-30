"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Worker, Viewer, SpecialZoomLevel, ScrollMode } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import MathJaxProvider from "../common/MathJaxProvider";
import ChatContainer from "../chat/ChatContainer";
import { conversationApi } from "../../services/api/conversation";
import { documentApi } from "../../services/api/document";
import { authenticatedFetch, API_BASE_URL } from "../../utils/api";
import { createRabbithole } from "../../services/rabbithole";
import BlockContainer from "../interactive/blocks/BlockContainer";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import BlockNavigator from "../interactive/blocks/BlockNavigator";
import BlockOverlay from "./BlockOverlay";
import PDFBlockOverlay from "./PDFBlockOverlay";
import PDFToolbar from "./PDFToolbar";
import ChatSidebar from "./ChatSidebar";
import { useBlockOverlayManager } from "./BlockOverlayManager";
import PDFDocumentViewer from "./PDFDocumentViewer";
import { ResizeHandle, HorizontalResizeHandle } from "../common/ResizeHandles";

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

// A map to track conversation initialization promises by document ID
const ConversationInitPromises: Record<string, Promise<string>> = {};

// Cache stored conversation IDs
interface DocumentConversations {
  mainConversationId?: string;
  blockConversations: Record<string, string>;
}

// Storage helpers
function storeConversationId(documentId: string, conversationId: string): void {
  try {
    const storageKey = `document_${documentId}_conversations`;
    const existing = localStorage.getItem(storageKey);
    const data: DocumentConversations = existing ? JSON.parse(existing) : { blockConversations: {} };
    
    data.mainConversationId = conversationId;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error("Error storing conversation ID:", error);
  }
}

function getStoredConversationId(documentId: string): string | undefined {
  try {
    const storageKey = `document_${documentId}_conversations`;
    const existing = localStorage.getItem(storageKey);
    if (existing) {
      const data = JSON.parse(existing) as DocumentConversations;
      return data.mainConversationId;
    }
  } catch (error) {
    console.error("Error retrieving conversation ID:", error);
  }
  return undefined;
}

interface PDFViewerProps {
  initialPdfFile: string;
  initialDocumentId: string;
}

// Resize handle components now imported from common components

// Custom hook for persisting panel layouts
const usePanelStorage = (id: string, defaultSizes: number[]) => {
  const storageKey = `panel-layout-${id}`;
  
  // Get initial sizes from localStorage or use defaults
  const loadSizes = useCallback(() => {
    try {
      const savedSizes = localStorage.getItem(storageKey);
      if (!savedSizes) return defaultSizes;
      
      const parsed = JSON.parse(savedSizes);
      // Validate that we have a proper array with numbers
      if (!Array.isArray(parsed) || parsed.some(size => typeof size !== 'number')) {
        console.warn(`Invalid panel sizes in localStorage: ${savedSizes}, using defaults`);
        return defaultSizes;
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to load panel sizes:', error);
      return defaultSizes;
    }
  }, [storageKey, defaultSizes]);

  const [sizes, setSizes] = useState(loadSizes);
  
  // Save sizes with debouncing for better performance
  const saveSizes = useCallback((newSizes: number[]) => {
    if (!Array.isArray(newSizes) || newSizes.some(size => typeof size !== 'number')) {
      console.warn(`Attempting to save invalid panel sizes: ${JSON.stringify(newSizes)}`);
      return;
    }
    
    setSizes(newSizes);
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(newSizes));
    } catch (error) {
      console.error('Failed to save panel sizes:', error);
    }
  }, [storageKey]);

  return [sizes, saveSizes] as const; // Use const assertion for better typing
};

export default function PDFViewer({ initialPdfFile, initialDocumentId }: PDFViewerProps) {
  const router = useRouter();
  const [pdfFile] = useState<string>(initialPdfFile);
  const [documentId] = useState<string>(initialDocumentId);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  
  // Add states for PDF loading management
  const [pdfLoadingState, setPdfLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error' | 'stuck'>('idle');
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  
  // Debug PDF URL
  useEffect(() => {
    console.log('🔍 PDF Viewer initializing with:', {
      pdfType: pdfFile.startsWith('data:application/pdf;base64,') ? 'base64' : 'url',
      pdfSize: pdfFile.startsWith('data:application/pdf;base64,') 
        ? `${((pdfFile.length * 0.75) / (1024 * 1024)).toFixed(1)}MB`
        : `${pdfFile.length} chars`,
      documentId
    });
    
    if (pdfFile.startsWith('data:application/pdf;base64,')) {
      const base64Length = pdfFile.length;
      const estimatedSizeMB = (base64Length * 0.75) / (1024 * 1024); // rough estimate
      
      if (base64Length > 10000000) { // ~7.5MB
        console.warn('⚠️ Very large base64 PDF - this might cause loading issues');
      }
    } else {
      if (pdfFile.startsWith('file://')) {
        console.error('❌ Invalid PDF URL: file:// URLs cannot be loaded in browsers');
      }
    }
  }, [pdfFile, documentId]);

  // Fetch document title
  useEffect(() => {
    const fetchDocumentTitle = async () => {
      try {
        const document = await documentApi.getDocument(documentId);
        setDocumentTitle(document.title);
      } catch (error) {
        console.error('Error fetching document title:', error);
        setDocumentTitle('Unknown Document');
      }
    };

    if (documentId) {
      fetchDocumentTitle();
    }
  }, [documentId]);

  const [blocks, setBlocks] = useState<Block[]>([]);
  // Block overlay state now managed by useBlockOverlayManager hook
  
  // Add state for conversation management
  const [mainConversationId, setMainConversationId] = useState<string | null>(null);
  
  // Add state for all document conversations and rabbithole data
  const [documentConversations, setDocumentConversations] = useState<any[]>([]);
  const [rabbitholeData, setRabbitholeData] = useState<any[]>([]);
  
  // Block selection mode state
  const [isBlockSelectionMode, setIsBlockSelectionMode] = useState(false);
  const [blockSelectionPrompt, setBlockSelectionPrompt] = useState<string>("Select a block");
  const [onBlockSelectionComplete, setOnBlockSelectionComplete] = useState<((blockId: string) => void) | null>(null);
  
  // Update the state management to handle multiple conversations
  // Add state for tracking rabbithole conversations
  const [rabbitholeConversations, setRabbitholeConversations] = useState<{
    id: string;
    title: string;
    selectionText: string;
    blockId: string;
  }[]>([]);

  // Add state for tracking the active conversation tab
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  // Add state for page tracking
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  
  
  // Add state for pending text to be added to chat
  const [pendingChatText, setPendingChatText] = useState<string>('');
  
  // Add ref to store the rabbithole refresh function
  const refreshRabbitholesFnRef = useRef<(() => void) | null>(null);
  
  // Add a ref to track the last fetch time to prevent multiple refreshes
  const lastFetchTimeRef = useRef<number>(0);
  
  // Fetch blocks function that can be reused
  const fetchBlocks = useCallback(async () => {
    if (!documentId) return;
    
    // Prevent multiple fetches within 2 seconds
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    try {
      const blocksResp = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/blocks`);
      const blocksData = await blocksResp.json();
      
      if (Array.isArray(blocksData)) {
        setBlocks(blocksData);
        
        // Block selection state is now managed by useBlockOverlayManager hook
      }
    } catch (error) {
      console.error("Error fetching document data:", error);
    } finally {
    }
  }, [documentId]); // Remove selectedBlock from the dependencies
  
  // Function to convert rabbithole conversations to highlights grouped by block
  const getRabbitholeHighlightsForBlock = useCallback((blockId: string) => {
    return rabbitholeData
      .filter(conv => conv.source_block_id === blockId)
      .map(conv => ({
        id: conv.id,
        selected_text: conv.selected_text || '',
        text_start_offset: conv.text_start_offset || 0,
        text_end_offset: conv.text_end_offset || 0,
        created_at: conv.created_at,
        conversation_id: conv.id
      }));
  }, [rabbitholeData]);

  // Function to optimistically add a new rabbithole conversation
  const addRabbitholeConversation = useCallback((blockId: string, conversationId: string, selectedText: string, startOffset: number, endOffset: number) => {
    const newConversation = {
      id: conversationId,
      type: 'RABBITHOLE',
      source_block_id: blockId,
      selected_text: selectedText,
      text_start_offset: startOffset,
      text_end_offset: endOffset,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setRabbitholeData(prevConversations => [...prevConversations, newConversation]);
  }, []);

  // Function to update a specific block's metadata optimistically
  const updateBlockMetadata = useCallback((blockId: string, newMetadata: any) => {
    setBlocks(prevBlocks => 
      prevBlocks.map(block => 
        block.id === blockId 
          ? { ...block, metadata: { ...block.metadata, ...newMetadata } }
          : block
      )
    );
    
    // Selected block metadata updates now handled by useBlockOverlayManager hook
  }, []);
  
  // Fetch rabbithole data for the document
  useEffect(() => {
    if (!documentId) return;
    
    const fetchRabbitholeData = async () => {
      try {
        const rabbitholeResponse = await authenticatedFetch(`${API_BASE_URL}/conversations?document_id=${documentId}&type=RABBITHOLE`);
        if (rabbitholeResponse.ok) {
          const rabbitholeConvos = await rabbitholeResponse.json();
          setRabbitholeData(rabbitholeConvos || []);
        }
      } catch (error) {
        console.error('Error fetching rabbithole data:', error);
      }
    };
    
    fetchRabbitholeData();
  }, [documentId]);

  // Initialize the main document conversation
  useEffect(() => {
    if (!documentId) return;
    
    // Check if we have a stored conversation ID
    const storedId = getStoredConversationId(documentId);
    if (storedId) {
      setMainConversationId(storedId);
      return;
    }
    
    // Otherwise, initialize conversation
    if (!ConversationInitPromises[documentId]) {
      ConversationInitPromises[documentId] = (async () => {
        try {
          // Try fetching existing conversations for the document
          const existingConvos = await conversationApi.getDocumentConversations(documentId);
          
          // Store conversations in state
          setDocumentConversations(existingConvos || []);

          // Use the first one found, or create if none exist
          if (existingConvos && existingConvos.length > 0) {
            const id = existingConvos[0].id;
            setMainConversationId(id);
            storeConversationId(documentId, id);
            return id;
          } else {
            // Create a document-level conversation
            const newConv = await conversationApi.create(documentId);
            const id = newConv.conversation_id;
            setMainConversationId(id);
            storeConversationId(documentId, id);
            return id;
          }
        } catch (error) {
          console.error("Error initializing document conversation:", error);
          throw error; // Re-throw to properly handle promise rejection
        } finally {
          // Clean up the promise when done
          delete ConversationInitPromises[documentId];
        }
      })();
    }
    
    // Attach to the existing promise if one exists
    ConversationInitPromises[documentId]
      .then(id => {
        if (!mainConversationId) {
          setMainConversationId(id);
        }
      })
      .catch(error => {
        console.error("Failed to initialize conversation:", error);
      });
  }, [documentId, mainConversationId]);
  
  // State to track all blocks in flattened form for navigation
  const [flattenedBlocks, setFlattenedBlocks] = useState<Block[]>([]);

  // Flatten blocks for easy navigation
  useEffect(() => {
    if (blocks.length > 0) {
      // Define chat-enabled block types for filtering
      const chatEnabledBlockTypes = [
        "text",
        "sectionheader",
        "pageheader",
        "pagefooter",
        "listitem",
        "footnote",
        "reference",
        "picture",
        "figure",
        "image",
        "textinlinemath",
        "equation",
        "table"
      ].map(type => type.toLowerCase());

      // Simply filter the blocks we want to show without reordering
      const filteredBlocks = blocks.filter(block => 
        // Block must have a valid type
        block.block_type && 
        // Not be a page block
        block.block_type.toLowerCase() !== "page" &&
        // Be in our list of chat-enabled types
        chatEnabledBlockTypes.includes(block.block_type.toLowerCase()) &&
        // Must have content (HTML or images)
        (
          block.html_content ||
          (block.images && Object.keys(block.images).length > 0) ||
          ['picture', 'figure', 'image'].includes(block.block_type.toLowerCase())
        )
      );
      
      // Use the blocks as they come from the API (already ordered correctly)
      setFlattenedBlocks(filteredBlocks);
    }
  }, [blocks]);

  // Fetch blocks when component mounts
  useEffect(() => {
    if (documentId) {
      fetchBlocks();
    }
  }, [documentId, fetchBlocks]);

  // Create plugin instances
  const zoomPluginInstance = zoomPlugin();
  const { ZoomIn, ZoomOut } = zoomPluginInstance;

  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { GoToNextPage, GoToPreviousPage } = pageNavigationPluginInstance;

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    toolbarPlugin: {
      fullScreenPlugin: {
        onEnterFullScreen: () => { },
        onExitFullScreen: () => { },
      },
      searchPlugin: {
        keyword: [''],
      },
    },
    renderToolbar: () => <></>, // Hide the default toolbar
    sidebarTabs: () => [],
  });

  // Page layout customization now handled by PDFDocumentViewer

  // Example flattening function
  const parseBlock = (block: Block, nextPageIndex: number, all: Block[]): number => {
    if (block.block_type === "Page") {
      if (typeof block.page_number === "number") {
        block.pageIndex = block.page_number - 1;
        if (block.pageIndex >= nextPageIndex) {
          nextPageIndex = block.pageIndex + 1;
        }
      } else {
        block.pageIndex = nextPageIndex;
        nextPageIndex++;
      }
    } else {
      if (typeof block.pageIndex !== "number") {
        block.pageIndex = 0;
      }
    }
    all.push(block);
    if (block.children) {
      for (const child of block.children) {
        child.pageIndex = block.pageIndex;
        nextPageIndex = parseBlock(child, nextPageIndex, all);
      }
    }
    return nextPageIndex;
  };

  // Block interaction handlers now managed by useBlockOverlayManager hook
  
  // Handle creation of rabbithole conversations
  const handleRabbitholeCreated = useCallback((
    conversationId: string, 
    selectedText: string,
    blockId: string
  ) => {
    
    // Validate inputs to ensure we never try to add undefined/null values
    if (!conversationId) {
      console.error("Cannot create rabbithole conversation without a conversation ID");
      return;
    }

    // Create a title from the selected text (truncated if needed)
    const title = selectedText && selectedText.length > 30 
      ? `${selectedText.substring(0, 30)}...` 
      : selectedText || "New Rabbithole Chat";
    
    // Check if we already have this conversation to prevent duplicates
    const existingConversation = rabbitholeConversations.find(c => c.id === conversationId);
    if (existingConversation) {
      // If it already exists, just activate it
      setActiveConversationId(conversationId);
      return;
    }
    
    // Add this conversation to our list
    setRabbitholeConversations(prev => {
      const newState = [
        ...prev, 
        {
          id: conversationId,
          title,
          selectionText: selectedText || "",
          blockId
        }
      ];
      return newState;
    });
    
    // Set this as the active conversation
    setActiveConversationId(conversationId);
  }, [rabbitholeConversations]);

  // renderOverlay moved to after blockOverlayManager hook

  // Use our custom hook for the main panel layout (PDF vs chat)
  const [mainPanelSizes, saveMainPanelSizes] = usePanelStorage('main', [70, 30]);
  
  // Track current panel sizes for overlay
  const [currentPanelSizes, setCurrentPanelSizes] = useState(mainPanelSizes);
  
  // Ensure panel sizes are applied correctly
  useEffect(() => {
    // Allow layout to fully settle after mounting
    const timer = setTimeout(() => {
      // Force a resize event to ensure PDF viewer recalculates layouts
      window.dispatchEvent(new Event('resize'));
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  useEffect(() => {
  }, [rabbitholeConversations]);

  useEffect(() => {
  }, [activeConversationId]);

  useEffect(() => {
  }, [blocks]);

  // Add handlers for pending text management
  const handleAddTextToChat = useCallback((text: string) => {
    setPendingChatText(text);
  }, []);

  const handleTextAdded = useCallback(() => {
    setPendingChatText('');
  }, []);

  // Handle block selection requests from chat
  const handleBlockSelectionRequest = useCallback((config: {
    prompt: string;
    onComplete: (blockId: string) => void;
  }) => {
    setIsBlockSelectionMode(true);
    setBlockSelectionPrompt(config.prompt);
    setOnBlockSelectionComplete(() => config.onComplete);
  }, []);

  // Block overlay manager hook - must be after all dependencies are declared
  const blockOverlayManager = useBlockOverlayManager({
    blocks,
    flattenedBlocks,
    documentId,
    currentPanelSizes,
    mainConversationId,
    rabbitholeConversations,
    onSetRabbitholeConversations: setRabbitholeConversations,
    onSetActiveConversationId: setActiveConversationId,
    onAddTextToChat: handleAddTextToChat,
    onUpdateBlockMetadata: updateBlockMetadata,
    onFetchBlocks: fetchBlocks,
    getRabbitholeHighlightsForBlock,
    isBlockSelectionMode,
    onBlockSelectionComplete,
    onSetBlockSelectionMode: setIsBlockSelectionMode,
    onSetBlockSelectionComplete: setOnBlockSelectionComplete,
    onHandleRabbitholeCreated: handleRabbitholeCreated,
    onAddRabbitholeConversation: addRabbitholeConversation,
    refreshRabbitholesFnRef,
  });

  // PDF overlay renderer - now has access to blockOverlayManager
  const renderOverlay = useCallback(
    (props: { pageIndex: number; scale: number; rotation: number }) => {
      return (
        <PDFBlockOverlay
          blocks={blocks}
          selectedBlock={blockOverlayManager.selectedBlock}
          pageIndex={props.pageIndex}
          scale={props.scale}
          onBlockClick={blockOverlayManager.handleBlockClick}
          isSelectionMode={isBlockSelectionMode}
          onBlockSelect={blockOverlayManager.handleBlockSelect}
        />
      );
    },
    [blocks, blockOverlayManager.selectedBlock, blockOverlayManager.handleBlockClick, isBlockSelectionMode, blockOverlayManager.handleBlockSelect]
  );

  // Add effect to log active conversation changes
  useEffect(() => {
    // Check if we should see a tab for activeConversationId
    if (activeConversationId) {
      const activeConversation = rabbitholeConversations.find(c => c.id === activeConversationId);
    }
  }, [activeConversationId, rabbitholeConversations]);

  // Add timeout mechanism for stuck PDF loading
  useEffect(() => {
    if (pdfLoadingState === 'loading') {
      console.log('⏳ PDF loading started, setting 5s timeout...');
      const timeout = setTimeout(() => {
        console.warn('⚠️ PDF loading timeout reached - marking as stuck');
        setPdfLoadingState('stuck');
      }, 10000); // 5 second timeout
      
      setLoadingTimeout(timeout);
      
      return () => {
        clearTimeout(timeout);
        setLoadingTimeout(null);
      };
    }
  }, [pdfLoadingState]);

  // Force refresh function
  const handleForceRefresh = useCallback(() => {
    console.log('🔄 Force refreshing PDF viewer...');
    setPdfLoadingState('idle');
    setForceRefreshKey(prev => prev + 1);
    
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  }, [loadingTimeout]);

  // Track when PDF starts loading (triggered by the first render with percentages === 0)
  useEffect(() => {
    if (pdfLoadingState === 'idle') {
      // Set a small delay to allow the first render to happen, then check if we need to start loading state
      const timer = setTimeout(() => {
        console.log('🔄 PDF loading initiated...');
        setPdfLoadingState('loading');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [forceRefreshKey, pdfLoadingState]); // Re-trigger when force refresh happens

  return (
    <MathJaxProvider>
      <style jsx global>{`
        /* Hide PDF.js tooltips */
        .rpv-core__tooltip,
        [role="tooltip"] {
          display: none !important;
        }
      `}</style>
      <div className="h-screen flex flex-col w-full overflow-hidden relative">
        {/* Header with back button and title */}
        <div className="flex items-center gap-3 px-3 py-2 bg-white border-b border-gray-200 z-10">
          <button
            onClick={() => router.push('/home')}
            className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-all duration-200"
            title="Back to Home"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back</span>
          </button>
          <div className="w-px h-4 bg-gray-300"></div>
          <h1 className="text-sm font-medium text-gray-900 truncate">
            {documentTitle || 'Loading...'}
          </h1>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex w-full overflow-hidden relative">
        {/* Block Selection Mode Banner */}
        {isBlockSelectionMode && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-bounce">
              <div className="animate-pulse w-3 h-3 bg-white rounded-full"></div>
              <span className="font-medium">{blockSelectionPrompt}</span>
              <button 
                onClick={() => {
                  setIsBlockSelectionMode(false);
                  setOnBlockSelectionComplete(null);
                }}
                className="ml-2 text-white hover:text-gray-200 bg-blue-600 hover:bg-blue-700 rounded-full p-1 transition-colors"
                title="Cancel selection"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Custom Floating Toolbar Pill - positioned for PDF panel */}
        <PDFToolbar
          GoToPreviousPage={GoToPreviousPage}
          GoToNextPage={GoToNextPage}
          ZoomOut={ZoomOut}
          ZoomIn={ZoomIn}
          currentPage={currentPage}
          totalPages={totalPages}
          currentPanelSizes={currentPanelSizes}
        />

        <PanelGroup 
          direction="horizontal" 
          onLayout={(sizes) => {
            saveMainPanelSizes(sizes);
            setCurrentPanelSizes(sizes);
          }}
          className="w-full"
        >
          {/* PDF viewer - left panel */}
          <Panel 
            defaultSize={mainPanelSizes[0]} 
            minSize={20}
            maxSize={85}
            className="bg-white shadow-lg overflow-hidden relative"
          >
            <PDFDocumentViewer
              pdfFile={pdfFile}
              forceRefreshKey={forceRefreshKey}
              plugins={[
                defaultLayoutPluginInstance,
                zoomPluginInstance,
                pageNavigationPluginInstance
              ]}
              pdfLoadingState={pdfLoadingState}
              onDocumentLoad={(e) => {
                console.log('📄 PDF document loaded successfully');
                setPdfLoadingState('loaded');
                setTotalPages(e.doc.numPages);
                setCurrentPage(1);
              }}
              onPageChange={(e) => {
                setCurrentPage(e.currentPage + 1);
              }}
              renderLoader={(percentages: number) => {
                      // Don't set state during render - let useEffect handle it
                      return (
                        <div className="flex items-center justify-center min-h-[400px] bg-gray-50">
                          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 border border-gray-100">
                            {percentages === 0 || pdfLoadingState === 'stuck' ? (
                              <div className="text-center">
                                {pdfLoadingState === 'stuck' ? (
                                  <div className="space-y-4">
                                    <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-semibold text-gray-900 mb-2">PDF Loading Timeout</h3>
                                      <p className="text-gray-600 text-sm mb-4">The PDF is taking longer than expected to load.</p>
                                    </div>
                                    <button 
                                      onClick={handleForceRefresh}
                                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Retry Loading
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                                      <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Loading PDF</h3>
                                      <p className="text-gray-600 text-sm">
                                        {pdfFile.startsWith('data:application/pdf;base64,') 
                                          ? `Processing ${((pdfFile.length * 0.75) / (1024 * 1024)).toFixed(1)}MB PDF...`
                                          : 'Downloading PDF...'
                                        }
                                      </p>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '30%' }}></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center space-y-4">
                                <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Loading PDF</h3>
                                  <p className="text-gray-600 text-sm mb-4">Processing pages...</p>
                                </div>
                                <div className="space-y-2">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                                      style={{ width: `${Math.round(percentages)}%` }}
                                    />
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {Math.round(percentages)}%
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                );
              }}
              renderPage={(props) => (
                <>
                  {props.canvasLayer.children}
                  {props.textLayer.children}
                  {renderOverlay(props)}
                </>
              )}
            />

            {/* Block Overlay */}
            {blockOverlayManager.blockOverlayComponent}
          </Panel>
          
          {/* Resize handle between PDF and chat */}
          <ResizeHandle />
          
          {/* Chat panel - right side */}
          <Panel 
            defaultSize={mainPanelSizes[1]} 
            minSize={15}
            maxSize={80}
            className="border-l border-gray-200 bg-white"
          >
            <ChatSidebar
              documentId={documentId}
              selectedBlock={blockOverlayManager.selectedBlock}
              mainConversationId={mainConversationId}
              activeConversationId={activeConversationId}
              rabbitholeConversations={rabbitholeConversations}
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
            />
          </Panel>
        </PanelGroup>
        </div>
      </div>
    </MathJaxProvider>
  );
}
