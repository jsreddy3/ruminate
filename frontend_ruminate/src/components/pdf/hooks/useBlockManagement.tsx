import { useState, useCallback, useEffect, useRef } from 'react';
import { authenticatedFetch, API_BASE_URL } from '../../../utils/api';
import { Block } from '../PDFViewer';
import { filterNavigableBlocks } from '../../../utils/blockFiltering';

interface UseBlockManagementProps {
  documentId: string;
  onBlocksLoaded?: (blocks: Block[]) => void;
  updateProgress?: (blockId: string) => void; // Optional, can be undefined
}

interface UseBlockManagementReturn {
  // State
  blocks: Block[];
  flattenedBlocks: Block[];
  
  // Actions
  fetchBlocks: () => Promise<void>;
  fetchBlockImages: (blockId: string) => Promise<void>;
  updateBlockMetadata: (blockId: string, newMetadata: any) => void;
}

export function useBlockManagement({
  documentId,
  onBlocksLoaded,
  updateProgress
}: UseBlockManagementProps): UseBlockManagementReturn {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [flattenedBlocks, setFlattenedBlocks] = useState<Block[]>([]);
  
  // Ref to track the last fetch time to prevent multiple refreshes
  const lastFetchTimeRef = useRef<number>(0);
  
  // Fetch blocks function that can be reused
  const fetchBlocks = useCallback(async () => {
    if (!documentId) return;
    
    // Prevent multiple fetches within 2 seconds
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    try {
      const blocksResp = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/blocks?include_images=false`);
      const blocksData = await blocksResp.json();
      
      if (Array.isArray(blocksData)) {
        setBlocks(blocksData);
        onBlocksLoaded?.(blocksData);
      }
    } catch (error) {
      console.error("Error fetching document data:", error);
    }
  }, [documentId, onBlocksLoaded]);
  
  // Fetch images for a specific block (lazy loading)
  const fetchBlockImages = useCallback(async (blockId: string) => {
    if (!documentId) return;
    
    try {
      const resp = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/blocks/${blockId}/images`);
      const data = await resp.json();
      
      // Update the specific block with real images
      setBlocks(prev => prev.map(block => 
        block.id === blockId 
          ? { ...block, images: data.images }
          : block
      ));
    } catch (error) {
      console.error("Error fetching block images:", error);
    }
  }, [documentId]);
  
  // Function to update a specific block's metadata optimistically
  const updateBlockMetadata = useCallback((blockId: string, newMetadata: any) => {
    setBlocks(prevBlocks => 
      prevBlocks.map(block => 
        block.id === blockId 
          ? { ...block, metadata: { ...block.metadata, ...newMetadata } }
          : block
      )
    );
    
    // Update reading progress when user interacts with a block (if provided)
    if (updateProgress) {
      updateProgress(blockId);
    }
  }, [updateProgress]);
  
  // Flatten blocks for easy navigation
  useEffect(() => {
    if (blocks.length > 0) {
      // Use the shared filtering logic
      const navigableBlocks = filterNavigableBlocks(blocks);
      setFlattenedBlocks(navigableBlocks);
    }
  }, [blocks]);
  
  // Fetch blocks when component mounts
  useEffect(() => {
    if (documentId) {
      fetchBlocks();
    }
  }, [documentId, fetchBlocks]);
  
  return {
    // State
    blocks,
    flattenedBlocks,
    
    // Actions
    fetchBlocks,
    fetchBlockImages,
    updateBlockMetadata,
  };
}