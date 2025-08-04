import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import { Document, Page, pdfjs } from 'react-pdf';
import { Block } from './PDFViewer';

// Configure PDF.js worker - use local copy from webpack build
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Memoized page component to prevent re-renders
const SimplePage = React.memo(({ 
  index, 
  style, 
  pdf, 
  pageDimensions, 
  scale, 
  containerWidth, 
  renderOverlay
}: { 
  index: number; 
  style: React.CSSProperties;
  pdf: any;
  pageDimensions: Map<number, { width: number; height: number }>;
  scale: number;
  containerWidth: number;
  renderOverlay: (props: { pageIndex: number; scale: number; rotation: number }) => React.ReactNode;
}) => {
  const [pageError, setPageError] = useState(false);
  
  // Use the scale directly without clamping to container width
  const pageScale = scale;

  // Get page dimensions for placeholders
  const pageDims = useMemo(() => {
    const dimensions = pageDimensions.get(index);
    return {
      width: dimensions?.width || 612 * scale,
      height: dimensions?.height || 792 * scale
    };
  }, [index, pageDimensions, scale]);

  return (
    <div style={style} className="pdf-page-container flex justify-center items-start py-2" data-page-index={index}>
      <div className="relative inline-block shadow-book rounded-book bg-white overflow-hidden">
        {pdf && !pageError && (
          <>
            <Page
              pageNumber={index + 1}
              scale={pageScale}
              onLoadError={() => setPageError(true)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="pdf-page"
              loading={
                <div className="flex items-center justify-center bg-white" 
                     style={{ width: pageDims.width, height: pageDims.height }}>
                  <div className="text-reading-muted">Loading page {index + 1}...</div>
                </div>
              }
            />
            {/* Always render overlay - don't wait for page load */}
            <div className="absolute inset-0 pointer-events-auto">
              {renderOverlay({
                pageIndex: index,
                scale: pageScale,
                rotation: 0
              })}
            </div>
          </>
        )}
        
        {pageError && (
          <div className="flex items-center justify-center bg-red-50 text-red-600"
               style={{ width: pageDims.width, height: pageDims.height }}>
            <div className="text-center">
              <p>Error loading page {index + 1}</p>
              <button 
                onClick={() => setPageError(false)}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

interface VirtualizedPDFViewerProps {
  pdfFile: string;
  blocks: Block[];
  scale: number;
  renderOverlay: (props: {
    pageIndex: number;
    scale: number;
    rotation: number;
  }) => React.ReactNode;
  onPageChange?: (pageNumber: number) => void;
  onDocumentLoadSuccess?: (pdf: any) => void;
  scrollToPageRef?: React.MutableRefObject<(pageNumber: number) => void>;
  renderLoader?: (percentages: number) => React.ReactElement;
  forceRefreshKey?: number;
  pdfLoadingState?: string;
  onForceRefresh?: () => void;
}

interface PageDimensions {
  width: number;
  height: number;
}

const VirtualizedPDFViewer: React.FC<VirtualizedPDFViewerProps> = ({
  pdfFile,
  blocks,
  scale = 1,
  renderOverlay,
  onPageChange,
  onDocumentLoadSuccess,
  scrollToPageRef,
  renderLoader,
  forceRefreshKey = 0,
  pdfLoadingState,
  onForceRefresh
}) => {
  const [pdf, setPdf] = useState<any>(null);
  const [pageDimensions, setPageDimensions] = useState<Map<number, PageDimensions>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isStuck, setIsStuck] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  // Handle PDF load
  const handleDocumentLoadSuccess = useCallback((loadedPdf: any) => {
    setPdf(loadedPdf);
    setTotalPages(loadedPdf.numPages);
    setIsStuck(false);
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    onDocumentLoadSuccess?.(loadedPdf);
  }, [onDocumentLoadSuccess]);

  // Track the scale value used for dimension calculations
  const dimensionScaleRef = useRef<number | null>(null);

  // Recalculate page dimensions when PDF loads or scale changes
  useEffect(() => {
    if (!pdf) return;

    // Only recalculate if scale has actually changed
    if (dimensionScaleRef.current !== null && Math.abs(dimensionScaleRef.current - scale) < 0.01) {
      return;
    }

    const loadPageDimensions = async () => {
      const dimensions = new Map<number, PageDimensions>();
      
      try {
        // Load first page to get default dimensions (most PDFs have uniform pages)
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale });
        const defaultDimensions = {
          width: viewport.width,
          height: viewport.height
        };
        
        // Set default dimensions for all pages initially
        for (let i = 0; i < pdf.numPages; i++) {
          dimensions.set(i, defaultDimensions);
        }
        
        setPageDimensions(dimensions);
        dimensionScaleRef.current = scale; // Remember the scale we used
        
        
        // Reset the virtual list to recalculate all item positions
        if (listRef.current) {
          listRef.current.resetAfterIndex(0);
        }
        
        // Load remaining pages in background without constant resets
        setTimeout(async () => {
          const updatedDimensions = new Map(dimensions);
          let hasChanges = false;
          
          // Load all remaining pages (skip page 1 since we already have it)
          for (let i = 2; i <= pdf.numPages; i++) {
            try {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale });
              const newDimensions = {
                width: viewport.width,
                height: viewport.height
              };
              
              updatedDimensions.set(i - 1, newDimensions);
              hasChanges = true;
            } catch (e) {
              // Use default dimensions for this page
            }
          }
          
          // Single update at the end to avoid layout thrashing
          if (hasChanges) {
            setPageDimensions(new Map(updatedDimensions));
            if (listRef.current) {
              listRef.current.resetAfterIndex(0);
            }
          }
        }, 100); // Faster initial load
      } catch (error) {
        // Set fallback dimensions (more accurate A4)
        for (let i = 0; i < pdf.numPages; i++) {
          dimensions.set(i, { width: 612 * scale, height: 792 * scale }); // US Letter default, closer to your actual pages
        }
        setPageDimensions(dimensions);
        dimensionScaleRef.current = scale; // Remember the scale we used
      }
    };
    
    loadPageDimensions();
  }, [pdf, scale]);

  // Handle loading progress
  const handleLoadingProgress = useCallback((progressData: { loaded: number; total: number }) => {
    if (progressData.total > 0) {
      const progress = Math.round((progressData.loaded / progressData.total) * 100);
      setLoadingProgress(progress);
    }
  }, []);

  // Handle loading error
  const handleLoadingError = useCallback((error: Error) => {
    setIsStuck(true);
  }, []);

  // Set loading timeout
  useEffect(() => {
    if (!pdf && pdfLoadingState === 'loading') {
      loadingTimeoutRef.current = setTimeout(() => {
        setIsStuck(true);
      }, 10000); // 10 seconds
    }
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [pdf, pdfLoadingState]);

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Also update on panel resize
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  // Get item size (page height + margin)
  const getItemSize = (index: number) => {
    const dimensions = pageDimensions.get(index);
    const height = dimensions ? Math.ceil(dimensions.height) : 842; // Default A4 height (dimensions already include scale)
    return height + 16; // Add margin
  };

  // Handle scroll to page
  const scrollToPage = useCallback((pageNumber: number) => {
    if (listRef.current && pageNumber >= 1 && pageNumber <= totalPages) {
      listRef.current.scrollToItem(pageNumber - 1, 'start');
    }
  }, [totalPages]);

  // Expose scroll function via ref
  useEffect(() => {
    if (scrollToPageRef) {
      scrollToPageRef.current = scrollToPage;
    }
  }, [scrollToPage, scrollToPageRef]);

  // Track visible pages and notify about page changes
  const handleItemsRendered = ({ visibleStartIndex, visibleStopIndex }: {
    visibleStartIndex: number;
    visibleStopIndex: number;
  }) => {
    // Notify about page change (use middle visible page as current)
    const middleIndex = Math.floor((visibleStartIndex + visibleStopIndex) / 2);
    if (onPageChange && middleIndex >= 0) {
      onPageChange(middleIndex + 1);
    }
  };

  // Memoized wrapper for virtual list items
  const renderPage = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => (
    <SimplePage
      index={index}
      style={style}
      pdf={pdf}
      pageDimensions={pageDimensions}
      scale={scale}
      containerWidth={containerWidth}
      renderOverlay={renderOverlay}
    />
  ), [pdf, pageDimensions, scale, containerWidth, renderOverlay]);

  return (
    <div ref={containerRef} className="h-full w-full relative bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment overflow-x-auto">
      {/* Document component wraps entire viewer */}
      <Document
        key={forceRefreshKey}
        file={pdfFile}
        onLoadSuccess={handleDocumentLoadSuccess}
        onLoadProgress={handleLoadingProgress}
        onLoadError={handleLoadingError}
        loading={null}
        error={
          <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-journal shadow-shelf p-8 max-w-md">
              <div className="text-red-600 text-center">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold">Failed to load PDF</p>
                <p className="text-sm mt-2 text-reading-secondary">Please try refreshing the page</p>
                {onForceRefresh && (
                  <button
                    onClick={onForceRefresh}
                    className="mt-4 px-4 py-2 bg-library-mahogany-600 text-white rounded-book hover:bg-library-mahogany-700 transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        }
        className="h-full w-full"
      >
        {/* Virtual list for pages */}
        {pdf && containerHeight > 0 && (
          <List
            ref={listRef}
            height={containerHeight}
            itemCount={totalPages}
            itemSize={getItemSize} // Dynamic size based on actual page dimensions
            width={containerWidth}
            overscanCount={3} // Reduce overscan to prevent excessive mounting
            onItemsRendered={handleItemsRendered}
            className="pdf-virtual-list"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(175, 95, 55, 0.3) transparent',
              overflowX: 'auto'
            }}
          >
            {renderPage}
          </List>
        )}

        {/* Loading state - use custom loader if provided */}
        {!pdf && renderLoader && (
          <div className="absolute inset-0 flex items-center justify-center">
            {renderLoader(pdfLoadingState === 'stuck' || isStuck ? 0 : loadingProgress)}
          </div>
        )}
        
        {/* Default loading state if no custom loader */}
        {!pdf && !renderLoader && (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-journal shadow-shelf p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-library-mahogany-600 mx-auto"></div>
              <p className="mt-4 text-reading-secondary">
                Loading document... {loadingProgress > 0 ? `${loadingProgress}%` : ''}
              </p>
              {isStuck && onForceRefresh && (
                <button
                  onClick={onForceRefresh}
                  className="mt-4 px-4 py-2 bg-library-mahogany-600 text-white rounded-book hover:bg-library-mahogany-700 transition-colors"
                >
                  Force Refresh
                </button>
              )}
            </div>
          </div>
        )}
      </Document>
    </div>
  );
};

VirtualizedPDFViewer.displayName = 'VirtualizedPDFViewer';

export default VirtualizedPDFViewer;