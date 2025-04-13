import React, { useEffect } from 'react';
import { useBlockData } from '../../../hooks/useBlockData';
import BlockRenderer from './BlockRenderer';
import { RabbitholeHighlight } from '../../../services/rabbithole';

interface BlockContainerProps {
  blockId: string;
  blockType: string;
  htmlContent: string;
  images?: { [key: string]: string };
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  onAddTextToChat?: (text: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onRabbitholeCreate?: (text: string, startOffset: number, endOffset: number) => void;
}

/**
 * BlockContainer is responsible for fetching and providing block data.
 * It acts as a container component that separates data fetching from presentation.
 */
export default function BlockContainer({
  blockId,
  blockType,
  htmlContent,
  images = {},
  highlights = [],
  onAddTextToChat,
  onRabbitholeClick,
  onRabbitholeCreate
}: BlockContainerProps) {
  // Add component lifecycle logging
  // console.log(`BlockContainer MOUNT - blockId: ${blockId}`);
  
  // Component unmount logging
  // useEffect(() => {
  //   return () => {
  //     console.log(`BlockContainer UNMOUNT - blockId: ${blockId}`);
  //   };
  // }, [blockId]);

  // Use the hook to fetch rabbithole highlights
  const { rabbitholeHighlights, isLoading, error } = useBlockData(blockId);
  
  if (error) {
    console.error('Error loading block data:', error);
  }
  
  // Render a loading state if data is being fetched
  if (isLoading) {
    return (
      <div className="p-4 bg-slate-50 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
      </div>
    );
  }
  
  // Delegate rendering to the appropriate renderer component
  return (
    <BlockRenderer
      blockType={blockType}
      htmlContent={htmlContent}
      images={images}
      blockId={blockId}
      highlights={highlights}
      rabbitholeHighlights={rabbitholeHighlights}
      onAddTextToChat={onAddTextToChat}
      onRabbitholeClick={onRabbitholeClick}
      onRabbitholeCreate={onRabbitholeCreate}
    />
  );
}
