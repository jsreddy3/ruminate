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

  // Incremental render window (bottom-only growth)
  const INITIAL_COUNT = 20;
  const STEP_COUNT = 20;
  
  // Calculate initial endIndex to ensure focused block is included
  const getInitialEndIndex = useCallback(() => {
    const focusedIndex = blockOrder.findIndex(id => id === effectiveCurrentBlockId);
    if (focusedIndex === -1) {
      return Math.min(blockOrder.length, INITIAL_COUNT);
    }
    // Ensure we render at least up to the focused block + some buffer
    return Math.min(blockOrder.length, Math.max(INITIAL_COUNT, focusedIndex + 10));
  }, [blockOrder, effectiveCurrentBlockId]);
  
  const [endIndex, setEndIndex] = useState<number>(() => getInitialEndIndex());

  // Reset endIndex when document changes, ensuring focused block is visible
  useEffect(() => {
    setEndIndex(getInitialEndIndex());
  }, [blockOrder.length, getInitialEndIndex]);

  const windowedIds = useMemo(() => blockOrder.slice(0, endIndex), [blockOrder, endIndex]);

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
  
  // Scroll navigation state
  const lastScrollTop = useRef(0);
  const scrollDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingByScroll = useRef(false);
  const programmaticScrollTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Smoothly keep focused block near the top as it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = containerRef.current;
      const focused = focusedRef.current;
      if (!container || !focused) return;

      const viewport = container.clientHeight;
      const targetTop = viewport * 0.15;
      const blockTop = focused.offsetTop;
      const scrollTop = blockTop - targetTop;
      
      // On initial mount, scroll immediately without animation
      // On subsequent changes, use smooth scrolling
      container.scrollTo({ 
        top: scrollTop, 
        behavior: isInitialMount.current ? 'auto' : 'smooth' 
      });
      
      // Mark this as a programmatic scroll to prevent auto-focus
      if (programmaticScrollTimer.current) {
        clearTimeout(programmaticScrollTimer.current);
      }
      programmaticScrollTimer.current = setTimeout(() => {
        programmaticScrollTimer.current = null;
      }, 300);
      
      // Update scroll position reference after programmatic scroll
      setTimeout(() => {
        if (container) {
          lastScrollTop.current = container.scrollTop;
        }
      }, 100);
      
      isInitialMount.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [effectiveCurrentBlockId]);

  const handleFocusChange = useCallback((block: Block) => {
    blocksActions.setCurrentBlockId(block.id);
    onBlockChange?.(block);
  }, [onBlockChange]);

  // Load more when near bottom
  const lastLoadRef = useRef<number>(0);
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, clientHeight, scrollHeight } = container;
    const threshold = 400;
    
    // Load more blocks when near bottom
    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      const now = Date.now();
      if (now - lastLoadRef.current < 150) return;
      lastLoadRef.current = now;
      if (endIndex < blockOrder.length) {
        setEndIndex((prev) => Math.min(blockOrder.length, prev + STEP_COUNT));
      }
    }
    
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
    
    // Scroll-based navigation with debouncing - focus on block where scrolling stops
    if (!isNavigatingByScroll.current) {
      // Clear existing timer on every scroll
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
      
      // Set new debounced navigation
      scrollDebounceTimer.current = setTimeout(() => {
        // Find which block is most visible in the viewport
        const viewport = container.clientHeight;
        const viewportCenter = scrollTop + (viewport / 2);
        
        // Find all block elements
        const blockElements = container.querySelectorAll('[data-block-id]');
        let closestBlock: { element: Element; distance: number; id: string } | null = null;
        
        blockElements.forEach((element) => {
          const blockId = element.getAttribute('data-block-id');
          if (!blockId) return;
          
          const htmlElement = element as HTMLElement;
          const rect = htmlElement.getBoundingClientRect();
          const elementTop = htmlElement.offsetTop;
          const elementCenter = elementTop + (rect.height / 2);
          const distance = Math.abs(viewportCenter - elementCenter);
          
          if (!closestBlock || distance < closestBlock.distance) {
            closestBlock = { element: htmlElement, distance, id: blockId };
          }
        });
        
        // Focus on the closest block if it's different from current
        if (closestBlock && closestBlock.id !== effectiveCurrentBlockId) {
          const targetBlock = blocks.find(b => b.id === closestBlock.id);
          if (targetBlock) {
            isNavigatingByScroll.current = true;
            handleFocusChange(targetBlock);
            setTimeout(() => {
              isNavigatingByScroll.current = false;
            }, 300);
          }
        }
        
        lastScrollTop.current = scrollTop;
      }, 150); // 150ms debounce delay
    }
  }, [blockOrder.length, endIndex, windowedIds, effectiveCurrentBlockId, blocks, handleFocusChange]);

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
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
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