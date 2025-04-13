"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { motion } from "framer-motion";

import ChatPane from "../interactive/InteractivePane"; 
import ResizablePanel from "../common/ResizablePanel";
import MathJaxProvider from "../common/MathJaxProvider";
import { conversationApi } from "../../services/api/conversation";

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
          {/* <p>
            <span className="font-medium">Content:</span>
          </p> */}
          {/* <div
            className="mt-1 p-2 bg-gray-50 rounded text-sm"
            dangerouslySetInnerHTML={{ __html: block.html }}
          /> */}
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

// Add a type for our cache structure
interface CachedDocument {
  documentId: string;
  blockConversations: {[blockId: string]: string};
}

interface PDFViewerProps {
  initialPdfFile: string;
  initialDocumentId: string;
}

export default function PDFViewer({ initialPdfFile, initialDocumentId }: PDFViewerProps) {
  const [pdfFile] = useState<string>(initialPdfFile);
  const [documentId] = useState<string>(initialDocumentId);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [documentConversationId, setDocumentConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // State to track all blocks in flattened form for navigation
  const [flattenedBlocks, setFlattenedBlocks] = useState<Block[]>([]);
  // Add state for chat pane width
  const [chatPaneWidth, setChatPaneWidth] = useState(384);

  // Flatten blocks for easy navigation
  useEffect(() => {
    if (blocks.length > 0) {
      // First, collect all non-page blocks that have content (HTML or images) and are chat-enabled
      const contentBlocks = blocks.filter(block => 
        block.block_type && 
        block.block_type.toLowerCase() !== "page" && 
        (
          block.html_content || 
          (block.images && Object.keys(block.images || {}).length > 0) ||
          ['picture', 'figure', 'image'].includes(block.block_type.toLowerCase())
        ) && 
        chatEnabledBlockTypes.includes(block.block_type.toLowerCase())
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
          
          // Recursively add any chat-enabled children
          if (block.children && block.children.length > 0) {
            // Ensure children inherit the parent's page number if they don't have one
            for (const child of block.children) {
              if (typeof child.page_number !== 'number' && typeof block.page_number === 'number') {
                child.page_number = block.page_number;
              }
            }
            
            // Only add children that are chat-enabled
            const chatEnabledChildren = block.children.filter(
              child => child.block_type && chatEnabledBlockTypes.includes(child.block_type.toLowerCase())
            );
            
            result.push(...flattenAllBlocks(chatEnabledChildren));
          }
        }
        
        return result;
      };
      
      // Get all chat-enabled blocks including children
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
    const fetchBlocks = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        const blocksResp = await fetch(`${apiUrl}/documents/${documentId}/blocks`);
        const blocksData = await blocksResp.json();
        if (Array.isArray(blocksData)) {
          setBlocks(blocksData);
        }
      } catch (error) {
        console.error("Error fetching document data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchBlocks();
    }
  }, [documentId]);

  // Initialize document conversation
  // Static variable to track ongoing initialization promises across all PDFViewer instances
  // This prevents race conditions between multiple components trying to initialize at once
  // Using a static variable outside of component instances to coordinate across components
  const ConversationInitPromises: Record<string, Promise<string> | undefined> = {};

  // Helper functions to interact with localStorage for conversation caching
  const getStoredConversationId = (docId: string): string | null => {
    try {
      const key = `document-conversation-${docId}`;
      const storedData = localStorage.getItem(key);
      if (storedData) {
        const id = JSON.parse(storedData);
        console.log(`Found cached conversation ID in localStorage: ${id}`); 
        return id;
      }
      return null;
    } catch (e) {
      console.error("Error reading from localStorage:", e);
      return null;
    }
  };

  const storeConversationId = (docId: string, convId: string): void => {
    try {
      const key = `document-conversation-${docId}`;
      localStorage.setItem(key, JSON.stringify(convId));
      console.log(`Cached conversation ID in localStorage: ${convId}`);
    } catch (e) {
      console.error("Error writing to localStorage:", e);
    }
  };

  useEffect(() => {
    // Single initialization function with proper coordination
    const initializeDocumentConversation = async () => {
      if (!documentId) return;
      
      // If we already have the conversation ID set, no need to initialize
      if (documentConversationId) return;
      
      // First check localStorage to avoid unnecessary API calls
      const cachedId = getStoredConversationId(documentId);
      if (cachedId) {
        setDocumentConversationId(cachedId);
        return;
      }
      
      // Check if there's already an ongoing initialization for this document
      if (documentId in ConversationInitPromises && ConversationInitPromises[documentId]) {
        try {
          // Wait for the existing promise to resolve
          const id = await ConversationInitPromises[documentId]!; // Using non-null assertion since we've checked it exists
          setDocumentConversationId(id);
          return;
        } catch (error) {
          // If the existing promise failed, we'll try again below
          console.error("Error waiting for existing initialization:", error);
          delete ConversationInitPromises[documentId];
        }
      }
      
      // Create a promise for this initialization and store it
      const initPromise = (async () => {
        try {
          // Try fetching existing conversations for the document
          const existingConvos = await conversationApi.getDocumentConversations(documentId);
          
          // Use the first one found, or create if none exist
          if (existingConvos && existingConvos.length > 0) {
            const id = existingConvos[0].id;
            setDocumentConversationId(id);
            storeConversationId(documentId, id);
            console.log("Using existing document conversation:", id);
            return id;
          } else {
            console.log("No existing document conversation found, creating new one...");
            // Create a document-level conversation
            const newConv = await conversationApi.create(documentId);
            const id = newConv.id;
            setDocumentConversationId(id);
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
      
      // Store the promise for coordination with other components
      ConversationInitPromises[documentId] = initPromise;
      
      try {
        await initPromise;
      } catch (error) {
        // Already logged in the inner function
      }
    };
    
    initializeDocumentConversation();
  }, [documentId]);


  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    toolbarPlugin: {
      fullScreenPlugin: {
        onEnterFullScreen: () => {},
        onExitFullScreen: () => {},
      },
      searchPlugin: {
        keyword: [''],
      },
    },

    // {/* <Print /> */}
    // {/* <ShowProperties /> */}
    // {/* <Download /> */}
    // {/* <EnterFullScreen /> */}

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
    setSelectedBlock(block);
  }, []);

  const renderOverlay = useCallback(
    (props: { pageIndex: number; scale: number; rotation: number }) => {
      const { scale, pageIndex } = props;
      
      const filteredBlocks = blocks.filter(
        (b) => b.block_type !== "Page" && (b.page_number ?? 0) === pageIndex
      );
      
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

  // Update the array name and contents to include Picture blocks
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
    "textinlinemath",
    "equation",
    "table"
  ].map(type => type.toLowerCase());

  // Update the condition name to match
  const isChatEnabled = selectedBlock?.block_type && 
    chatEnabledBlockTypes.includes(selectedBlock.block_type.toLowerCase());

  // Block navigation functions - defined after chatEnabledBlockTypes to avoid reference errors
  const handlePreviousBlock = useCallback(() => {
    if (!selectedBlock) return;
    
    // Find current block index in the flattened blocks array
    const currentIndex = flattenedBlocks.findIndex(b => b.id === selectedBlock.id);
    
    if (currentIndex > 0) {
      // Start from the previous block and find the first chat-enabled one
      let prevIndex = currentIndex - 1;
      while (prevIndex >= 0) {
        const prevBlock = flattenedBlocks[prevIndex];
        // Check if block is chat-enabled
        if (prevBlock.block_type && 
            chatEnabledBlockTypes.includes(prevBlock.block_type.toLowerCase()) &&
            (prevBlock.html_content || 
             (prevBlock.images && Object.keys(prevBlock.images).length > 0) || 
             ['picture', 'figure'].includes(prevBlock.block_type.toLowerCase()))) {
          // Found a chat-enabled block
          setSelectedBlock(prevBlock);
          return;
        }
        prevIndex--;
      }
    }
  }, [selectedBlock, flattenedBlocks, chatEnabledBlockTypes]);

  const handleNextBlock = useCallback(() => {
    if (!selectedBlock) return;
    
    // Find current block index in the flattened blocks array
    const currentIndex = flattenedBlocks.findIndex(b => b.id === selectedBlock.id);
    
    if (currentIndex < flattenedBlocks.length - 1) {
      // Start from the next block and find the first chat-enabled one
      let nextIndex = currentIndex + 1;
      while (nextIndex < flattenedBlocks.length) {
        const nextBlock = flattenedBlocks[nextIndex];
        // Check if block is chat-enabled
        if (nextBlock.block_type && 
            chatEnabledBlockTypes.includes(nextBlock.block_type.toLowerCase()) &&
            (nextBlock.html_content || 
             (nextBlock.images && Object.keys(nextBlock.images).length > 0) || 
             ['picture', 'figure'].includes(nextBlock.block_type.toLowerCase()))) {
          // Found a chat-enabled block
          setSelectedBlock(nextBlock);
          return;
        }
        nextIndex++;
      }
    }
  }, [selectedBlock, flattenedBlocks, chatEnabledBlockTypes]);
  
  // Determine if there are previous/next blocks available
  const hasPreviousBlock = useMemo(() => {
    if (!selectedBlock || flattenedBlocks.length === 0) return false;
    const currentIndex = flattenedBlocks.findIndex(b => b.id === selectedBlock.id);
    
    console.log(`[Navigation Debug] Current block: ${selectedBlock.id}, index: ${currentIndex}, type: ${selectedBlock.block_type}`);
    
    // Check if there are any previous blocks that are chat-enabled
    for (let i = currentIndex - 1; i >= 0; i--) {
      const block = flattenedBlocks[i];
      const hasValidType = block.block_type && chatEnabledBlockTypes.includes(block.block_type.toLowerCase());
      const hasContent = block.html_content || (block.images && Object.keys(block.images || {}).length > 0);
      const isImageType = ['picture', 'figure'].includes((block.block_type || '').toLowerCase());
      
      console.log(`[Navigation Debug] ← PREV Check for block id: ${block.id}, type: ${block.block_type || 'unknown'}, index: ${i}`);
      console.log(`  └─ Valid type: ${hasValidType}, Has content: ${hasContent}, Is image type: ${isImageType}`);
      
      if (hasValidType && (hasContent || isImageType)) {
        console.log(`  └─ VALID for navigation ✓`);
        return true;
      } else {
        console.log(`  └─ SKIPPED for navigation ✗`);
      }
    }
    
    console.log(`[Navigation Debug] No previous blocks found that meet criteria`);
    return false;
  }, [selectedBlock, flattenedBlocks, chatEnabledBlockTypes]);
  
  const hasNextBlock = useMemo(() => {
    if (!selectedBlock || flattenedBlocks.length === 0) return false;
    const currentIndex = flattenedBlocks.findIndex(b => b.id === selectedBlock.id);
    
    console.log(`[Navigation Debug] Current block: ${selectedBlock.id}, index: ${currentIndex}, type: ${selectedBlock.block_type}`);
    
    // Check if there are any next blocks that are chat-enabled
    for (let i = currentIndex + 1; i < flattenedBlocks.length; i++) {
      const block = flattenedBlocks[i];
      const hasValidType = block.block_type && chatEnabledBlockTypes.includes(block.block_type.toLowerCase());
      const hasContent = block.html_content || (block.images && Object.keys(block.images || {}).length > 0);
      const isImageType = ['picture', 'figure'].includes((block.block_type || '').toLowerCase());
      
      console.log(`[Navigation Debug] → NEXT Check for block id: ${block.id}, type: ${block.block_type || 'unknown'}, index: ${i}`);
      console.log(`  └─ Valid type: ${hasValidType}, Has content: ${hasContent}, Is image type: ${isImageType}`);
      
      if (hasValidType && (hasContent || isImageType)) {
        console.log(`  └─ VALID for navigation ✓`);
        return true;
      } else {
        console.log(`  └─ SKIPPED for navigation ✗`);
      }
    }
    
    console.log(`[Navigation Debug] No next blocks found that meet criteria`);
    return false;
  }, [selectedBlock, flattenedBlocks, chatEnabledBlockTypes]);



  return (
    <MathJaxProvider>
      <div className="h-screen grid overflow-hidden" style={{ 
        gridTemplateColumns: selectedBlock && isChatEnabled ? `1fr ${chatPaneWidth}px` : '1fr' 
      }}>
        {/* Left side: PDF viewer */}
        <div className="relative bg-white shadow-lg overflow-hidden">
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <div 
              style={{
                border: 'none',
                height: '100%',
                backgroundColor: 'rgb(243 244 246)',
              }}
              className="overflow-auto relative"
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
        </div>

        {/* Right side: Chat pane */}
        {selectedBlock && isChatEnabled && documentConversationId && (
          <ResizablePanel 
            width={chatPaneWidth}
            onResize={setChatPaneWidth}
          >
            <ChatPane
              key={documentConversationId}
              block={selectedBlock}
              documentId={documentId}
              conversationId={documentConversationId}
              onClose={() => setSelectedBlock(null)}
              onNextBlock={handleNextBlock}
              onPreviousBlock={handlePreviousBlock}
              hasNextBlock={hasNextBlock}
              hasPreviousBlock={hasPreviousBlock}
            />
          </ResizablePanel>
        )}
      </div>
    </MathJaxProvider>
  );
}
