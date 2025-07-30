import { useState, useCallback, useRef } from 'react';
import { documentApi } from '@/services/api/document';

interface ReadingProgressState {
  furthestBlockId: string | null;
  furthestPosition: number;
  lastUpdated: Date | null;
}

interface UseReadingProgressProps {
  documentId: string;
  flattenedBlocks: Array<{ id: string; page_number?: number }>;
}

interface UseReadingProgressReturn {
  updateProgress: (blockId: string) => void;
  getFurthestProgress: () => ReadingProgressState;
  scrollToFurthestBlock: () => string | null;
  initializeProgress: (document: { 
    furthest_read_block_id?: string | null;
    furthest_read_position?: number | null; 
    furthest_read_updated_at?: string | null;
  }) => void;
}

/**
 * Hook for tracking and updating reading progress in a document.
 * 
 * Features:
 * - Throttled API updates (max once every 3 seconds)
 * - Only updates if new position is further than current
 * - Optimistic local state updates
 * - Integration with existing block ordering system
 */
export function useReadingProgress({ 
  documentId, 
  flattenedBlocks 
}: UseReadingProgressProps): UseReadingProgressReturn {
  
  const [localProgress, setLocalProgress] = useState<ReadingProgressState>({
    furthestBlockId: null,
    furthestPosition: -1,
    lastUpdated: null
  });
  
  // Throttling state
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<{ blockId: string; position: number } | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize from document data
  const initializeProgress = useCallback((document: { 
    furthest_read_block_id?: string | null;
    furthest_read_position?: number | null; 
    furthest_read_updated_at?: string | null;
  }) => {
    if (document.furthest_read_block_id && document.furthest_read_position !== undefined) {
      setLocalProgress({
        furthestBlockId: document.furthest_read_block_id,
        furthestPosition: document.furthest_read_position,
        lastUpdated: document.furthest_read_updated_at ? new Date(document.furthest_read_updated_at) : null
      });
    }
  }, []);
  
  // Throttled API update function
  const performApiUpdate = useCallback(async (blockId: string, position: number) => {
    try {
      await documentApi.updateReadingProgress(documentId, blockId, position);
      lastUpdateTimeRef.current = Date.now();
      console.log(`📖 Reading progress updated: block ${blockId}, position ${position}`);
    } catch (error) {
      console.error('Failed to update reading progress:', error);
      // Don't revert optimistic update - user experience is more important
    }
  }, [documentId]);
  
  // Main progress update function
  const updateProgress = useCallback((blockId: string) => {
    // Find block position in reading order
    const blockIndex = flattenedBlocks.findIndex(block => block.id === blockId);
    if (blockIndex === -1) {
      console.warn(`Block ${blockId} not found in flattened blocks`);
      return;
    }
    
    const position = blockIndex;
    
    // Only update if this position is further than current
    if (position <= localProgress.furthestPosition) {
      return;
    }
    
    // Optimistic update
    setLocalProgress(prev => ({
      furthestBlockId: blockId,
      furthestPosition: position,
      lastUpdated: new Date()
    }));
    
    // Throttled API update
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const throttleDelay = 3000; // 3 seconds
    
    // Store the pending update
    pendingUpdateRef.current = { blockId, position };
    
    if (timeSinceLastUpdate >= throttleDelay) {
      // Can update immediately
      performApiUpdate(blockId, position);
    } else {
      // Schedule update for later
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      const delay = throttleDelay - timeSinceLastUpdate;
      updateTimeoutRef.current = setTimeout(() => {
        const pending = pendingUpdateRef.current;
        if (pending) {
          performApiUpdate(pending.blockId, pending.position);
          pendingUpdateRef.current = null;
        }
      }, delay);
    }
  }, [flattenedBlocks, localProgress.furthestPosition, performApiUpdate]);
  
  // Get current progress state
  const getFurthestProgress = useCallback((): ReadingProgressState => {
    return { ...localProgress };
  }, [localProgress]);
  
  // Get block ID for scroll-to functionality
  const scrollToFurthestBlock = useCallback((): string | null => {
    return localProgress.furthestBlockId;
  }, [localProgress.furthestBlockId]);
  
  return {
    updateProgress,
    getFurthestProgress,
    scrollToFurthestBlock,
    initializeProgress
  };
}