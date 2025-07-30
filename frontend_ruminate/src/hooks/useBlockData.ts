import { useState, useEffect, useCallback } from 'react';
import { getRabbitholesByBlock, RabbitholeHighlight } from '../services/rabbithole';

type BlockDataCache = {
  [blockId: string]: {
    rabbitholeHighlights: RabbitholeHighlight[];
    isLoading: boolean;
    error: Error | null;
    timestamp: number;
  }
};

// Simple in-memory cache (will be reset on page refresh)
const blockDataCache: BlockDataCache = {};

export function useBlockData(blockId: string | undefined) {
  const [rabbitholeHighlights, setRabbitholeHighlights] = useState<RabbitholeHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchBlockData = useCallback(async (id: string, forceRefresh = false) => {
    // Skip if no id
    if (!id) return;
    
    // Check cache first (unless force refresh is requested)
    const cachedData = blockDataCache[id];
    if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < 60000) {
      setRabbitholeHighlights(cachedData.rabbitholeHighlights);
      setIsLoading(false);
      setError(cachedData.error);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const highlights = await getRabbitholesByBlock(id);
      
      // Update state
      setRabbitholeHighlights(highlights);
      setError(null);
      
      // Update cache
      blockDataCache[id] = {
        rabbitholeHighlights: highlights,
        isLoading: false,
        error: null,
        timestamp: Date.now()
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      
      // Cache the error too
      blockDataCache[id] = {
        rabbitholeHighlights: [],
        isLoading: false,
        error,
        timestamp: Date.now()
      };
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Fetch data when blockId changes
  useEffect(() => {
    if (blockId) {
      fetchBlockData(blockId);
    }
  }, [blockId, fetchBlockData]);
  
  const refetch = useCallback(() => {
    if (blockId) {
      fetchBlockData(blockId, true); // Pass true to force refresh and bypass cache
    }
  }, [blockId, fetchBlockData]);
  
  return { rabbitholeHighlights, isLoading, error, refetch };
}