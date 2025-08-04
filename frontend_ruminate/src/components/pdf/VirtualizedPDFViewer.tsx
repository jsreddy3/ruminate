import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import { Document, Page, pdfjs } from 'react-pdf';
import { Block } from './PDFViewer';

// Configure PDF.js worker - use local copy from webpack build
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Move VirtualPage outside to prevent recreation on parent re-renders
const CachedPage = React.memo(({ 
  index, 
  style, 
  pdf, 
  pageDimensions, 
  scale, 
  containerWidth, 
  renderOverlay,
  pageLoadedRef,
  pageErrorRef,
  setLoadingProgress 
}: { 
  index: number; 
  style: React.CSSProperties;
  pdf: any;
  pageDimensions: Map<number, { width: number; height: number }>;
  scale: number;
  containerWidth: number;
  renderOverlay: (props: { pageIndex: number; scale: number; rotation: number }) => React.ReactNode;
  pageLoadedRef: React.MutableRefObject<Map<number, boolean>>;
  pageErrorRef: React.MutableRefObject<Map<number, boolean>>;
  setLoadingProgress: React.Dispatch<React.SetStateAction<number>>;
}) => {
  // Debug: Track component lifecycle (disabled for performance)
  // console.log(`🎯 CachedPage ${index + 1} rendering`);
  
  // useEffect(() => {
  //   console.log(`🎯 CachedPage ${index + 1} mounted`);
  //   return () => {
  //     console.log(`🎯 CachedPage ${index + 1} unmounted`);
  //   };
  // }, [index]);
  // Use cached state instead of local state
  const pageLoaded = pageLoadedRef.current.get(index) || false;
  const pageError = pageErrorRef.current.get(index) || false;
  
  // Stable page scale calculation
  const pageScale = useMemo(() => {
    const dimensions = pageDimensions.get(index);
    if (dimensions && containerWidth > 0) {
      const maxScale = (containerWidth - 80) / dimensions.width * scale; // Leave room for margins
      return Math.min(scale, maxScale);
    }
    return scale;
  }, [index, containerWidth, scale, pageDimensions]);

  // Stable callbacks that update cache and force re-render
  const handlePageLoadSuccess = useCallback(() => {
    pageLoadedRef.current.set(index, true);
    pageErrorRef.current.set(index, false);
    // Force a small re-render to show the loaded state
    setLoadingProgress(prev => prev);
  }, [index, pageLoadedRef, pageErrorRef, setLoadingProgress]);

  const handlePageLoadError = useCallback(() => {
    console.error(`Failed to load page ${index + 1}`);
    pageLoadedRef.current.set(index, true); // Mark as "loaded" to stop loading state
    pageErrorRef.current.set(index, true);
    // Force a small re-render to show the error state
    setLoadingProgress(prev => prev);
  }, [index, pageLoadedRef, pageErrorRef, setLoadingProgress]);

  // Stable page dimensions for loading placeholder
  const pageDims = useMemo(() => {
    const dimensions = pageDimensions.get(index);
    return {
      width: dimensions?.width || 612 * scale,
      height: dimensions?.height || 792 * scale
    };
  }, [index, pageDimensions, scale]);

  return (
    <div 
      style={style} 
      className="pdf-page-container flex justify-center items-start py-2"
    >
      <div className="relative inline-block shadow-book rounded-book bg-white overflow-hidden">
        {pdf && !pageError && (
          <Page
            key={`page-${index}`} // Stable key that doesn't cause re-renders
            pageNumber={index + 1}
            scale={pageScale}
            onLoadSuccess={handlePageLoadSuccess}
            onLoadError={handlePageLoadError}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="pdf-page"
            loading={
              <div className="flex items-center justify-center bg-white" 
                   style={{ 
                     width: pageDims.width,
                     height: pageDims.height 
                   }}>
                <div className="text-reading-muted">Loading page {index + 1}...</div>
              </div>
            }
          >
            {pageLoaded && (
              <div className="absolute inset-0 pointer-events-auto">
                {renderOverlay({
                  pageIndex: index,
                  scale: pageScale,
                  rotation: 0
                })}
              </div>
            )}
          </Page>
        )}
        
        {pageError && (
          <div className="flex items-center justify-center bg-red-50 text-red-600"
               style={{ 
                 width: pageDims.width,
                 height: pageDims.height 
               }}>
            <div className="text-center">
              <p>Error loading page {index + 1}</p>
              <button 
                onClick={() => {
                  pageErrorRef.current.set(index, false);
                  setLoadingProgress(prev => prev);
                }}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {/* Page number indicator */}
        {pageLoaded && (
          <div className="absolute bottom-4 right-4 bg-library-mahogany-600/80 text-white px-2 py-1 rounded text-xs pointer-events-none z-10">
            Page {index + 1}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if critical props change
  return (
    prevProps.index === nextProps.index &&
    prevProps.scale === nextProps.scale &&
    prevProps.containerWidth === nextProps.containerWidth &&
    prevProps.pdf === nextProps.pdf &&
    prevProps.pageDimensions === nextProps.pageDimensions &&
    prevProps.renderOverlay === nextProps.renderOverlay
  );
});

CachedPage.displayName = 'CachedPage';

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
  
  // Memoize pageDimensions to prevent new object creation on every render
  const memoizedPageDimensions = useMemo(() => pageDimensions, [pageDimensions]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isStuck, setIsStuck] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visiblePagesRef = useRef<Set<number>>(new Set());
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Page caching to prevent re-renders
  const pageLoadedRef = useRef<Map<number, boolean>>(new Map());
  const pageErrorRef = useRef<Map<number, boolean>>(new Map());

  // Track scale changes
  const prevScaleRef = useRef<number>(scale);
  useEffect(() => {
    if (prevScaleRef.current !== scale) {
      prevScaleRef.current = scale;
    }
  });

  // Index blocks by page for O(1) lookup
  const blocksByPage = useMemo(() => {
    const map = new Map<number, Block[]>();
    blocks.forEach(block => {
      const pageNum = block.page_number ?? 0;
      if (!map.has(pageNum)) {
        map.set(pageNum, []);
      }
      map.get(pageNum)!.push(block);
    });
    return map;
  }, [blocks]);

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

  // Recalculate page dimensions when PDF loads or scale changes significantly
  useEffect(() => {
    if (!pdf) return;

    // Only recalculate if scale has actually changed since last calculation
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
        
        console.log('📐 Dimensions updated for scale:', scale, defaultDimensions);
        
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
              console.warn(`Failed to get dimensions for page ${i}`, e);
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
        console.error('Error loading page dimensions:', error);
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
    console.error('❌ PDF loading error:', error);
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
  const getItemSize = useCallback((index: number) => {
    const dimensions = memoizedPageDimensions.get(index);
    const height = dimensions ? Math.ceil(dimensions.height) : 842 * scale; // Use more accurate A4 default
    const totalHeight = height + 16; // Reduced margin for better spacing
    
    // Debug logging for first few pages to check consistency (disabled for performance)
    // if (index <= 6) {
    //   console.log(`📏 Page ${index + 1} dimensions:`, {
    //     width: dimensions?.width,
    //     height: dimensions?.height,
    //     totalHeight,
    //     scale,
    //     hasRealDimensions: !!dimensions
    //   });
    // }
    
    return totalHeight;
  }, [memoizedPageDimensions, scale]);

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
  const handleItemsRendered = useCallback(({ visibleStartIndex, visibleStopIndex }: {
    visibleStartIndex: number;
    visibleStopIndex: number;
  }) => {
    // Update visible pages set
    visiblePagesRef.current.clear();
    for (let i = visibleStartIndex; i <= visibleStopIndex; i++) {
      visiblePagesRef.current.add(i);
    }
    
    // Notify about page change (use middle visible page as current)
    const middleIndex = Math.floor((visibleStartIndex + visibleStopIndex) / 2);
    if (onPageChange && middleIndex >= 0) {
      onPageChange(middleIndex + 1);
    }
  }, [onPageChange]);

  // Memoize renderOverlay to prevent VirtualPageWrapper recreation
  const memoizedRenderOverlay = useMemo(() => renderOverlay, [renderOverlay]);

  // Wrapper component for the virtual list - minimize dependencies to prevent recreations
  const VirtualPageWrapper = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    return (
      <CachedPage
        index={index}
        style={style}
        pdf={pdf}
        pageDimensions={memoizedPageDimensions}
        scale={scale}
        containerWidth={containerWidth}
        renderOverlay={memoizedRenderOverlay}
        pageLoadedRef={pageLoadedRef}
        pageErrorRef={pageErrorRef}
        setLoadingProgress={setLoadingProgress}
      />
    );
  }, [pdf, scale, containerWidth, memoizedRenderOverlay, memoizedPageDimensions]);

  return (
    <div ref={containerRef} className="h-full w-full relative bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
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
            width="100%"
            overscanCount={3} // Reduce overscan to prevent excessive mounting
            onItemsRendered={handleItemsRendered}
            className="pdf-virtual-list"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(175, 95, 55, 0.3) transparent'
            }}
          >
            {VirtualPageWrapper}
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

export default VirtualizedPDFViewer;