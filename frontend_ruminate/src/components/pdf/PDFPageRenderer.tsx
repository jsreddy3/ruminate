import React, { useState, useMemo } from 'react';
import { Page } from 'react-pdf';
import { usePageLoadState } from './usePageLoadState';

interface PDFPageRendererProps {
  index: number;
  pdf: any;
  scale: number;
  pageDimensions: Map<number, { width: number; height: number }>;
  documentId: string;
}

/**
 * Renders just the PDF page image.
 * Completely isolated from block state to prevent re-renders.
 */
export const PDFPageRenderer = React.memo(({
  index,
  pdf,
  scale,
  pageDimensions,
  documentId
}: PDFPageRendererProps) => {
  const [pageError, setPageError] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  
  // Use persistent state that survives unmounts
  const { hasEverLoaded, markAsLoaded } = usePageLoadState(documentId, index);
  
  // Track renders
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  // Get page dimensions for placeholders
  const pageDims = useMemo(() => {
    const dimensions = pageDimensions.get(index);
    return {
      width: dimensions?.width || 612 * scale,
      height: dimensions?.height || 792 * scale
    };
  }, [index, pageDimensions, scale]);
  
  // Only show loading if we've never loaded this page before
  if ((!pdf && !hasEverLoaded) || pageError) {
    return (
      <div className="flex items-center justify-center bg-white" 
           style={{ width: pageDims.width, height: pageDims.height }}>
        <div className="text-reading-muted">
          {pageError ? `Error loading page ${index + 1}` : `Loading page ${index + 1}...`}
          <div className="text-xs mt-2 text-red-500">Debug: hasEverLoaded={String(hasEverLoaded)}, pdf={String(!!pdf)}</div>
        </div>
      </div>
    );
  }
  
  // If pdf is temporarily null but we've loaded before, show the last rendered content
  if (!pdf && hasEverLoaded) {
    return <div style={{ width: pageDims.width, height: pageDims.height }} />;
  }

  return (
    <Page
      key={`pdf-page-${index}`}
      pageNumber={index + 1}
      scale={scale}
      onLoadSuccess={() => {
        setPageLoaded(true);
        markAsLoaded();
      }}
      onLoadError={() => {
        setPageError(true);
      }}
      renderTextLayer={false}
      renderAnnotationLayer={false}
      className="pdf-page"
      loading={pageLoaded ? null :
        <div className="flex items-center justify-center bg-white" 
             style={{ width: pageDims.width, height: pageDims.height }}>
          <div className="text-reading-muted">Loading page {index + 1}...</div>
        </div>
      }
    />
  );
});

PDFPageRenderer.displayName = 'PDFPageRenderer';