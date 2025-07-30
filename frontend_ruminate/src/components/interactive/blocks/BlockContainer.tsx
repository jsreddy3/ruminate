import React, { useEffect } from 'react';
import { useBlockData } from '../../../hooks/useBlockData';
import BlockRenderer from './BlockRenderer';
import { RabbitholeHighlight } from '../../../services/rabbithole';

interface BlockContainerProps {
  blockId: string;
  blockType: string;
  htmlContent: string;
  documentId: string;
  images?: { [key: string]: string };
  metadata?: {
    definitions?: {
      [term: string]: {
        term: string;
        definition: string;
        created_at: string;
      };
    };
    [key: string]: any;
  };
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  onAddTextToChat?: (text: string) => void;
  onRabbitholeClick?: (rabbitholeId: string, selectedText: string, startOffset?: number, endOffset?: number) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onRefreshRabbitholes?: (refreshFn: () => void) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  customStyle?: React.CSSProperties;
}

/**
 * BlockContainer is responsible for fetching and providing block data.
 * It acts as a container component that separates data fetching from presentation.
 */
export default function BlockContainer({
  blockId,
  blockType,
  htmlContent,
  documentId,
  images = {},
  metadata,
  highlights = [],
  onAddTextToChat,
  onRabbitholeClick,
  onCreateRabbithole,
  onRefreshRabbitholes,
  onUpdateBlockMetadata,
  customStyle
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
  const { rabbitholeHighlights, isLoading, error, refetch } = useBlockData(blockId);
  
  if (error) {
    console.error('Error loading block data:', error);
  }
  
  // Expose refetch function through callback
  useEffect(() => {
    if (onRefreshRabbitholes) {
      onRefreshRabbitholes(refetch);
    }
  }, [refetch, onRefreshRabbitholes]);
  
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
      metadata={metadata}
      blockId={blockId}
      documentId={documentId}
      highlights={highlights}
      rabbitholeHighlights={rabbitholeHighlights}
      onAddTextToChat={onAddTextToChat}
      onRabbitholeClick={onRabbitholeClick}
      onCreateRabbithole={onCreateRabbithole}
      onUpdateBlockMetadata={onUpdateBlockMetadata}
      customStyle={customStyle}
    />
  );
}
