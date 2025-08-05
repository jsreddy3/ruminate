import React, { createContext, useContext, ReactNode } from 'react';
import { useBlockImages } from '../hooks/useBlockImages';

interface BlockImagesContextType {
  fetchBlockImages: (blockId: string) => Promise<{ [key: string]: string }>;
  clearExpiredCache: () => void;
}

const BlockImagesContext = createContext<BlockImagesContextType | null>(null);

export function BlockImagesProvider({ 
  children, 
  documentId 
}: { 
  children: ReactNode;
  documentId: string;
}) {
  const { fetchBlockImages, clearExpiredCache } = useBlockImages(documentId);

  return (
    <BlockImagesContext.Provider value={{ fetchBlockImages, clearExpiredCache }}>
      {children}
    </BlockImagesContext.Provider>
  );
}

export function useBlockImagesContext() {
  const context = useContext(BlockImagesContext);
  if (!context) {
    throw new Error('useBlockImagesContext must be used within BlockImagesProvider');
  }
  return context;
}