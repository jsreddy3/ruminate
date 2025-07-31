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
import ConversationLibrary from "../chat/ConversationLibrary";
import { useReadingProgress } from "../../hooks/useReadingProgress";
import { useViewportReadingTracker } from "../../hooks/useViewportReadingTracker";

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

  // Transform fetched rabbithole data into conversation tabs format
  useEffect(() => {
    if (!rabbitholeData || rabbitholeData.length === 0) return;

    const transformedConversations = rabbitholeData.map(rabbithole => ({
      id: rabbithole.id,
      title: rabbithole.selected_text 
        ? (rabbithole.selected_text.length > 30 
            ? rabbithole.selected_text.substring(0, 30) + '...' 
            : rabbithole.selected_text)
        : 'Rabbithole Discussion',
      selectionText: rabbithole.selected_text || '',
      blockId: rabbithole.source_block_id || ''
    }));

    setRabbitholeConversations(transformedConversations);
  }, [rabbitholeData]);

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

  // Reading Progress Hook - initialized after flattenedBlocks are set
  const { updateProgress, scrollToFurthestBlock, initializeProgress, getFurthestProgress } = useReadingProgress({
    documentId,
    flattenedBlocks
  });


  // Fetch document title and initialize reading progress
  useEffect(() => {
    const fetchDocumentTitle = async () => {
      try {
        const document = await documentApi.getDocument(documentId);
        setDocumentTitle(document.title);
        
        console.log('📖 Document loaded with reading progress:', {
          documentId: document.id,
          title: document.title,
          furthest_read_block_id: document.furthest_read_block_id,
          furthest_read_position: document.furthest_read_position,
          furthest_read_updated_at: document.furthest_read_updated_at,
        });
        
        // Initialize reading progress from document data
        if (initializeProgress) {
          initializeProgress(document);
          console.log('📖 Reading progress initialized from document data');
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

  // Function to update a specific block's metadata optimistically
  const updateBlockMetadata = useCallback((blockId: string, newMetadata: any) => {
    setBlocks(prevBlocks => 
      prevBlocks.map(block => 
        block.id === blockId 
          ? { ...block, metadata: { ...block.metadata, ...newMetadata } }
          : block
      )
    );
    
    // Update reading progress when user interacts with a block
    updateProgress(blockId);
    
    // Selected block metadata updates now handled by useBlockOverlayManager hook
  }, [updateProgress]);

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
    
    // Update reading progress when user creates a rabbithole
    if (blockId) {
      updateProgress(blockId);
    }
  }, [rabbitholeConversations, updateProgress]);

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

  // Block Overlay Manager - handles block selection and interactions
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

  // Viewport Reading Tracker - for timer-based progress tracking (only when block is selected)
  const furthestProgress = getFurthestProgress();
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


  // Calculate scroll position for a block
  const calculateBlockScrollPosition = useCallback((block: Block) => {
    if (!block.polygon || block.polygon.length === 0) return null;
    
    // Get block bounds from polygon
    const x = Math.min(...block.polygon.map((p) => p[0]));
    const y = Math.min(...block.polygon.map((p) => p[1]));
    
    return {
      pageIndex: (block.page_number || 1) - 1, // Convert to 0-based index
      leftOffset: x,
      bottomOffset: y, // PDF coordinates
    };
  }, []);

  // Scroll to specific block using page navigation plugin
  const scrollToBlock = useCallback(async (block: Block) => {
    if (!block.polygon || !block.page_number) return;
    
    try {
      // Get the jumpToPage function from the page navigation plugin
      const { jumpToPage } = pageNavigationPluginInstance;
      
      if (jumpToPage) {
        // Try with 1-based indexing first (no conversion)
        await jumpToPage(block.page_number);
        console.log(`📍 Navigated to page ${block.page_number} for block search`);
      } else {
        // Fallback to setting current page
        setCurrentPage(block.page_number);
      }
    } catch (error) {
      console.error('Failed to scroll to block:', error);
      // Fallback to setting current page
      setCurrentPage(block.page_number);
    }
  }, [pageNavigationPluginInstance, setCurrentPage]);

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
    
    if (matchingBlock && matchingBlock.page_number) {
      // Navigate to the page and scroll to the block
      setCurrentPage(matchingBlock.page_number);
      
      // First scroll to the block position
      scrollToBlock(matchingBlock);
      
      // Then open the block overlay after a longer delay to ensure navigation completes
      setTimeout(() => {
        blockOverlayManager.handleBlockClick(matchingBlock);
      }, 800);
    }
  }, [flattenedBlocks, blockOverlayManager, setCurrentPage, scrollToBlock]);

  // Resume reading functionality
  const handleResumeReading = useCallback(async () => {
    const furthestBlockId = scrollToFurthestBlock();
    if (furthestBlockId) {
      console.log('📖 Resuming reading at block:', furthestBlockId);
      const block = flattenedBlocks.find(b => b.id === furthestBlockId);
      if (block) {
        await scrollToBlock(block);
        setTimeout(() => {
          blockOverlayManager.handleBlockClick(block);
        }, 500);
      }
    }
  }, [scrollToFurthestBlock, flattenedBlocks, scrollToBlock, blockOverlayManager]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Command+F or Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        // Focus the search input in the toolbar
        const searchInput = document.querySelector('input[placeholder="Search text..."]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
        
        /* PDF viewer background styling for library feel */
        .rpv-core__viewer {
          background: linear-gradient(135deg, #fefcf7 0%, #fef9ed 100%) !important;
        }
        
        /* Page styling */
        .rpv-core__page-layer {
          box-shadow: 0 8px 16px rgba(60, 64, 67, 0.15), 0 4px 8px rgba(60, 64, 67, 0.1) !important;
          border-radius: 6px !important;
          border: 1px solid rgba(175, 95, 55, 0.1) !important;
        }
      `}</style>
      <div className="h-screen flex flex-col w-full overflow-hidden relative bg-surface-paper">
        {/* Scholarly header with warm library aesthetic */}
        <div className="relative">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-library-cream-50 via-surface-parchment to-library-cream-50"></div>
          
          {/* Content */}
          <div className="relative flex items-center gap-4 px-6 py-4 border-b border-library-sage-200 backdrop-blur-sm">
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
            
            {/* Document title with scholarly styling */}
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-lg font-semibold text-reading-primary truncate tracking-wide">
                {documentTitle || (
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

            {/* Conversation Library in the header */}
            <div className="flex-shrink-0">
              <ConversationLibrary
                conversations={[
                  {
                    id: null,
                    title: 'Main Discussion',
                    type: 'main' as const,
                    isActive: activeConversationId === null
                  },
                  ...rabbitholeConversations.map(conv => ({
                    id: conv.id,
                    title: conv.title,
                    type: 'rabbithole' as const,
                    selectionText: conv.selectionText,
                    isActive: activeConversationId === conv.id
                  }))
                ]}
                activeConversationId={activeConversationId}
                onConversationChange={setActiveConversationId}
              />
            </div>
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
        <PDFToolbar
          GoToPreviousPage={GoToPreviousPage}
          GoToNextPage={GoToNextPage}
          ZoomOut={ZoomOut}
          ZoomIn={ZoomIn}
          currentPage={currentPage}
          totalPages={totalPages}
          currentPanelSizes={currentPanelSizes}
          onSearch={handleSearch}
          onResumeReading={handleResumeReading}
          hasReadingProgress={!!scrollToFurthestBlock()}
        />

        <PanelGroup 
          direction="horizontal" 
          onLayout={(sizes) => {
            saveMainPanelSizes(sizes);
            setCurrentPanelSizes(sizes);
          }}
          className="w-full"
        >
          {/* PDF viewer - left panel with library aesthetic */}
          <Panel 
            defaultSize={mainPanelSizes[0]} 
            minSize={20}
            maxSize={85}
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
            
            {/* PDF content with enhanced shadow */}
            <div className="relative h-full shadow-inner"
                 style={{ boxShadow: 'inset 0 0 20px rgba(175, 95, 55, 0.03)' }}>
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
                        <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
                          <div className="bg-gradient-to-br from-surface-paper to-library-cream-100 rounded-journal shadow-shelf p-10 max-w-md w-full mx-6 border border-library-sage-200 backdrop-blur-paper">
                            {percentages === 0 || pdfLoadingState === 'stuck' ? (
                              <div className="text-center">
                                {pdfLoadingState === 'stuck' ? (
                                  <div className="space-y-6">
                                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-library-mahogany-100 to-library-mahogany-200 rounded-full flex items-center justify-center border border-library-mahogany-300 shadow-paper">
                                      <svg className="w-8 h-8 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <h3 className="font-serif text-xl font-semibold text-reading-primary mb-3">Manuscript Loading Delayed</h3>
                                      <p className="text-reading-secondary text-sm mb-6 leading-relaxed">The manuscript is taking longer than expected to prepare. This may occur with particularly large or complex documents.</p>
                                    </div>
                                    <button 
                                      onClick={handleForceRefresh}
                                      className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-library-mahogany-500 to-library-mahogany-600 text-library-cream-50 font-serif font-medium rounded-book hover:from-library-mahogany-600 hover:to-library-mahogany-700 focus:outline-none focus:ring-2 focus:ring-library-gold-400 focus:ring-offset-2 transition-all duration-300 shadow-book hover:shadow-shelf"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Reload Manuscript
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-6">
                                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-library-gold-100 to-library-gold-200 rounded-full flex items-center justify-center border border-library-gold-300 shadow-paper">
                                      <svg className="w-8 h-8 text-library-mahogany-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    </div>
                                    <div>
                                      <h3 className="font-serif text-xl font-semibold text-reading-primary mb-2">Preparing Manuscript</h3>
                                      <p className="text-reading-secondary text-sm leading-relaxed">
                                        {pdfFile.startsWith('data:application/pdf;base64,') 
                                          ? `Processing ${((pdfFile.length * 0.75) / (1024 * 1024)).toFixed(1)}MB manuscript for scholarly review...`
                                          : 'Retrieving manuscript from the archives...'
                                        }
                                      </p>
                                    </div>
                                    <div className="w-full bg-library-sage-200 rounded-full h-2 shadow-inner">
                                      <div className="bg-gradient-to-r from-library-gold-400 to-library-mahogany-400 h-2 rounded-full animate-pulse shadow-sm" style={{ width: '35%' }}></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center space-y-6">
                                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-library-forest-100 to-library-forest-200 rounded-full flex items-center justify-center border border-library-forest-300 shadow-paper">
                                  <svg className="w-8 h-8 text-library-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="font-serif text-xl font-semibold text-reading-primary mb-2">Rendering Pages</h3>
                                  <p className="text-reading-secondary text-sm mb-6 leading-relaxed">Carefully preparing each page for scholarly examination...</p>
                                </div>
                                <div className="space-y-3">
                                  <div className="w-full bg-library-sage-200 rounded-full h-3 shadow-inner">
                                    <div
                                      className="h-3 bg-gradient-to-r from-library-gold-400 via-library-mahogany-400 to-library-forest-500 rounded-full transition-all duration-700 ease-out shadow-sm"
                                      style={{ width: `${Math.round(percentages)}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="text-sm font-serif font-medium text-reading-primary">
                                      {Math.round(percentages)}% Complete
                                    </div>
                                    <div className="w-1 h-1 bg-library-gold-400 rounded-full animate-pulse"></div>
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
            </div>
          </Panel>
          
          {/* Elegant resize handle between PDF and chat */}
          <PanelResizeHandle className="w-1 bg-gradient-to-b from-library-sage-100 via-library-sage-200 to-library-sage-100 hover:bg-gradient-to-b hover:from-library-gold-200 hover:via-library-gold-300 hover:to-library-gold-200 transition-all duration-300 cursor-col-resize group relative">
            {/* Subtle grip indicator */}
            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-0.5 bg-library-sage-300 group-hover:bg-library-gold-400 opacity-50 group-hover:opacity-80 transition-all duration-300"></div>
          </PanelResizeHandle>
          
          {/* Chat panel - scholarly discussion area */}
          <Panel 
            defaultSize={mainPanelSizes[1]} 
            minSize={15}
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
            <div className="relative h-full border-l border-library-sage-300 shadow-inner bg-gradient-to-r from-library-cream-50/30 to-transparent">
              {/* Decorative book spine edge */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-library-mahogany-400 via-library-mahogany-500 to-library-mahogany-600 shadow-sm"></div>
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
            </div>
          </Panel>
        </PanelGroup>
        </div>
      </div>
    </MathJaxProvider>
  );
}
