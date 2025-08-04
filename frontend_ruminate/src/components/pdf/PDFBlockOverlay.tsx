import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Block } from './PDFViewer';
import BlockIndicators, { BlockDotIndicators } from './BlockIndicators';
import { PDFTourDialogue } from '../onboarding/PDFTourDialogue';

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
  // Blocks are now pre-filtered by the parent component
  const filteredBlocks = blocks;

  // State to track onboarding target block rectangle
  const [targetBlockRect, setTargetBlockRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Update target block rect when onboarding target changes
  useEffect(() => {
    if (onboardingTargetBlockId && isOnboardingActive) {
      const targetBlock = filteredBlocks.find(b => b.id === onboardingTargetBlockId);
      if (targetBlock && targetBlock.polygon && targetBlock.polygon.length >= 4) {
        const x = Math.min(...targetBlock.polygon.map((p) => p[0]));
        const y = Math.min(...targetBlock.polygon.map((p) => p[1]));
        const w = Math.max(...targetBlock.polygon.map((p) => p[0])) - x;
        const h = Math.max(...targetBlock.polygon.map((p) => p[1])) - y;
        
        const rect = {
          x: x * scale,
          y: y * scale,
          width: w * scale,
          height: h * scale
        };
        setTargetBlockRect(rect);
      }
    } else {
      setTargetBlockRect(null);
    }
  }, [onboardingTargetBlockId, isOnboardingActive, filteredBlocks, scale]);

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
        if (!block.polygon || block.polygon.length < 4) return null;
        
        // Calculate bounding box from polygon
        const x = Math.min(...block.polygon.map((p) => p[0]));
        const y = Math.min(...block.polygon.map((p) => p[1]));
        const w = Math.max(...block.polygon.map((p) => p[0])) - x;
        const h = Math.max(...block.polygon.map((p) => p[1])) - y;

        const isSelected = selectedBlock?.id === block.id;
        const isTemporarilyHighlighted = temporarilyHighlightedBlockId === block.id;
        const isOnboardingTarget = onboardingTargetBlockId === block.id;

        // Get the appropriate styling based on status
        const getBlockStyle = () => {
          const baseStyle = {
            position: "absolute" as const,
            left: `${x * scale}px`,
            top: `${y * scale}px`,
            width: `${w * scale}px`,
            height: `${h * scale}px`,
            cursor: isOnboardingActive && !isOnboardingTarget ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease-out',
            zIndex: isOnboardingTarget ? 10 : isSelected ? 3 : 1,
            borderRadius: '4px',
            pointerEvents: (isOnboardingActive && !isOnboardingTarget) ? 'none' as const : 'auto' as const,
          };

          // Onboarding target styling - HEAVY glowing golden effect
          if (isOnboardingTarget) {
            return {
              ...baseStyle,
              backgroundColor: 'rgba(249, 207, 95, 0.4)',
              border: '4px solid #f9cf5f',
              boxShadow: `
                0 0 40px rgba(249, 207, 95, 1),
                0 0 80px rgba(249, 207, 95, 0.9),
                0 0 120px rgba(249, 207, 95, 0.7),
                0 0 160px rgba(249, 207, 95, 0.5),
                inset 0 0 30px rgba(249, 207, 95, 0.5),
                inset 0 0 60px rgba(249, 207, 95, 0.3)
              `,
              animation: 'glow 2s ease-in-out infinite',
              outline: '6px solid rgba(249, 207, 95, 0.3)',
              outlineOffset: '2px',
              filter: 'brightness(1.2)',
              transform: `scale(1.05)`,
            };
          }

          // During onboarding, non-target blocks are dimmed
          if (isOnboardingActive && !isOnboardingTarget) {
            return {
              ...baseStyle,
              opacity: 0.3,
              backgroundColor: 'transparent',
              border: 'none',
            };
          }

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

          // Base state - invisible until hover or temporarily highlighted
          return {
            ...baseStyle,
            backgroundColor: isTemporarilyHighlighted ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
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
              if (!isSelected && !isSelectionMode && !isOnboardingTarget) {
                e.currentTarget.style.backgroundColor = 'rgba(251, 191, 36, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected && !isSelectionMode && !isTemporarilyHighlighted && !isOnboardingTarget) {
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
              conversationsData={block.metadata?.rabbithole_conversation_ids}
              definitionsData={block.metadata?.definitions}
              annotationsData={userAnnotations}
              generatedNotesData={generatedNotes}
              onConversationClick={(conversationId) => {
                // First open the block
                onBlockClick(block);
                // Then simulate clicking the first rabbithole highlight after a delay
                setTimeout(() => {
                  const rabbitholeElement = document.querySelector('.rabbithole-highlight-clickable');
                  if (rabbitholeElement) {
                    (rabbitholeElement as HTMLElement).click();
                  }
                }, 500);
              }}
              onDefinitionClick={(key, definition) => {
                // First open the block
                onBlockClick(block);
                // Then simulate clicking the first definition highlight after a delay
                setTimeout(() => {
                  const definitionElement = document.querySelector('.definition-highlight-clickable');
                  if (definitionElement) {
                    (definitionElement as HTMLElement).click();
                  }
                }, 500);
              }}
              onAnnotationClick={(annotation) => {
                // First open the block
                onBlockClick(block);
                // Then simulate clicking the first annotation highlight after a delay
                setTimeout(() => {
                  const annotationElement = document.querySelector('.annotation-highlight-clickable');
                  if (annotationElement) {
                    (annotationElement as HTMLElement).click();
                  }
                }, 500);
              }}
              onGeneratedNoteClick={(note) => {
                // First open the block
                onBlockClick(block);
                // Then simulate clicking the first generated note badge after a delay
                setTimeout(() => {
                  const generatedNoteElement = document.querySelector('button[title*="Generated note"], button svg[class*="lucide-lightbulb"]')?.closest('button');
                  if (generatedNoteElement) {
                    (generatedNoteElement as HTMLElement).click();
                  }
                }, 500);
              }}
              position="top-right"
            />
          </motion.div>
        );
      })}
      </div>
      
      {/* Onboarding dialogue */}
      <PDFTourDialogue
        isVisible={isOnboardingActive && !!onboardingTargetBlockId}
        targetRect={targetBlockRect}
        scale={scale}
      />
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