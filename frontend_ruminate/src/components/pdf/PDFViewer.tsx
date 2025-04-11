"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { motion } from "framer-motion";

import ChatPane from "../chat/ChatPane"; 
import ResizablePanel from "../common/ResizablePanel";
import MathJaxProvider from "../providers/MathJaxProvider";
import RuminateButton from "../viewer/RuminateButton";
import ObjectiveSelector from "../viewer/ObjectiveSelector";
import { useRumination } from "../../hooks/useRumination";
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

// New interface for chunks
interface Chunk {
  id: string;
  document_id: string;
  title?: string;
  sequence: number;
  page_range: number[];
  block_ids: string[];
  html_content: string;
  embedding?: number[];
  summary?: string;
  metadata?: any;
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
  // New state for chunks and chunk boundary visibility
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [showChunkBoundaries, setShowChunkBoundaries] = useState(false);

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
        
        // Fetch chunks as well
        const chunksResp = await fetch(`${apiUrl}/documents/${documentId}/chunks`);
        const chunksData = await chunksResp.json();
        if (Array.isArray(chunksData)) {
          setChunks(chunksData);
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
  useEffect(() => {
    const initializeDocumentConversation = async () => {
      if (!documentId) return;
      try {
        // Try fetching existing conversations for the document
        const existingConvos = await conversationApi.getDocumentConversations(documentId);
        // Simple strategy: use the first one found, or create if none exist
        if (existingConvos && existingConvos.length > 0) {
          setDocumentConversationId(existingConvos[0].id);
          console.log("Using existing document conversation:", existingConvos[0].id);
        } else {
          console.log("No existing document conversation found, creating new one...");
          // Create a document-level conversation
          const newConv = await conversationApi.create(documentId);
          setDocumentConversationId(newConv.id);
          console.log("Created new document conversation:", newConv.id);
        }
      } catch (error) {
        console.error("Error initializing document conversation:", error);
      }
    };
    initializeDocumentConversation();
  }, [documentId]);

  const { startRumination, isRuminating, error: ruminationError, status, currentBlockId } = useRumination({ 
    documentId: documentId,
    onBlockProcessing: (blockId) => {
      if (blockId) {
        const block = blocks.find(b => b.id === blockId);
        if (block) {
          setSelectedBlock(block);
        }
      } else {
        setSelectedBlock(null);
      }
    }
  });

  const [currentObjective, setCurrentObjective] = useState("Focus on key vocabulary and jargon that a novice reader would not be familiar with.");

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

              {/* Ruminate Button - Centered */}
              {documentId && (
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <RuminateButton
                    isRuminating={isRuminating}
                    error={ruminationError}
                    status={status}
                    onRuminate={() => startRumination(currentObjective)}
                  />
                  <span className="text-neutral-600">on</span>
                  <ObjectiveSelector onObjectiveChange={setCurrentObjective} />
                </div>
              )}

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
            const isCurrentlyProcessing = currentBlockId === b.id;
            
            // Determine the chunk for this block
            const chunkForBlock = showChunkBoundaries ? 
              chunks.find(chunk => chunk.block_ids.includes(b.id)) : 
              undefined;
            
            // Determine if this is a chunk boundary (last block in a chunk)
            const isChunkBoundary = showChunkBoundaries && chunkForBlock ? 
              chunkForBlock.block_ids[chunkForBlock.block_ids.length - 1] === b.id : 
              false;
            
            // Determine the block's status
            let blockStatus = '';
            let animation = {};
            if (isCurrentlyProcessing) {
              blockStatus = 'processing';
              animation = {
                boxShadow: [
                  '0 0 0px rgba(59, 130, 246, 0)',
                  '0 0 15px rgba(59, 130, 246, 0.3)',
                  '0 0 0px rgba(59, 130, 246, 0)'
                ]
              };
            } else if (isSelected) {
              blockStatus = 'selected';
            }

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
                zIndex: isSelected || isCurrentlyProcessing ? 2 : 1,
                borderRadius: '2px',
              };

              // Add chunk boundary styling if needed
              if (isChunkBoundary) {
                return {
                  ...baseStyle,
                  borderBottom: '3px dashed rgba(255, 0, 0, 0.7)',
                };
              }

              if (isCurrentlyProcessing) {
                return {
                  ...baseStyle,
                  border: '2px solid rgba(59, 130, 246, 0.8)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                };
              }
              
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
                animate={isCurrentlyProcessing ? {
                  boxShadow: [
                    '0 0 0px rgba(59, 130, 246, 0)',
                    '0 0 15px rgba(59, 130, 246, 0.3)',
                    '0 0 0px rgba(59, 130, 246, 0)'
                  ]
                } : {}}
                transition={isCurrentlyProcessing ? { duration: 2, repeat: Infinity } : {}}
              >
                {/* Processing indicator */}
                {isCurrentlyProcessing && (
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 -left-6 w-4 h-4 bg-primary-500 rounded-full"
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                  />
                )}
                
                {/* Optional: Show a checkmark or other indicator for processed blocks */}
                {!isCurrentlyProcessing && blockStatus && (
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
    [blocks, selectedBlock, currentBlockId, handleBlockClick, showChunkBoundaries, chunks]
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

  // Add state for chat pane width
  const [chatPaneWidth, setChatPaneWidth] = useState(384);

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
              {/* Add a control toolbar at the top */}
              <div className="absolute top-0 right-0 z-10 flex items-center bg-white/80 backdrop-blur-sm p-1 m-2 rounded-md shadow-sm">
                <label className="flex items-center space-x-2 text-sm cursor-pointer px-2 py-1">
                  <input 
                    type="checkbox" 
                    checked={showChunkBoundaries} 
                    onChange={() => setShowChunkBoundaries(!showChunkBoundaries)}
                    className="form-checkbox h-4 w-4 text-primary-600"
                  />
                  <span>Show Chunk Boundaries</span>
                </label>
              </div>

              {/* Scanning effect overlay */}
              {isRuminating && (
                <motion.div
                  className="fixed inset-0 pointer-events-none"
                  style={{ zIndex: 10 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <motion.div
                      className="absolute inset-x-0 h-[200%] bg-gradient-to-b from-transparent via-primary-500/5 to-transparent"
                      animate={{
                        y: ["-50%", "0%", "-50%"]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                  </div>
                </motion.div>
              )}

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
              key={`${documentConversationId}-${selectedBlock.id}`}
              block={selectedBlock}
              documentId={documentId}
              conversationId={documentConversationId}
              onClose={() => setSelectedBlock(null)}
            />
          </ResizablePanel>
        )}
      </div>
    </MathJaxProvider>
  );
}
