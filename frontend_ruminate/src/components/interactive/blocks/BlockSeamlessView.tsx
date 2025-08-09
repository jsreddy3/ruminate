import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { Block } from '../../pdf/PDFViewer';
import { TextInteractionProvider } from './text/TextInteractionContext';
import GlobalTextOverlay from './text/GlobalTextOverlay';
import { blocksActions, useBlocksSelector, useCurrentBlockId } from '../../../store/blocksStore';
import { useDocumentEnhancements } from '../../../hooks/useDocumentEnhancements';
import SeamlessBlockRow from './SeamlessBlockRow';

interface BlockSeamlessViewProps {
  blocks: Block[];
  currentBlockId: string;
  documentId: string;
  onBlockChange: (block: Block) => void;
  onAddTextToChat?: (text: string, blockId?: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  className?: string;
  isArrowNavigationRef?: { current: boolean };
}

export default function BlockSeamlessView({
  blocks,
  currentBlockId,
  documentId,
  onBlockChange,
  onAddTextToChat,
  onRabbitholeClick,
  className = '',
  isArrowNavigationRef
}: BlockSeamlessViewProps) {
  // Data layer - manages ALL enhancements for this document
  const { createRabbithole, createDefinition, createAnnotation, deleteEnhancement } = useDocumentEnhancements(documentId);

  // Initialize store once when inputs arrive
  useEffect(() => {
    if (blocks && blocks.length > 0) {
      blocksActions.initialize(blocks, currentBlockId);
    }
  }, [blocks, currentBlockId]);


  const storeCurrentBlockId = useCurrentBlockId();
  const effectiveCurrentBlockId = storeCurrentBlockId || currentBlockId;
  const blockOrder = useBlocksSelector((s) => s.blockOrder, (a, b) => a.length === b.length && a.every((v, i) => v === b[i]));

  const containerRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<HTMLDivElement>(null);

  // Smart windowing with both top and bottom boundaries
  const INITIAL_COUNT = 20;
  const STEP_COUNT = 15;
  const MAX_WINDOW_SIZE = 60; // Maximum blocks to render at once
  const BUFFER_SIZE = 5; // Blocks to keep around focused block
  
  // Window state with start and end indices
  const getInitialWindow = useCallback(() => {
    const focusedIndex = blockOrder.findIndex(id => id === effectiveCurrentBlockId);
    if (focusedIndex === -1) {
      return { start: 0, end: Math.min(blockOrder.length, INITIAL_COUNT) };
    }
    
    // Center window around focused block
    const start = Math.max(0, focusedIndex - Math.floor(INITIAL_COUNT / 2));
    const end = Math.min(blockOrder.length, start + INITIAL_COUNT);
    return { start, end };
  }, [blockOrder, effectiveCurrentBlockId]);
  
  const [windowState, setWindowState] = useState(() => getInitialWindow());

  // Reset window when document changes
  useEffect(() => {
    setWindowState(getInitialWindow());
  }, [blockOrder.length, getInitialWindow]);

  const windowedIds = useMemo(() => 
    blockOrder.slice(windowState.start, windowState.end), 
    [blockOrder, windowState.start, windowState.end]
  );

  // stable style object
  const baseStyle = useMemo(() => ({
    seamless: true as const,
    background: 'transparent',
    backgroundColor: 'transparent',
    border: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
    borderBottom: 'none',
    borderRadius: 0,
    boxShadow: 'none',
    padding: 0,
    margin: 0,
    fontSize: '1.25rem'
  }), []);

  // Track if this is the initial mount
  const isInitialMount = useRef(true);
  
  // Scroll state for programmatic scroll detection
  const lastScrollTop = useRef(0);
  const programmaticScrollTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Smart scroll to keep focused block in comfortable view
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = containerRef.current;
      const focused = focusedRef.current;
      if (!container || !focused) return;

      const viewport = container.clientHeight;
      const currentScrollTop = container.scrollTop;
      const blockTop = focused.offsetTop;
      const blockBottom = blockTop + focused.offsetHeight;
      const viewportTop = currentScrollTop;
      const viewportBottom = currentScrollTop + viewport;
      
      // Only scroll if block is not comfortably visible
      const topBuffer = viewport * 0.15;    // 15% from top
      const bottomBuffer = viewport * 0.15; // 15% from bottom
      
      let newScrollTop = currentScrollTop;
      let shouldScroll = false;
      
      // Block is above viewport or too close to top
      if (blockTop < viewportTop + topBuffer) {
        newScrollTop = blockTop - topBuffer;
        shouldScroll = true;
      }
      // Block is below viewport or too close to bottom
      else if (blockBottom > viewportBottom - bottomBuffer) {
        newScrollTop = blockBottom - viewport + bottomBuffer;
        shouldScroll = true;
      }
      
      // Only scroll if there's a meaningful difference (avoid micro-adjustments)
      if (shouldScroll && Math.abs(newScrollTop - currentScrollTop) > 10) {
        // Clamp scroll position to valid range
        newScrollTop = Math.max(0, Math.min(container.scrollHeight - viewport, newScrollTop));
        
        container.scrollTo({ 
          top: newScrollTop, 
          behavior: isInitialMount.current ? 'auto' : 'smooth' 
        });
        
        // Mark this as a programmatic scroll
        if (programmaticScrollTimer.current) {
          clearTimeout(programmaticScrollTimer.current);
        }
        programmaticScrollTimer.current = setTimeout(() => {
          programmaticScrollTimer.current = null;
        }, 500); // Longer timeout for smooth scroll
        
        // Update scroll position reference after animation
        setTimeout(() => {
          if (container) {
            lastScrollTop.current = container.scrollTop;
          }
        }, 600);
      }
      
      isInitialMount.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [effectiveCurrentBlockId]);

  const handleFocusChange = useCallback((block: Block) => {
    const blockIndex = blockOrder.findIndex(id => id === block.id);
    const isProblematicBlock = block.id === '5f50d3a1-8d40-4c9c-abef-11589f961fed';
    
    console.log('[SeamlessView] Focus change requested:', {
      newBlockId: block.id,
      blockType: block.block_type,
      previousBlockId: effectiveCurrentBlockId,
      blockIndex,
      totalBlocks: blockOrder.length,
      blockContent: block.html_content?.substring(0, 100) + '...',
      isProblematicBlock,
      blockExistsInOrder: blockIndex !== -1,
      timestamp: new Date().toISOString()
    });
    
    // Special logging for the problematic block
    if (isProblematicBlock) {
      console.error('[SeamlessView] PROBLEMATIC BLOCK DETECTED - investigating:', {
        blockId: block.id,
        blockExists: !!block,
        blockInOrder: blockIndex,
        blockOrderLength: blockOrder.length,
        blockOrder: blockOrder.slice(0, 10), // First 10 for debugging
        currentEffectiveBlockId: effectiveCurrentBlockId,
        callStack: new Error().stack
      });
    }
    
    blocksActions.setCurrentBlockId(block.id);
    onBlockChange?.(block);
  }, [onBlockChange, effectiveCurrentBlockId, blockOrder]);

  // Smart windowing expansion
  const lastLoadRef = useRef<number>(0);
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, clientHeight, scrollHeight } = container;
    const threshold = 400;
    
    const now = Date.now();
    if (now - lastLoadRef.current < 150) return; // Throttle updates
    
    setWindowState(prev => {
      let { start, end } = prev;
      let shouldUpdate = false;
      
      // Expand window when near bottom
      if (scrollTop + clientHeight >= scrollHeight - threshold && end < blockOrder.length) {
        end = Math.min(blockOrder.length, end + STEP_COUNT);
        shouldUpdate = true;
        lastLoadRef.current = now;
      }
      
      // Expand window when near top
      if (scrollTop <= threshold && start > 0) {
        start = Math.max(0, start - STEP_COUNT);
        shouldUpdate = true;
        lastLoadRef.current = now;
      }
      
      // Prune window if it gets too large (keep focused block in center)
      const windowSize = end - start;
      if (windowSize > MAX_WINDOW_SIZE) {
        const focusedIndex = blockOrder.findIndex(id => id === effectiveCurrentBlockId);
        if (focusedIndex >= 0) {
          // Keep focused block in center, prune equally from both sides
          const half = Math.floor(MAX_WINDOW_SIZE / 2);
          start = Math.max(0, focusedIndex - half);
          end = Math.min(blockOrder.length, focusedIndex + half);
          shouldUpdate = true;
        }
      }
      
      return shouldUpdate ? { start, end } : prev;
    });
    
    // Check if this scroll was triggered by arrow navigation or programmatic scroll
    if (isArrowNavigationRef?.current || programmaticScrollTimer.current) {
      // If arrow navigation, reset the flag after a delay to ensure smooth scrolling completes
      if (isArrowNavigationRef?.current) {
        setTimeout(() => {
          if (isArrowNavigationRef) {
            isArrowNavigationRef.current = false;
          }
        }, 500); // Give time for smooth scroll to complete
      }
      lastScrollTop.current = scrollTop;
      return;
    }
    
    // Just update scroll position reference for other systems
    lastScrollTop.current = scrollTop;
  }, [blockOrder.length, windowState.start, windowState.end, effectiveCurrentBlockId, blocks, handleFocusChange]);

  const handleCreateRabbithole = useCallback(async (
    blockId: string,
    text: string,
    start: number,
    end: number
  ) => {
    try {
      const conversationId = await createRabbithole(blockId, text, start, end);
      onRabbitholeClick?.(conversationId, text, start, end);
    } catch (e) {
      console.error('[Seamless] rabbithole create failed', e);
    }
  }, [createRabbithole, onRabbitholeClick]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (programmaticScrollTimer.current) {
        clearTimeout(programmaticScrollTimer.current);
      }
    };
  }, []);
  
  return (
    <TextInteractionProvider>
      <div ref={containerRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 ${className}`}>
        <div className="mx-auto max-w-[70ch] px-6 py-10 space-y-6">
          {windowedIds.map((blockId) => (
            <SeamlessBlockRow
              key={blockId}
              blockId={blockId}
              isFocused={blockId === effectiveCurrentBlockId}
              focusedRef={focusedRef}
              documentId={documentId}
              baseStyle={baseStyle}
              onFocusChange={handleFocusChange}
              onAddTextToChat={onAddTextToChat}
              onRabbitholeClick={onRabbitholeClick}
              onCreateRabbithole={(text: string, start: number, end: number) =>
                handleCreateRabbithole(blockId, text, start, end)
              }
              onCreateDefinition={createDefinition}
              onCreateAnnotation={createAnnotation}
              onDeleteEnhancement={deleteEnhancement}
            />
          ))}
        </div>
      </div>
      <GlobalTextOverlay
        onAddToChat={(_docId: string, blockId: string, text: string) => onAddTextToChat?.(text, blockId)}
        onCreateRabbithole={(_docId: string, blockId: string, text: string, start: number, end: number) =>
          handleCreateRabbithole(blockId, text, start, end)
        }
        onCreateDefinition={createDefinition}
        onCreateAnnotation={createAnnotation}
      />
    </TextInteractionProvider>
  );
} 