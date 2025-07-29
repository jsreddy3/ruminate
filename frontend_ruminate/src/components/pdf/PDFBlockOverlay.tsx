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
}

export default function PDFBlockOverlay({
  blocks,
  selectedBlock,
  pageIndex,
  scale,
  onBlockClick
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

        // Check for metadata
        const hasDefinitions = block.metadata?.definitions && Object.keys(block.metadata.definitions).length > 0;
        const definitionCount = hasDefinitions ? Object.keys(block.metadata.definitions).length : 0;
        
        // Check for conversations (rabbitholes)
        const hasConversations = block.metadata?.rabbithole_conversation_ids && block.metadata.rabbithole_conversation_ids.length > 0;
        const conversationCount = hasConversations ? block.metadata.rabbithole_conversation_ids.length : 0;

        return (
          <motion.div
            key={block.id}
            style={getBlockStyle()}
            className="hover:bg-primary-100/10 hover:border-primary-400 hover:shadow-block-hover group"
            onClick={() => onBlockClick(block)}
            title={block.html_content?.replace(/<[^>]*>/g, "") || ""}
          >
            {/* Optional: Show a dot indicator for selected blocks */}
            {isSelected && (
              <div className="absolute top-1/2 -translate-y-1/2 -left-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-500" />
                </div>
              </div>
            )}
            
            {/* Metadata indicators */}
            <BlockIndicators
              hasConversations={hasConversations}
              hasDefinitions={hasDefinitions}
              conversationCount={conversationCount}
              definitionCount={definitionCount}
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