import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Block } from './PDFViewer';
import BlockIndicators, { BlockDotIndicators } from './BlockIndicators';
import { isBlockNavigable } from '../../utils/blockFiltering';
import { PDFBlockItem } from './PDFBlockItem';

interface PDFBlockOverlayProps {
  blocks: Block[];
  selectedBlock: Block | null;
  pageIndex: number;
  scale: number;
  onBlockClick: (block: Block) => void;
  isSelectionMode?: boolean;
  onBlockSelect?: (blockId: string) => void;
  temporarilyHighlightedBlockId?: string | null;
  onboardingTargetBlockId?: string | null;
  isOnboardingActive?: boolean;
}

export default function PDFBlockOverlay({
  blocks,
  selectedBlock,
  pageIndex,
  scale,
  onBlockClick,
  isSelectionMode = false,
  onBlockSelect,
  temporarilyHighlightedBlockId,
  onboardingTargetBlockId,
  isOnboardingActive = false
}: PDFBlockOverlayProps) {
  // Track renders
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;
  
  // Blocks are now pre-filtered by the parent component
  const filteredBlocks = blocks;

  return (
    <>
      <style jsx global>{`
        @keyframes onboardingGoldenPulse {
          0% {
            background-color: rgba(251, 191, 36, 0.15);
          }
          50% {
            background-color: rgba(251, 191, 36, 0.35);
          }
          100% {
            background-color: rgba(251, 191, 36, 0.15);
          }
        }
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
      `}</style>
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
        const isSelected = selectedBlock?.id === block.id;
        const isTemporarilyHighlighted = temporarilyHighlightedBlockId === block.id;
        const isOnboardingTarget = onboardingTargetBlockId === block.id;

        return (
          <PDFBlockItem
            key={block.id}
            block={block}
            scale={scale}
            isSelected={isSelected}
            isTemporarilyHighlighted={isTemporarilyHighlighted}
            isOnboardingTarget={isOnboardingTarget}
            isOnboardingActive={isOnboardingActive}
            isSelectionMode={isSelectionMode}
            onBlockClick={onBlockClick}
            onBlockSelect={onBlockSelect}
          />
        );
      })}
      </div>
    </>
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