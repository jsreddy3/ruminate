import { useState, useCallback, useRef } from 'react';
import { authenticatedFetch, API_BASE_URL } from '../utils/api';

interface ImageCache {
  [blockId: string]: {
    images: { [key: string]: string };
    timestamp: number;
  };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useBlockImages(documentId: string) {
  const [cache, setCache] = useState<ImageCache>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  const fetchBlockImages = useCallback(async (blockId: string): Promise<{ [key: string]: string }> => {
    if (!documentId) return {};

    // Check cache first
    const cached = cache[blockId];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.images;
    }

    // Prevent duplicate fetches
    if (fetchingRef.current.has(blockId)) {
      // Wait for the ongoing fetch
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const cached = cache[blockId];
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
      
      // Update cache
      setCache(prev => ({
        ...prev,
        [blockId]: {
          images: data.images || {},
          timestamp: Date.now()
        }
      }));

      fetchingRef.current.delete(blockId);
      return data.images || {};
    } catch (error) {
      console.error(`Error fetching images for block ${blockId}:`, error);
      fetchingRef.current.delete(blockId);
      return {};
    }
  }, [documentId, cache]);

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

  return {
    fetchBlockImages,
    clearExpiredCache,
    cache
  };
}