import { useEffect, useRef, useCallback } from 'react';

interface Block {
  id: string;
  html_content?: string;
  page_number?: number;
}

interface UseViewportReadingTrackerProps {
  blocks: Block[];
  flattenedBlocks: Block[];
  onProgressUpdate: (blockId: string) => void;
  lastInteractionBlockId?: string | null;
  lastInteractionPosition?: number;
  selectedBlockId?: string | null; // Only track the currently selected block
}

interface BlockViewInfo {
  blockId: string;
  startTime: number;
  wordCount: number;
  pageNumber: number;
}

/**
 * Hook for tracking reading progress based on viewport visibility and time spent.
 * 
 * Features:
 * - Intersection Observer to detect visible blocks
 * - Timer-based tracking with word count heuristics
 * - Only updates progress if within 1-2 pages of last interaction
 * - Configurable reading speed (words per minute)
 * 
 * Heuristics:
 * - Minimum 10 seconds viewing time
 * - OR calculated reading time based on word count (250 WPM average)
 * - Must be within 2 pages of last interaction to prevent jumping
 */
export function useViewportReadingTracker({
  blocks,
  flattenedBlocks,
  onProgressUpdate,
  lastInteractionBlockId,
  lastInteractionPosition,
  selectedBlockId
}: UseViewportReadingTrackerProps) {
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const viewingBlocksRef = useRef<Map<string, BlockViewInfo>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Configuration
  const MIN_VIEWING_TIME = 4000; // 4 seconds minimum
  const READING_SPEED_WPM = 250; // Average reading speed
  const MAX_PAGE_DISTANCE = 2; // Only track within 2 pages of last interaction
  
  // Calculate word count from HTML content
  const getWordCount = useCallback((htmlContent: string): number => {
    if (!htmlContent) return 0;
    
    // Strip HTML tags and count words
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ');
    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }, []);
  
  // Calculate expected reading time based on word count
  const getExpectedReadingTime = useCallback((wordCount: number): number => {
    const readingTimeMs = (wordCount / READING_SPEED_WPM) * 60 * 1000;
    return Math.max(MIN_VIEWING_TIME, readingTimeMs);
  }, []);
  
  // Check if a block is within acceptable page range of last interaction
  const isWithinPageRange = useCallback((blockPageNumber: number): boolean => {
    if (!lastInteractionBlockId || lastInteractionPosition === undefined) {
      return true; // No previous interaction, allow any block
    }
    
    // Find the page of the last interaction
    const lastInteractionBlock = flattenedBlocks[lastInteractionPosition];
    if (!lastInteractionBlock?.page_number) {
      return true; // Can't determine page, allow it
    }
    
    const pageDistance = Math.abs(blockPageNumber - lastInteractionBlock.page_number);
    return pageDistance <= MAX_PAGE_DISTANCE;
  }, [lastInteractionBlockId, lastInteractionPosition, flattenedBlocks]);
  
  // Handle when a block becomes visible
  const handleBlockVisible = useCallback((blockId: string) => {
    console.log('👀 Block became visible:', blockId, 'selectedBlockId:', selectedBlockId);
    
    // Only track if this is the currently selected block
    if (!selectedBlockId || blockId !== selectedBlockId) {
      console.log('⏭️ Skipping - not selected block');
      return;
    }
    
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const wordCount = getWordCount(block.html_content || '');
    const pageNumber = block.page_number || 1;
    
    // Only track if within page range
    if (!isWithinPageRange(pageNumber)) {
      return;
    }
    
    // Start tracking this selected block
    const viewInfo = {
      blockId,
      startTime: Date.now(),
      wordCount,
      pageNumber
    };
    
    console.log('⏱️ Started tracking block:', viewInfo);
    viewingBlocksRef.current.set(blockId, viewInfo);
  }, [blocks, getWordCount, isWithinPageRange, selectedBlockId]);
  
  // Handle when a block becomes invisible
  const handleBlockInvisible = useCallback((blockId: string) => {
    console.log('👻 Block became invisible:', blockId);
    
    const viewInfo = viewingBlocksRef.current.get(blockId);
    if (!viewInfo) {
      console.log('⚠️ No view info found for invisible block:', blockId);
      return;
    }
    
    const viewingTime = Date.now() - viewInfo.startTime;
    const expectedReadingTime = getExpectedReadingTime(viewInfo.wordCount);
    
    console.log('📊 Block viewing stats:', { 
      blockId, 
      viewingTime: Math.round(viewingTime/1000) + 's', 
      expectedReadingTime: Math.round(expectedReadingTime/1000) + 's',
      wordCount: viewInfo.wordCount 
    });
    
    // Check if viewed long enough to count as "read"
    if (viewingTime >= expectedReadingTime) {
      console.log('✅ Block viewed long enough - updating progress:', blockId);
      onProgressUpdate(blockId);
    } else {
      console.log('⏳ Block not viewed long enough yet - removing from tracking');
    }
    
    // Remove from tracking
    viewingBlocksRef.current.delete(blockId);
    console.log('🗑️ Removed block from tracking, remaining blocks:', viewingBlocksRef.current.size);
  }, [getExpectedReadingTime, onProgressUpdate]);
  
  // Periodic check for blocks that have been visible long enough
  const checkLongViewingBlocks = useCallback(() => {
    const now = Date.now();
    const trackingCount = viewingBlocksRef.current.size;
    
    console.log(`🔄 Timer check - tracking ${trackingCount} blocks`);
    
    viewingBlocksRef.current.forEach((viewInfo, blockId) => {
      const viewingTime = now - viewInfo.startTime;
      const expectedReadingTime = getExpectedReadingTime(viewInfo.wordCount);
      
      console.log(`⏰ Block ${blockId}: ${Math.round(viewingTime/1000)}s viewed, needs ${Math.round(expectedReadingTime/1000)}s`);
      
      if (viewingTime >= expectedReadingTime) {
        console.log(`✅ Block viewed long enough - updating progress: ${blockId}`);
        onProgressUpdate(blockId);
        viewingBlocksRef.current.delete(blockId);
      }
    });
  }, [getExpectedReadingTime, onProgressUpdate]);
  
  // Set up intersection observer
  useEffect(() => {
    console.log('🔍 useViewportReadingTracker setup:', { blocksCount: blocks.length, selectedBlockId });
    
    // Don't track if no blocks or no selected block
    if (blocks.length === 0 || !selectedBlockId) {
      console.log('❌ Not tracking - no blocks or no selected block');
      // Clear any existing tracking
      viewingBlocksRef.current.clear();
      return;
    }
    
    // Find the scrollable container that contains the blocks
    const selectedBlockElement = document.querySelector(`[data-block-id="${selectedBlockId}"]`);
    const scrollContainer = selectedBlockElement?.closest('.overflow-auto, .overflow-y-auto, .overflow-scroll') || null;
    
    console.log('📦 Found scroll container:', scrollContainer);
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const blockId = entry.target.getAttribute('data-block-id');
          if (!blockId) return;
          
          console.log('👁️ Intersection change:', { 
            blockId, 
            isIntersecting: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            boundingRect: entry.boundingClientRect,
            rootBounds: entry.rootBounds
          });
          
          if (entry.isIntersecting) {
            console.log('✅ Block is intersecting - calling handleBlockVisible');
            handleBlockVisible(blockId);
          } else {
            // Only handle invisible if we were already tracking this block
            const wasTracking = viewingBlocksRef.current.has(blockId);
            console.log('❌ Block is NOT intersecting', { blockId, wasTracking });
            
            if (wasTracking) {
              console.log('📤 Block was being tracked - calling handleBlockInvisible');
              handleBlockInvisible(blockId);
            } else {
              console.log('🚫 Block was not being tracked - ignoring invisible event');
            }
          }
        });
      },
      {
        root: scrollContainer, // Use the actual scrollable container
        threshold: 0.5, // Block must be 50% visible
        rootMargin: '50px' // Start tracking slightly before fully visible
      }
    );
    
    // Only observe the selected block element
    const selectedBlockElement = document.querySelector(`[data-block-id="${selectedBlockId}"]`);
    console.log('🎯 Looking for block element:', selectedBlockId, selectedBlockElement);
    
    if (selectedBlockElement) {
      console.log('✅ Observing block element:', selectedBlockId);
      observerRef.current.observe(selectedBlockElement);
    } else {
      console.log('❌ Block element not found in DOM:', selectedBlockId);
    }
    
    // Set up periodic timer for long-viewing blocks
    console.log('⏰ Setting up timer to check every 2 seconds');
    timerRef.current = setInterval(checkLongViewingBlocks, 2000); // Check every 2 seconds
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      viewingBlocksRef.current.clear();
    };
  }, [blocks, selectedBlockId, handleBlockVisible, handleBlockInvisible, checkLongViewingBlocks]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Return current viewing status for debugging
  const getViewingStatus = useCallback(() => {
    return Array.from(viewingBlocksRef.current.entries()).map(([blockId, info]) => ({
      blockId,
      viewingTime: Date.now() - info.startTime,
      expectedTime: getExpectedReadingTime(info.wordCount),
      wordCount: info.wordCount,
      pageNumber: info.pageNumber
    }));
  }, [getExpectedReadingTime]);
  
  return {
    getViewingStatus
  };
}