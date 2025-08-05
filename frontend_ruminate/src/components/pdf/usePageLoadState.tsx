import { useRef } from 'react';

/**
 * Global store for tracking which pages have been loaded.
 * This persists across component unmounts/remounts.
 */
const pageLoadStateStore = new Map<string, boolean>();

export function usePageLoadState(documentId: string, pageIndex: number) {
  const key = `${documentId}-${pageIndex}`;
  
  // Check if this page has ever loaded before
  const hasEverLoaded = pageLoadStateStore.get(key) || false;
  
  // Function to mark page as loaded
  const markAsLoaded = () => {
    pageLoadStateStore.set(key, true);
  };
  
  // Clean up on document change
  const lastDocIdRef = useRef(documentId);
  if (lastDocIdRef.current !== documentId) {
    // Clear all states for the previous document
    Array.from(pageLoadStateStore.keys())
      .filter(k => k.startsWith(lastDocIdRef.current))
      .forEach(k => pageLoadStateStore.delete(k));
    lastDocIdRef.current = documentId;
  }
  
  return { hasEverLoaded, markAsLoaded };
}