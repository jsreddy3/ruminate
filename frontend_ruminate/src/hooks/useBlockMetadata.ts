import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch, API_BASE_URL } from '@/utils/api';

interface BlockMetadata {
  definitions?: {
    [term: string]: {
      term: string;
      definition: string;
      created_at: string;
    };
  };
  [key: string]: any;
}

interface Block {
  id: string;
  metadata?: BlockMetadata;
  // Add other block properties as needed
}

type BlockMetadataCache = {
  [blockId: string]: {
    metadata: BlockMetadata | undefined;
    isLoading: boolean;
    error: Error | null;
    timestamp: number;
  }
};

// Simple in-memory cache (will be reset on page refresh)
const blockMetadataCache: BlockMetadataCache = {};
const CACHE_DURATION = 60000; // 60 seconds, same as rabbitholes

export function useBlockMetadata(blockId: string | undefined) {
  const [metadata, setMetadata] = useState<BlockMetadata | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchBlockMetadata = useCallback(async (id: string, forceRefresh = false) => {
    // Skip if no id
    if (!id) return;
    
    // Check cache first (unless force refresh is requested)
    const cachedData = blockMetadataCache[id];
    if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      setMetadata(cachedData.metadata);
      setIsLoading(false);
      setError(cachedData.error);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Fetch just this specific block
      const response = await authenticatedFetch(`${API_BASE_URL}/documents/blocks/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch block metadata');
      }
      
      const blockData: Block = await response.json();
      
      // Update state
      setMetadata(blockData.metadata);
      setError(null);
      
      // Update cache
      blockMetadataCache[id] = {
        metadata: blockData.metadata,
        isLoading: false,
        error: null,
        timestamp: Date.now()
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      
      // Cache the error too
      blockMetadataCache[id] = {
        metadata: undefined,
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
      fetchBlockMetadata(blockId);
    }
  }, [blockId, fetchBlockMetadata]);
  
  const refetch = useCallback(() => {
    if (blockId) {
      fetchBlockMetadata(blockId, true); // Pass true to force refresh and bypass cache
    }
  }, [blockId, fetchBlockMetadata]);
  
  return { metadata, isLoading, error, refetch };
}