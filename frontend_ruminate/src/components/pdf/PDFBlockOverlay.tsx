import React from 'react';
import { motion } from 'framer-motion';
import { Block } from './PDFViewer';
import BlockIndicators, { BlockDotIndicators } from './BlockIndicators';

interface PDFBlockOverlayProps {
  blocks: Block[];
  selectedBlock: Block | null;
  pageIndex: number;
  scale: number;
  onBlockClick: (block: Block) => void;
  isSelectionMode?: boolean;
  onBlockSelect?: (blockId: string) => void;
}

export default function PDFBlockOverlay({
  blocks,
  selectedBlock,
  pageIndex,
  scale,
  onBlockClick,
  isSelectionMode = false,
  onBlockSelect
}: PDFBlockOverlayProps) {
  // Filter blocks for current page
  const filteredBlocks = blocks.filter((b) => {
    const blockPageNumber = b.page_number ?? 0;
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
      {filteredBlocks.map((block) => {
        if (!block.polygon || block.polygon.length < 4) return null;
        
        // Calculate bounding box from polygon
        const x = Math.min(...block.polygon.map((p) => p[0]));
        const y = Math.min(...block.polygon.map((p) => p[1]));
        const w = Math.max(...block.polygon.map((p) => p[0])) - x;
        const h = Math.max(...block.polygon.map((p) => p[1])) - y;

        const isSelected = selectedBlock?.id === block.id;

        // Get the appropriate styling based on status
        const getBlockStyle = () => {
          const baseStyle = {
            position: "absolute" as const,
            left: `${x * scale}px`,
            top: `${y * scale}px`,
            width: `${w * scale}px`,
            height: `${h * scale}px`,
            cursor: 'pointer',
            transition: 'all 0.3s ease-out',
            zIndex: isSelected ? 3 : 1,
            borderRadius: '4px',
          };

          // Selection mode styling - warm highlight
          if (isSelectionMode) {
            return {
              ...baseStyle,
              backgroundColor: 'rgba(251, 146, 60, 0.1)',
              border: '2px solid rgba(251, 146, 60, 0.3)',
            };
          }

          // Normal mode styling - focused state clean like hover
          if (isSelected) {
            return {
              ...baseStyle,
              backgroundColor: 'rgba(251, 191, 36, 0.2)',
              border: '2px solid rgba(245, 158, 11, 0.6)',
            };
          }

          // Base state - completely invisible until hover
          return {
            ...baseStyle,
            backgroundColor: 'transparent',
            border: 'none',
          };
        };

        // Check for metadata
        const hasDefinitions = block.metadata?.definitions && Object.keys(block.metadata.definitions).length > 0;
        const definitionCount = hasDefinitions ? Object.keys(block.metadata.definitions).length : 0;
        
        // Check for conversations (rabbitholes)
        const hasConversations = block.metadata?.rabbithole_conversation_ids && block.metadata.rabbithole_conversation_ids.length > 0;
        const conversationCount = hasConversations ? block.metadata.rabbithole_conversation_ids.length : 0;

        // Check for annotations - separate generated notes from user annotations
        const allAnnotations = block.metadata?.annotations || {};
        
        // Generated notes have is_generated: true and text_start_offset: -1
        const generatedNotes = Object.values(allAnnotations).filter((ann: any) => 
          ann.is_generated === true && ann.text_start_offset === -1
        );
        
        // User annotations are regular annotations (not generated)
        const userAnnotations = Object.values(allAnnotations).filter((ann: any) => 
          !ann.is_generated && ann.text_start_offset !== -1
        );
        
        const hasGeneratedNotes = generatedNotes.length > 0;
        const hasAnnotations = userAnnotations.length > 0;
        const generatedNoteCount = generatedNotes.length;
        const annotationCount = userAnnotations.length;

        // Handle click based on mode
        const handleClick = () => {
          if (isSelectionMode && onBlockSelect) {
            onBlockSelect(block.id);
          } else {
            onBlockClick(block);
          }
        };

        // Dynamic hover classes for proximity-based reveal
        const hoverClasses = isSelectionMode 
          ? "hover:!bg-orange-100/30 hover:!border hover:!border-orange-400/60 hover:!border-solid"
          : "hover:!bg-amber-50/60 hover:!border hover:!border-amber-400/40 hover:!border-solid";

        // Check if block has any interactive content to add breathing effect
        const hasInteractiveContent = hasConversations || hasDefinitions || hasAnnotations || hasGeneratedNotes;

        return (
          <motion.div
            key={block.id}
            data-block-id={block.id}
            style={getBlockStyle()}
            className="group"
            onMouseEnter={(e) => {
              if (!isSelected && !isSelectionMode) {
                e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected && !isSelectionMode) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            onClick={handleClick}
            title={
              isSelectionMode 
                ? `Click to select this block for your note: ${block.html_content?.replace(/<[^>]*>/g, "").substring(0, 100)}...`
                : block.html_content?.replace(/<[^>]*>/g, "") || ""
            }
            animate={{}}
            transition={{}}
          >
            {/* Selection mode indicator or normal selected indicator */}
            {isSelectionMode ? (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg backdrop-blur-sm bg-opacity-90">
                  Select
                </div>
              </div>
            ) : isSelected && (
              <motion.div 
                className="absolute top-1/2 -translate-y-1/2 -left-8"
                initial={{ scale: 0, x: 10 }}
                animate={{ scale: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-lg flex items-center justify-center border border-amber-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                </div>
              </motion.div>
            )}
            
            {/* Metadata indicators - always visible */}
            <BlockIndicators
              hasConversations={hasConversations}
              hasDefinitions={hasDefinitions}
              hasAnnotations={hasAnnotations}
              hasGeneratedNotes={hasGeneratedNotes}
              conversationCount={conversationCount}
              definitionCount={definitionCount}
              annotationCount={annotationCount}
              generatedNoteCount={generatedNoteCount}
              position="top-right"
            />
          </motion.div>
        );
      })}
    </div>
  );
}

// Configuration options for different indicator styles
export const PDFBlockOverlayConfig = {
  // Use 'full' for full indicators with icons, 'dots' for minimal dots
  indicatorStyle: 'full' as 'full' | 'dots',
  // Position of indicators relative to blocks
  indicatorPosition: 'top-right' as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
  // Whether to show indicators on hover only
  showIndicatorsOnHoverOnly: false,
};