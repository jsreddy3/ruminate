"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { motion } from "framer-motion";
import MathJaxProvider from "../common/MathJaxProvider";
import TabView from "../common/TabView";
import ChatContainer from "../chat/ChatContainer";
import { conversationApi } from "../../services/api/conversation";
import BlockContainer from "../interactive/blocks/BlockContainer";
import { agentApi } from "../../services/api/agent";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

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
  const [pdfFile] = useState<string>(initialPdfFile);
  const [documentId] = useState<string>(initialDocumentId);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(false);
  // Add state for PDFViewer collapsed state
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(false);
  
  // Add state for conversation management
  const [mainConversationId, setMainConversationId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  
  // Update the state management to handle multiple conversations
  // Add state for tracking agent conversations
  const [agentConversations, setAgentConversations] = useState<{
    id: string;
    title: string;
    selectionText: string;
    blockId: string;
  }[]>([]);

  // Add state for tracking the active conversation tab
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
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
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const blocksResp = await fetch(`${apiUrl}/documents/${documentId}/blocks`);
      const blocksData = await blocksResp.json();
      console.log("[DEBUG] Fetched blocks data:", blocksData.length, "blocks");
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
            const id = newConv.id;
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
  
  // Function to switch to the notes tab
  const switchToNotesTab = useCallback(() => {
    setActiveTabId('notes');
  }, []);

  // State to track all blocks in flattened form for navigation
  const [flattenedBlocks, setFlattenedBlocks] = useState<Block[]>([]);
  
  // Add state for active tab
  const [activeTabId, setActiveTabId] = useState<string>('pdf');
  
  // State for notes content
  const [notesContent, setNotesContent] = useState<string>('');
  
  // Create a map of blockId to sequence number for notes sorting
  const blockSequenceMap = useMemo(() => {
    const map = new Map<string, number>();
    flattenedBlocks.forEach((block, index) => {
      map.set(block.id, index);
    });
    return map;
  }, [flattenedBlocks]);

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

      // First, collect all non-page blocks that have content (HTML or images)
      const contentBlocks = blocks.filter(
        (b) => b.block_type &&
          b.block_type.toLowerCase() !== "page" &&
          (
            b.html_content ||
            (b.images && Object.keys(b.images || {}).length > 0) ||
            ['picture', 'figure', 'image'].includes(b.block_type.toLowerCase())
          ) &&
          chatEnabledBlockTypes.includes(b.block_type.toLowerCase())
      );

      console.log(`[Blocks Debug] Found ${contentBlocks.length} content blocks`);
      console.log(`[Blocks Debug] Content block types:`, contentBlocks.map(b => b.block_type));

      // Flatten any blocks with children into a single array
      const flattenAllBlocks = (blocksToProcess: Block[]): Block[] => {
        const result: Block[] = [];

        for (const block of blocksToProcess) {
          // Only add blocks that are chat-enabled
          if (block.block_type && chatEnabledBlockTypes.includes(block.block_type.toLowerCase())) {
            // Add the current block if it has content (HTML or images)
            if (
              block.html_content ||
              (block.images && Object.keys(block.images || {}).length > 0) ||
              ['picture', 'figure', 'image'].includes(block.block_type.toLowerCase())
            ) {
              result.push(block);
            }
          }

          // Recursively add any children
          if (block.children && block.children.length > 0) {
            // Ensure children inherit the parent's page number if they don't have one
            for (const child of block.children) {
              if (typeof child.page_number !== 'number' && typeof block.page_number === 'number') {
                child.page_number = block.page_number;
              }
            }

            // Only add children that match our filters
            const filteredChildren = block.children.filter(
              child => child.block_type && chatEnabledBlockTypes.includes(child.block_type.toLowerCase())
            );

            result.push(...flattenAllBlocks(filteredChildren));
          }
        }

        return result;
      };

      // Get all eligible blocks including children
      const allBlocks = flattenAllBlocks(contentBlocks);

      console.log(`[Blocks Debug] After flattening, found ${allBlocks.length} total blocks`);
      console.log(`[Blocks Debug] Block types after flattening:`, allBlocks.map(b => b.block_type));

      // Sort blocks properly by page_number and position
      allBlocks.sort((a, b) => {
        // First sort by page_number
        if ((a.page_number ?? 0) !== (b.page_number ?? 0)) {
          return (a.page_number ?? 0) - (b.page_number ?? 0);
        }

        // If on same page, sort by vertical position (top-to-bottom)
        if (a.polygon?.[0]?.[1] && b.polygon?.[0]?.[1]) {
          return a.polygon[0][1] - b.polygon[0][1];
        }

        // For blocks at same vertical position, sort by horizontal position (left-to-right)
        if (a.polygon?.[0]?.[0] && b.polygon?.[0]?.[0]) {
          return a.polygon[0][0] - b.polygon[0][0];
        }

        return 0;
      });

      // Update state with the sorted blocks
      setFlattenedBlocks(allBlocks);
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
                  <ShowSearchPopover />
                  <SwitchTheme />
                </div>
              </div>
            </div>
          );
        }}
      </Toolbar>
    ),
    sidebarTabs: (defaultTabs) => [
      {
        content: <BlockInformation block={selectedBlock} />,
        icon: (
          <svg viewBox="0 0 24 24" width="24px" height="24px">
            <path
              d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"
              fill="currentColor"
            />
          </svg>
        ),
        title: "Block Information",
      },
    ],
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

  const handleBlockClick = useCallback((block: Block) => {
    console.log('Selected Block:', {
      id: block.id,
      type: block.block_type,
      content: block.html_content,
      fullBlock: block
    });

    // Set the new selected block
    setSelectedBlock(block);
    
    // Show the chat panel with this block
    setShowChat(true);
  }, []);
  
  // Update the handleAgentChatCreated function to manage multiple agent conversations
  const handleAgentChatCreated = useCallback((
    conversationId: string, 
    selectedText: string,
    blockId: string
  ) => {
    console.log("[DEBUG] handleAgentChatCreated called with:", { conversationId, selectedText, blockId });
    
    // Validate inputs to ensure we never try to add undefined/null values
    if (!conversationId) {
      console.error("Cannot create agent chat without a conversation ID");
      return;
    }

    // Create a title from the selected text (truncated if needed)
    const title = selectedText && selectedText.length > 30 
      ? `${selectedText.substring(0, 30)}...` 
      : selectedText || "New Agent Chat";
    
    console.log("[DEBUG] Created tab title:", title);
    
    // Check if we already have this conversation to prevent duplicates
    const existingConversation = agentConversations.find(c => c.id === conversationId);
    if (existingConversation) {
      console.log("[DEBUG] Found existing conversation, activating it:", existingConversation);
      // If it already exists, just activate it
      setActiveConversationId(conversationId);
      setShowChat(true);
      return;
    }
    
    // Add this conversation to our list
    console.log("[DEBUG] Adding new conversation to state:", { id: conversationId, title, selectionText: selectedText });
    setAgentConversations(prev => {
      const newState = [
        ...prev, 
        {
          id: conversationId,
          title,
          selectionText: selectedText || "",
          blockId
        }
      ];
      console.log("[DEBUG] New agentConversations state:", newState);
      return newState;
    });
    
    // Set this as the active conversation
    console.log("[DEBUG] Setting active conversation ID:", conversationId);
    setActiveConversationId(conversationId);
    
    // Ensure chat is visible
    setShowChat(true);
  }, [agentConversations]);

  const renderOverlay = useCallback(
    (props: { pageIndex: number; scale: number; rotation: number }) => {
      const { scale, pageIndex } = props;

      // Fix the page number filtering - there was an off-by-one error
      // If blocks from page 1 are showing on page 0, then we need to REMOVE the +1 adjustment
      const filteredBlocks = blocks.filter((b) => {
        const blockPageNumber = b.page_number ?? 0;
        // Compare directly with pageIndex instead of pageIndex + 1
        return b.block_type !== "Page" && blockPageNumber === pageIndex;
      });

      return (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {filteredBlocks.map((b) => {
            if (!b.polygon || b.polygon.length < 4) return null;
            const x = Math.min(...b.polygon.map((p) => p[0]));
            const y = Math.min(...b.polygon.map((p) => p[1]));
            const w = Math.max(...b.polygon.map((p) => p[0])) - x;
            const h = Math.max(...b.polygon.map((p) => p[1])) - y;

            const isSelected = selectedBlock?.id === b.id;

            // Determine the block's status
            const blockStatus = isSelected ? 'selected' : '';

            // Get the appropriate styling based on status
            const getBlockStyle = () => {
              const baseStyle = {
                position: "absolute" as const,
                left: `${x * scale}px`,
                top: `${y * scale}px`,
                width: `${w * scale}px`,
                height: `${h * scale}px`,
                cursor: 'pointer',
                transition: 'all 0.3s ease-in-out',
                zIndex: isSelected ? 2 : 1,
                borderRadius: '2px',
              };

              if (isSelected) {
                return {
                  ...baseStyle,
                  border: '2px solid rgba(59, 130, 246, 0.8)',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                };
              }

              return {
                ...baseStyle,
                border: '1px solid rgba(59, 130, 246, 0.3)',
                backgroundColor: 'transparent',
              };
            };

            return (
              <motion.div
                key={b.id}
                style={getBlockStyle()}
                className="hover:bg-primary-100/10 hover:border-primary-400 hover:shadow-block-hover group"
                onClick={() => handleBlockClick(b)}
                title={b.html_content?.replace(/<[^>]*>/g, "") || ""}
              >
                {/* Optional: Show a dot indicator for selected blocks */}
                {blockStatus && (
                  <div className="absolute top-1/2 -translate-y-1/2 -left-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      );
    },
    [blocks, selectedBlock, handleBlockClick]
  );

  // Use our custom hook for the main panel layout
  const [mainPanelSizes, saveMainPanelSizes] = usePanelStorage('main', [70, 30]);
  
  // Use our custom hook for the chat panel layout
  const [chatPanelSizes, saveChatPanelSizes] = usePanelStorage('chat', [50, 50]);

  // Ensure panel sizes are applied correctly
  useEffect(() => {
    // Allow layout to fully settle after mounting
    const timer = setTimeout(() => {
      // Force a resize event to ensure PDF viewer recalculates layouts
      window.dispatchEvent(new Event('resize'));
    }, 100);
    
    return () => clearTimeout(timer);
  }, [showChat]); // Re-trigger when chat visibility changes

  useEffect(() => {
    console.log("[DEBUG] agentConversations updated:", agentConversations);
  }, [agentConversations]);

  useEffect(() => {
    console.log("[DEBUG] activeConversationId updated:", activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    console.log("[DEBUG] blocks updated, count:", blocks.length);
  }, [blocks]);

  // Add effect to log when chat should be visible and with which conversation
  useEffect(() => {
    console.log('[DEBUG] Chat visibility updated:', { 
      showChat, 
      activeConversationId, 
      agentConversationsCount: agentConversations.length 
    });
    
    // Check if we should see a tab for activeConversationId
    if (activeConversationId) {
      const activeConversation = agentConversations.find(c => c.id === activeConversationId);
      console.log('[DEBUG] Active conversation:', activeConversation);
    }
  }, [showChat, activeConversationId, agentConversations]);

  return (
    <MathJaxProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <PanelGroup 
          direction="horizontal" 
          onLayout={(sizes) => saveMainPanelSizes(sizes)}
          className="w-full"
        >
          {/* PDF viewer */}
          <Panel 
            defaultSize={mainPanelSizes[0]} 
            minSize={30}
            className="bg-white shadow-lg overflow-hidden flex flex-col"
          >
            <div className="h-full w-full overflow-hidden flex flex-col">
              <TabView
                tabs={[
                  {
                    id: 'pdf',
                    label: 'PDF',
                    icon: <span>📄</span>,
                    content: (
                      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                        <div 
                          style={{
                            border: 'none',
                            height: '100%',
                            width: '100%',
                            backgroundColor: 'rgb(243 244 246)',
                            position: 'relative', // Ensure proper positioning context
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
                                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary-600 transition-all duration-300"
                                        style={{ width: `${Math.round(percentages)}%` }}
                                      />
                                    </div>
                                    <div className="text-sm text-neutral-600 mt-2 text-center">
                                      Loading {Math.round(percentages)}%
                                    </div>
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
                    )
                  },
                ]}
                activeTabId={activeTabId}
                onTabChange={setActiveTabId}
                className="h-full flex flex-col"
              />
            </div>
          </Panel>
          
          {/* Resize handle */}
          {showChat && <ResizeHandle />}
          
          {/* Chat panel */}
          {showChat && (
            <Panel 
              defaultSize={mainPanelSizes[1]} 
              minSize={20}
            >
              <div className="border-l border-gray-200 flex flex-col h-full bg-white">
                {/* Chat header with tabs */}
                <div className="border-b border-gray-200 p-3 flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900">
                      Document Chat
                      {selectedBlock && ` - ${selectedBlock.block_type}`}
                    </h3>
                    
                    {/* Close button */}
                    <button 
                      onClick={() => setShowChat(false)}
                      className="rounded-full p-1 hover:bg-gray-100 text-gray-700"
                    >
                      <span>×</span>
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
                    {agentConversations.map(conv => (
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
                            setAgentConversations(prev => prev.filter(c => c.id !== conv.id));
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
                
                {/* Vertically resizable panels for block content and chat */}
                <PanelGroup 
                  direction="vertical" 
                  className="flex-1"
                  onLayout={(sizes) => saveChatPanelSizes(sizes)}
                >
                  {/* Selected block interactive content */}
                  {selectedBlock && (
                    <>
                      <Panel 
                        defaultSize={chatPanelSizes[0]} 
                        minSize={30} 
                        maxSize={50}
                      >
                        <div className="border-b border-gray-200 overflow-auto h-full p-3">
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Selected Content</div>
                          <div className="border border-gray-100 rounded-md p-2 bg-gray-50 h-[calc(100%-1.5rem)]">
                            <BlockContainer
                              blockId={selectedBlock.id}
                              blockType={selectedBlock.block_type}
                              htmlContent={selectedBlock.html_content || ''}
                              documentId={documentId}
                              images={selectedBlock.images}
                              customStyle={{ backgroundColor: 'white' }}
                              onRefreshRabbitholes={(refreshFn) => {
                                console.log("[DEBUG] BlockContainer provided refresh function");
                                // Store the refresh function for later use
                                refreshRabbitholesFnRef.current = refreshFn;
                              }}
                              onAddTextToChat={(text: string) => {
                                // Find the active chat's message input and add the text
                                const messageInput = document.querySelector('.message-input textarea') as HTMLTextAreaElement;
                                if (messageInput) {
                                  messageInput.value += (messageInput.value ? ' ' : '') + text;
                                  messageInput.focus();
                                }
                              }}
                              onRabbitholeClick={(rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => {
                                // Open the agent chat for this rabbithole conversation
                                console.log("Opening rabbithole conversation:", rabbitholeId, "with text:", selectedText);
                                
                                // Check if this conversation is already in our list
                                const existingConversation = agentConversations.find(c => c.id === rabbitholeId);
                                if (existingConversation) {
                                  // If it exists, just activate it
                                  setActiveConversationId(rabbitholeId);
                                  setShowChat(true);
                                  return;
                                }
                                
                                // Otherwise, add it to our conversations list
                                // Use the exact selected text that was passed from the rabbithole click
                                const title = selectedText && selectedText.length > 30 
                                  ? `${selectedText.substring(0, 30)}...` 
                                  : selectedText || "Rabbithole Chat";
                                
                                setAgentConversations(prev => [
                                  ...prev, 
                                  {
                                    id: rabbitholeId,
                                    title,
                                    selectionText: selectedText || "",
                                    blockId: selectedBlock.id
                                  }
                                ]);
                                
                                // Set this as the active conversation
                                setActiveConversationId(rabbitholeId);
                                setShowChat(true);
                              }}
                              onCreateAgentChat={(text: string, startOffset: number, endOffset: number) => {
                                // Consolidated method that handles all agent chat creation
                                console.log("[DEBUG] onCreateAgentChat called with text:", text, "offsets:", startOffset, endOffset);
                                
                                if (documentId && selectedBlock) {
                                  console.log("[DEBUG] Creating agent chat for document:", documentId, "block:", selectedBlock.id);
                                  agentApi.createAgentRabbithole(
                                    documentId,
                                    selectedBlock.id,
                                    text,
                                    startOffset,
                                    endOffset
                                  ).then(({ conversation_id }) => {
                                    console.log("[DEBUG] Agent chat created successfully with conversation ID:", conversation_id);
                                    // Pass the exact selected text for the agent chat
                                    handleAgentChatCreated(conversation_id, text, selectedBlock.id);
                                    
                                    // First refresh the rabbithole data in the current block view
                                    if (refreshRabbitholesFnRef.current) {
                                      console.log("[DEBUG] Calling rabbithole refresh function to update highlights");
                                      refreshRabbitholesFnRef.current();
                                      
                                      // Wait a bit before fetching all blocks to avoid overwhelming the UI
                                      // This ensures the rabbithole highlight appears in the current view first
                                      setTimeout(() => {
                                        console.log("[DEBUG] Delayed fetchBlocks to update PDF UI with new rabbithole");
                                        fetchBlocks();
                                      }, 500);
                                    } else {
                                      // If no refresh function is available, just fetch blocks
                                      console.log("[DEBUG] No rabbithole refresh function available, calling fetchBlocks");
                                      fetchBlocks();
                                    }
                                  }).catch(error => {
                                    console.error("Error creating agent chat:", error);
                                  });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </Panel>
                      
                      {/* Resize handle */}
                      <HorizontalResizeHandle />
                    </>
                  )}
                  
                  {/* Chat container - show either main chat or selected agent chat */}
                  <Panel 
                    defaultSize={chatPanelSizes[1]} 
                    minSize={50}
                  >
                    <div className="h-full overflow-hidden">
                      {activeConversationId === null ? (
                        <ChatContainer 
                          key={`main-chat-${mainConversationId || 'default'}`}
                          documentId={documentId}
                          selectedBlock={selectedBlock}
                          isAgentChat={false}
                          conversationId={mainConversationId || undefined}
                          onClose={() => setShowChat(false)}
                        />
                      ) : (
                        <ChatContainer 
                          key={`agent-chat-${activeConversationId}`}
                          documentId={documentId}
                          selectedBlock={selectedBlock}
                          isAgentChat={true}
                          conversationId={activeConversationId}
                          onClose={() => {
                            if (activeConversationId) {
                              setActiveConversationId(null);
                            }
                          }}
                        />
                      )}
                    </div>
                  </Panel>
                </PanelGroup>
              </div>
            </Panel>
          )}
        </PanelGroup>
      </div>
    </MathJaxProvider>
  );
}
