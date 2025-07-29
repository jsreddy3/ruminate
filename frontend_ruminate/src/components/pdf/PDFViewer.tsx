"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import MathJaxProvider from "../common/MathJaxProvider";
import ChatContainer from "../chat/ChatContainer";
import { conversationApi } from "../../services/api/conversation";
import { authenticatedFetch, API_BASE_URL } from "../../utils/api";
import { createRabbithole } from "../../services/rabbithole";
import BlockContainer from "../interactive/blocks/BlockContainer";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import BlockNavigator from "../interactive/blocks/BlockNavigator";
import BlockOverlay from "./BlockOverlay";
import PDFBlockOverlay from "./PDFBlockOverlay";

// Custom CSS styles for resize handles
const resizeHandleStyles = {
  vertical: `
    width: 4px;
    margin: 0 -2px;
    background-color: transparent;
    position: relative;
    cursor: col-resize;
    transition: background-color 0.2s;
  `,
  horizontal: `
    height: 4px;
    margin: -2px 0;
    background-color: transparent;
    position: relative;
    cursor: row-resize;
    transition: background-color 0.2s;
  `,
  dot: `
    position: absolute;
    border-radius: 50%;
    background-color: #cbd5e1;
    width: 3px;
    height: 3px;
  `,
};

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

// A minimal Block Info component (for the built-in sidebar tab, if you still want it)
function BlockInformation({ block }: { block: Block | null }) {
  if (!block) {
    return (
      <div className="p-4 text-gray-500">
        Select a block to view its information
      </div>
    );
  }
  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Basic Information</h3>
        <div className="space-y-1">
          <p>
            <span className="font-medium">ID:</span> {block.id}
          </p>
          <p>
            <span className="font-medium">Type:</span> {block.block_type}
          </p>
        </div>
      </div>
    </div>
  );
}

// Add utility function for hash calculation
async function calculateHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

// Custom resize handle components with improved styling
const ResizeHandle = () => (
  <PanelResizeHandle
    className="w-2 relative flex items-center justify-center hover:bg-gray-200 transition-colors"
  >
    <div className="absolute h-16 w-1 flex flex-col items-center justify-center space-y-1">
      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
    </div>
  </PanelResizeHandle>
);

const HorizontalResizeHandle = () => (
  <PanelResizeHandle
    className="h-2 relative flex items-center justify-center hover:bg-gray-200 transition-colors"
  >
    <div className="absolute w-16 h-1 flex flex-row items-center justify-center space-x-1">
      <div className="h-1 w-1 rounded-full bg-gray-300"></div>
      <div className="h-1 w-1 rounded-full bg-gray-300"></div>
      <div className="h-1 w-1 rounded-full bg-gray-300"></div>
    </div>
  </PanelResizeHandle>
);

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
  
  // Debug PDF URL
  useEffect(() => {
    if (pdfFile.startsWith('data:application/pdf;base64,')) {
      const base64Length = pdfFile.length;
      const estimatedSizeMB = (base64Length * 0.75) / (1024 * 1024); // rough estimate
      console.log('PDF: Base64 data URL detected');
      console.log(`Base64 length: ${base64Length} chars (~${estimatedSizeMB.toFixed(1)}MB)`);
      
      if (base64Length > 10000000) { // ~7.5MB
        console.warn('⚠️ Very large base64 PDF - this might cause loading issues');
      }
    } else {
      console.log('PDF URL being loaded:', pdfFile);
      if (pdfFile.startsWith('file://')) {
        console.error('❌ Invalid PDF URL: file:// URLs cannot be loaded in browsers');
      }
    }
  }, [pdfFile]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(false);
  // Add state for block overlay
  const [isBlockOverlayOpen, setIsBlockOverlayOpen] = useState(false);
  
  // Add state for conversation management
  const [mainConversationId, setMainConversationId] = useState<string | null>(null);
  
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
      console.log("[DEBUG] Skipping fetchBlocks - called too frequently");
      return;
    }
    lastFetchTimeRef.current = now;
    
    console.log("[DEBUG] Beginning fetchBlocks for document:", documentId);
    setLoading(true);
    try {
      const blocksResp = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/blocks`);
      const blocksData = await blocksResp.json();
      console.log("[DEBUG] Fetched blocks data:", blocksData.length, "blocks");
      
      // Debug block ordering
      console.log("[DEBUG] Block order received from API:");
      blocksData.slice(0, 10).forEach((block, index) => {
        console.log(`  ${index}: Page ${block.page_number} - ${block.block_type} - ${block.id.substring(0, 8)} - "${(block.html_content || '').substring(0, 50)}..."`);
      });
      
      if (Array.isArray(blocksData)) {
        setBlocks(blocksData);
        console.log("[DEBUG] Updated blocks state");
        
        // If we have a selected block, update it with the new data
        if (selectedBlock) {
          const updatedBlock = blocksData.find(b => b.id === selectedBlock.id);
          if (updatedBlock) {
            console.log("[DEBUG] Updating selected block with fresh data", updatedBlock);
            setSelectedBlock(updatedBlock);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching document data:", error);
    } finally {
      setLoading(false);
    }
  }, [documentId]); // Remove selectedBlock from the dependencies
  
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

          // Use the first one found, or create if none exist
          if (existingConvos && existingConvos.length > 0) {
            const id = existingConvos[0].id;
            setMainConversationId(id);
            storeConversationId(documentId, id);
            console.log("Using existing document conversation:", id);
            return id;
          } else {
            console.log("No existing document conversation found, creating new one...");
            // Create a document-level conversation
            const newConv = await conversationApi.create(documentId);
            const id = newConv.conversation_id;
            setMainConversationId(id);
            storeConversationId(documentId, id);
            console.log("Created new document conversation:", id);
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

      console.log(`[Blocks Debug] Found ${filteredBlocks.length} content blocks to display`);
      
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

    renderToolbar: (Toolbar) => (
      <Toolbar>
        {(slots) => {
          const {
            CurrentPageInput,
            GoToNextPage,
            GoToPreviousPage,
            NumberOfPages,
            ShowSearchPopover,
            SwitchTheme,
            Zoom,
            ZoomIn,
            ZoomOut,
          } = slots;
          return (
            <div className="flex items-center w-full px-4">
              {/* Back Button */}
              <div className="flex items-center mr-4">
                <button
                  onClick={() => router.push('/home')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-200"
                  title="Back to Home"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="font-medium">Back</span>
                </button>
              </div>
              
              {/* Page Navigation Group */}
              <div className="flex items-center gap-2 min-w-[200px]">
                <div className="flex items-center gap-1">
                  <CurrentPageInput />
                  <span className="text-neutral-600">/</span>
                  <span className="text-neutral-600">
                    <NumberOfPages />
                  </span>
                </div>
                <GoToPreviousPage />
                <GoToNextPage />
              </div>

              {/* Center area - empty or could add custom controls here */}
              <div className="flex-1"></div>

              {/* Right Controls Group */}
              <div className="flex items-center gap-2 min-w-[200px] justify-end">
                <div className="flex items-center gap-2">
                  <ZoomOut />
                  <Zoom />
                  <ZoomIn />
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <SwitchTheme />
                </div>
              </div>
            </div>
          );
        }}
      </Toolbar>
    ),
    sidebarTabs: () => [],
  });

  // Add page layout customization
  const pageLayout = {
    buildPageStyles: () => ({
      boxShadow: '0 0 4px rgba(0, 0, 0, 0.15)',
      margin: '16px auto',
      borderRadius: '4px',
    }),
    transformSize: ({ size }: { size: { width: number; height: number } }) => ({
      height: size.height,
      width: size.width,
    }),
  };

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

  // Handle block click to select and view it
  const handleBlockClick = useCallback((block: Block) => {
    console.log('Selected Block:', {
      id: block.id,
      type: block.block_type,
      content: block.html_content,
      fullBlock: block
    });

    // Set the new selected block and open overlay
    setSelectedBlock(block);
    setIsBlockOverlayOpen(true);
  }, []);
  
  // Handle creation of rabbithole conversations
  const handleRabbitholeCreated = useCallback((
    conversationId: string, 
    selectedText: string,
    blockId: string
  ) => {
    console.log("[DEBUG] handleRabbitholeCreated called with:", { conversationId, selectedText, blockId });
    
    // Validate inputs to ensure we never try to add undefined/null values
    if (!conversationId) {
      console.error("Cannot create rabbithole conversation without a conversation ID");
      return;
    }

    // Create a title from the selected text (truncated if needed)
    const title = selectedText && selectedText.length > 30 
      ? `${selectedText.substring(0, 30)}...` 
      : selectedText || "New Rabbithole Chat";
    
    console.log("[DEBUG] Created tab title:", title);
    
    // Check if we already have this conversation to prevent duplicates
    const existingConversation = rabbitholeConversations.find(c => c.id === conversationId);
    if (existingConversation) {
      console.log("[DEBUG] Found existing conversation, activating it:", existingConversation);
      // If it already exists, just activate it
      setActiveConversationId(conversationId);
      return;
    }
    
    // Add this conversation to our list
    console.log("[DEBUG] Adding new conversation to state:", { id: conversationId, title, selectionText: selectedText });
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
      console.log("[DEBUG] New rabbitholeConversations state:", newState);
      return newState;
    });
    
    // Set this as the active conversation
    console.log("[DEBUG] Setting active conversation ID:", conversationId);
    setActiveConversationId(conversationId);
  }, [rabbitholeConversations]);

  const renderOverlay = useCallback(
    (props: { pageIndex: number; scale: number; rotation: number }) => {
      return (
        <PDFBlockOverlay
          blocks={blocks}
          selectedBlock={selectedBlock}
          pageIndex={props.pageIndex}
          scale={props.scale}
          onBlockClick={handleBlockClick}
        />
      );
    },
    [blocks, selectedBlock, handleBlockClick]
  );

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
    console.log("[DEBUG] rabbitholeConversations updated:", rabbitholeConversations);
  }, [rabbitholeConversations]);

  useEffect(() => {
    console.log("[DEBUG] activeConversationId updated:", activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    console.log("[DEBUG] blocks updated, count:", blocks.length);
  }, [blocks]);

  // Add handlers for pending text management
  const handleAddTextToChat = useCallback((text: string) => {
    setPendingChatText(text);
  }, []);

  const handleTextAdded = useCallback(() => {
    setPendingChatText('');
  }, []);

  // Add effect to log active conversation changes
  useEffect(() => {
    console.log('[DEBUG] Active conversation updated:', { 
      activeConversationId, 
      rabbitholeConversationsCount: rabbitholeConversations.length 
    });
    
    // Check if we should see a tab for activeConversationId
    if (activeConversationId) {
      const activeConversation = rabbitholeConversations.find(c => c.id === activeConversationId);
      console.log('[DEBUG] Active conversation:', activeConversation);
    }
  }, [activeConversationId, rabbitholeConversations]);

  return (
    <MathJaxProvider>
      <div className="h-screen flex w-full overflow-hidden">
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
            <div className="h-full w-full overflow-hidden">
              <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                <div 
                  style={{
                    border: 'none',
                    height: '100%',
                    width: '100%',
                    backgroundColor: 'rgb(243 244 246)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  className="overflow-auto"
                >
                  <Viewer
                    fileUrl={pdfFile}
                    plugins={[defaultLayoutPluginInstance]}
                    defaultScale={1.2}
                    theme="light"
                    pageLayout={pageLayout}
                    renderLoader={(percentages: number) => (
                      <div className="flex items-center justify-center p-4">
                        <div className="w-full max-w-sm">
                          <div className="bg-white p-4 rounded-lg shadow-sm">
                            {percentages === 0 ? (
                              <div>
                                <div className="text-sm text-orange-600 mb-2">Initializing PDF...</div>
                                <div className="text-xs text-gray-500">
                                  {pdfFile.startsWith('data:application/pdf;base64,') 
                                    ? `Base64 PDF (${((pdfFile.length * 0.75) / (1024 * 1024)).toFixed(1)}MB)`
                                    : `URL: ${pdfFile.substring(0, 50)}...`
                                  }
                                </div>
                                <div className="text-xs text-red-500 mt-1">
                                  {pdfFile.startsWith('file://') && '❌ file:// URLs are blocked by browsers'}
                                  {pdfFile.startsWith('data:application/pdf;base64,') && pdfFile.length > 10000000 && '⚠️ Large PDF may cause issues'}
                                </div>
                                <div className="text-xs text-blue-500 mt-2">
                                  If stuck, try refreshing or check console for errors
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary-600 transition-all duration-300"
                                    style={{ width: `${Math.round(percentages)}%` }}
                                  />
                                </div>
                                <div className="text-sm text-neutral-600 mt-2 text-center">
                                  Loading {Math.round(percentages)}%
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    renderPage={(props) => (
                      <>
                        {props.canvasLayer.children}
                        {props.textLayer.children}
                        {renderOverlay(props)}
                      </>
                    )}
                  />
                </div>
              </Worker>
            </div>

            {/* Block Overlay */}
            <BlockOverlay
              isOpen={isBlockOverlayOpen}
              selectedBlock={selectedBlock}
              flattenedBlocks={flattenedBlocks}
              documentId={documentId}
              pdfPanelWidth={currentPanelSizes[0]}
              onClose={() => setIsBlockOverlayOpen(false)}
              onBlockChange={(block) => {
                setSelectedBlock(block);
              }}
              onRefreshRabbitholes={(refreshFn) => {
                console.log("[DEBUG] BlockContainer provided refresh function");
                refreshRabbitholesFnRef.current = refreshFn;
              }}
              onAddTextToChat={handleAddTextToChat}
              onBlockMetadataUpdate={() => {
                console.log("[DEBUG] Block metadata updated, fetching blocks");
                fetchBlocks();
              }}
              onRabbitholeClick={(rabbitholeId: string, selectedText: string) => {
                console.log("Opening rabbithole conversation:", rabbitholeId, "with text:", selectedText);
                
                const existingConversation = rabbitholeConversations.find(c => c.id === rabbitholeId);
                if (existingConversation) {
                  setActiveConversationId(rabbitholeId);
                  return;
                }
                
                const title = selectedText && selectedText.length > 30 
                  ? `${selectedText.substring(0, 30)}...` 
                  : selectedText || "Rabbithole Chat";
                
                setRabbitholeConversations(prev => [
                  ...prev, 
                  {
                    id: rabbitholeId,
                    title,
                    selectionText: selectedText || "",
                    blockId: selectedBlock?.id || ""
                  }
                ]);
                
                setActiveConversationId(rabbitholeId);
              }}
              onCreateRabbithole={(text: string, startOffset: number, endOffset: number) => {
                console.log("[DEBUG] onCreateRabbithole called with text:", text, "offsets:", startOffset, endOffset);
                
                if (documentId && selectedBlock) {
                  console.log("[DEBUG] Creating rabbithole for document:", documentId, "block:", selectedBlock.id);
                  createRabbithole({
                    document_id: documentId,
                    block_id: selectedBlock.id,
                    selected_text: text,
                    start_offset: startOffset,
                    end_offset: endOffset,
                    type: 'rabbithole'
                  }).then((conversation_id) => {
                    console.log("[DEBUG] Rabbithole created successfully with conversation ID:", conversation_id);
                    handleRabbitholeCreated(conversation_id, text, selectedBlock.id);
                    
                    if (refreshRabbitholesFnRef.current) {
                      console.log("[DEBUG] Calling rabbithole refresh function to update highlights");
                      refreshRabbitholesFnRef.current();
                      
                      setTimeout(() => {
                        console.log("[DEBUG] Delayed fetchBlocks to update PDF UI with new rabbithole");
                        fetchBlocks();
                      }, 500);
                    } else {
                      console.log("[DEBUG] No rabbithole refresh function available, calling fetchBlocks");
                      fetchBlocks();
                    }
                  }).catch(error => {
                    console.error("Error creating rabbithole:", error);
                  });
                }
              }}
            />
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
            <div className="flex flex-col h-full">
              {/* Chat header with tabs */}
              <div className="border-b border-gray-200 p-3 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-900">
                    Document Chat
                    {selectedBlock && (
                      <>
                        {` - ${selectedBlock.block_type}`}
                        <button
                          onClick={() => setIsBlockOverlayOpen(true)}
                          className="ml-2 text-sm text-blue-600 hover:text-blue-800 underline"
                          title="View block details"
                        >
                          View Block
                        </button>
                      </>
                    )}
                  </h3>
                  
                  {/* Minimize button */}
                  <button 
                    onClick={() => console.log("Chat minimize clicked")}
                    className="rounded-full p-1 hover:bg-gray-100 text-gray-700"
                    title="Minimize chat"
                  >
                    <span>−</span>
                  </button>
                </div>
                
                {/* Conversation tabs */}
                <div className="flex space-x-1 overflow-x-auto pb-2 -mb-px">
                  {/* Main chat tab */}
                  <button 
                    className={`px-3 py-1.5 rounded-t-md text-sm whitespace-nowrap ${
                      activeConversationId === null 
                      ? 'bg-white border border-gray-200 border-b-white text-indigo-600 font-medium' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                    onClick={() => setActiveConversationId(null)}
                  >
                    Main Chat
                  </button>
                  
                  {/* Agent chat tabs */}
                  {rabbitholeConversations.map(conv => (
                    <button
                      key={conv.id}
                      className={`px-3 py-1.5 rounded-t-md text-sm flex items-center space-x-1 whitespace-nowrap ${
                        activeConversationId === conv.id
                        ? 'bg-white border border-gray-200 border-b-white text-indigo-600 font-medium' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                      onClick={() => setActiveConversationId(conv.id)}
                    >
                      <span>🔍</span>
                      <span>{conv.title}</span>
                      <span 
                        className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRabbitholeConversations(prev => prev.filter(c => c.id !== conv.id));
                          if (activeConversationId === conv.id) {
                            setActiveConversationId(null);
                          }
                        }}
                      >
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Chat container */}
              <div className="flex-1 overflow-hidden">
                {activeConversationId === null ? (
                  <ChatContainer 
                    key={`main-chat-${mainConversationId || 'default'}`}
                    documentId={documentId}
                    selectedBlock={selectedBlock}
                    conversationId={mainConversationId || undefined}
                    pendingText={pendingChatText}
                    onTextAdded={handleTextAdded}
                    onConversationCreated={(id) => {
                      setMainConversationId(id);
                    }}
                  />
                ) : (
                  <ChatContainer 
                    key={`agent-chat-${activeConversationId}`}
                    documentId={documentId}
                    selectedBlock={selectedBlock}
                    conversationId={activeConversationId}
                    pendingText={pendingChatText}
                    onTextAdded={handleTextAdded}
                  />
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </MathJaxProvider>
  );
}
