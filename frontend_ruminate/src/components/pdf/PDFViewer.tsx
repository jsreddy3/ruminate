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
  const [agentConversationId, setAgentConversationId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [showAgentChat, setShowAgentChat] = useState<boolean>(false);
  
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
  
  // Function to toggle the agent chat view
  const handleAgentClick = useCallback(() => {
    if (selectedBlock) {
      setShowAgentChat(!showAgentChat);
    }
  }, [selectedBlock, showAgentChat]);

  const renderOverlay = useCallback(
    (props: { pageIndex: number; scale: number; rotation: number }) => {
      const { scale, pageIndex } = props;

      const filteredBlocks = blocks.filter(
        (b) => b.block_type !== "Page" && (b.page_number ?? 0) === pageIndex + 1
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

  return (
    <MathJaxProvider>
      <div className="h-screen flex w-full overflow-hidden">
        {/* PDF viewer */}
        <div className={`${showChat ? 'w-2/3' : 'flex-1'} bg-white shadow-lg overflow-hidden transition-all duration-300 ease-in-out`}>
          <div className="h-full w-full">
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
                  )
                },
              ]}
              activeTabId={activeTabId}
              onTabChange={setActiveTabId}
              className="h-full"
            />
          </div>
        </div>
        
        {/* Chat panel */}
        {showChat && (
          <div className="w-1/3 border-l border-gray-200 flex flex-col h-full">
            {/* Main chat or agent chat toggle */}
            <div className="border-b border-gray-200 p-2 flex">
              <button 
                className={`flex-1 py-2 text-center text-sm rounded-l-md ${!showAgentChat ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                onClick={() => setShowAgentChat(false)}
              >
                Chat
              </button>
              <button 
                className={`flex-1 py-2 text-center text-sm rounded-r-md ${showAgentChat ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                onClick={handleAgentClick}
                disabled={!selectedBlock}
              >
                Agent
              </button>
            </div>
            
            {/* Chat container - show either regular or agent chat */}
            <div className="flex-1 overflow-hidden">
              {showAgentChat ? (
                <ChatContainer 
                  documentId={documentId}
                  selectedBlock={selectedBlock}
                  isAgentChat={true}
                  conversationId={agentConversationId || undefined}
                  onClose={() => setShowAgentChat(false)}
                  onConversationCreated={(id) => setAgentConversationId(id)}
                />
              ) : (
                <ChatContainer 
                  documentId={documentId}
                  selectedBlock={selectedBlock}
                  isAgentChat={false}
                  conversationId={mainConversationId || undefined}
                  onClose={() => setShowChat(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </MathJaxProvider>
  );
}
