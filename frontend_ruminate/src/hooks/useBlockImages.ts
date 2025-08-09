import { useState, useCallback, useRef, useEffect } from 'react';
import { authenticatedFetch, API_BASE_URL } from '../utils/api';

interface ImageCache {
  [blockId: string]: {
    images: { [key: string]: string };
    timestamp: number;
  };
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 50; // Maximum number of cached blocks

export function useBlockImages(documentId: string) {
  const [cache, setCache] = useState<ImageCache>({});
  const cacheRef = useRef<ImageCache>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  
  // Keep ref in sync with state
  cacheRef.current = cache;

  const fetchBlockImages = useCallback(async (blockId: string): Promise<{ [key: string]: string }> => {
    if (!documentId) return {};

    // Check cache first
    const cached = cacheRef.current[blockId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.images;
    }

    // Prevent duplicate fetches
    if (fetchingRef.current.has(blockId)) {
      // Wait for the ongoing fetch
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const cached = cacheRef.current[blockId];
          if (cached && !fetchingRef.current.has(blockId)) {
            clearInterval(checkInterval);
            resolve(cached.images);
          }
        }, 100);
      });
    }

    fetchingRef.current.add(blockId);

    try {
      const resp = await authenticatedFetch(
        `${API_BASE_URL}/documents/${documentId}/blocks/${blockId}/images`
      );
      const data = await resp.json();
      
      // Update cache with LRU eviction
      setCache(prev => {
        const newCache = { ...prev };
        
        // Add/update the current block
        newCache[blockId] = {
          images: data.images || {},
          timestamp: Date.now()
        };
        
        // If cache is too large, remove oldest entries
        const entries = Object.entries(newCache);
        if (entries.length > MAX_CACHE_SIZE) {
          // Sort by timestamp (oldest first) and remove excess
          const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
          const toRemove = entries.length - MAX_CACHE_SIZE;
          
          for (let i = 0; i < toRemove; i++) {
            delete newCache[sortedEntries[i][0]];
          }
        }
        
        return newCache;
      });

      fetchingRef.current.delete(blockId);
      return data.images || {};
    } catch (error) {
      console.error(`Error fetching images for block ${blockId}:`, error);
      fetchingRef.current.delete(blockId);
      return {};
    }
  }, [documentId]); // Remove cache from dependencies

  // Clear old cache entries
  const clearExpiredCache = useCallback(() => {
    const now = Date.now();
    setCache(prev => {
      const newCache: ImageCache = {};
      Object.entries(prev).forEach(([blockId, data]) => {
        if (now - data.timestamp < CACHE_DURATION) {
          newCache[blockId] = data;
        }
      });
      return newCache;
    });
  }, []);

  // Periodic cleanup of expired cache entries
  useEffect(() => {
    const interval = setInterval(() => {
      clearExpiredCache();
    }, CACHE_DURATION); // Clean up every 10 minutes
    
    return () => clearInterval(interval);
  }, [clearExpiredCache]);

  return {
    fetchBlockImages,
    clearExpiredCache,
    cache
  };
}