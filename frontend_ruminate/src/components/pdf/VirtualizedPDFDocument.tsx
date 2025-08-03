import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import { Worker, Viewer, RenderPageProps } from "@react-pdf-viewer/core";
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import "@react-pdf-viewer/core/lib/styles/index.css";
import { Block } from './PDFViewer';

interface VirtualizedPDFDocumentProps {
  pdfFile: string;
  blocks: Block[];
  currentPage: number;
  totalPages: number;
  scale: number;
  renderOverlay: (props: {
    pageIndex: number;
    scale: number;
    rotation: number;
  }) => React.ReactNode;
  onPageChange?: (pageNumber: number) => void;
  onDocumentLoad?: (e: any) => void;
  scrollToPageRef?: React.MutableRefObject<(pageNumber: number) => void>;
  forceRefreshKey?: number;
}

interface PageInfo {
  index: number;
  height: number;
  width: number;
}

const VirtualizedPDFDocument: React.FC<VirtualizedPDFDocumentProps> = ({
  pdfFile,
  blocks,
  currentPage,
  totalPages,
  scale = 1,
  renderOverlay,
  onPageChange,
  onDocumentLoad,
  scrollToPageRef,
  forceRefreshKey = 0
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const [containerHeight, setContainerHeight] = useState(0);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  
  // Create page navigation plugin
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { CurrentPageInput, GoToNextPage, GoToPreviousPage, NumberOfPages } = pageNavigationPluginInstance;

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

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Handle document load to get page dimensions
  const handleDocumentLoad = useCallback((e: any) => {
    setPdfDoc(e.doc);
    
    // Calculate page heights based on scale
    const heights = new Array(e.doc.numPages).fill(842 * scale); // A4 default height
    setPageHeights(heights);
    
    if (onDocumentLoad) {
      onDocumentLoad(e);
    }
  }, [scale, onDocumentLoad]);

  // Get item size (page height + margin)
  const getItemSize = useCallback((index: number) => {
    return (pageHeights[index] || 842 * scale) + 32; // Add margin
  }, [pageHeights, scale]);

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
    // Notify about page change (use middle visible page as current)
    const middleIndex = Math.floor((visibleStartIndex + visibleStopIndex) / 2);
    if (onPageChange && middleIndex + 1 !== currentPage) {
      onPageChange(middleIndex + 1);
    }
  }, [currentPage, onPageChange]);

  // Custom render page function for virtualization
  const renderPage = useCallback((props: RenderPageProps) => {
    const { pageIndex, canvasLayer, textLayer, annotationLayer } = props;
    
    return (
      <>
        {canvasLayer.children}
        {textLayer.children}
        {renderOverlay({
          pageIndex,
          scale: props.scale || scale,
          rotation: props.rotation || 0
        })}
      </>
    );
  }, [renderOverlay, scale]);

  // Virtual page renderer component
  const VirtualPage = React.memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const [isVisible, setIsVisible] = useState(false);
    const pageRef = useRef<HTMLDivElement>(null);

    // Use Intersection Observer to track visibility
    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            setIsVisible(entry.isIntersecting);
          });
        },
        {
          rootMargin: '100px', // Pre-load pages slightly before they're visible
          threshold: 0
        }
      );

      if (pageRef.current) {
        observer.observe(pageRef.current);
      }

      return () => {
        if (pageRef.current) {
          observer.unobserve(pageRef.current);
        }
      };
    }, []);

    return (
      <div ref={pageRef} style={style} className="pdf-page-wrapper flex justify-center">
        {isVisible && viewerRef.current ? (
          <div className="relative shadow-book rounded-book bg-white">
            {/* Render individual page using the viewer instance */}
            {viewerRef.current.renderPage(index)}
            
            {/* Page number indicator */}
            <div className="absolute bottom-4 right-4 bg-library-mahogany-600/80 text-white px-2 py-1 rounded text-xs">
              Page {index + 1}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center bg-white shadow-book rounded-book" 
               style={{ height: pageHeights[index] || 842 * scale, width: 595 * scale }}>
            <div className="text-reading-muted">Loading page {index + 1}...</div>
          </div>
        )}
      </div>
    );
  });

  VirtualPage.displayName = 'VirtualPage';

  return (
    <div ref={containerRef} className="h-full w-full relative">
      {/* Hidden Viewer for PDF processing */}
      <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer
            key={forceRefreshKey}
            fileUrl={pdfFile}
            plugins={[pageNavigationPluginInstance]}
            onDocumentLoad={handleDocumentLoad}
            renderPage={renderPage}
            ref={viewerRef}
          />
        </Worker>
      </div>

      {/* Virtual list for visible pages */}
      {pdfDoc && containerHeight > 0 && (
        <List
          ref={listRef}
          height={containerHeight}
          itemCount={totalPages}
          itemSize={getItemSize}
          width="100%"
          overscanCount={2}
          onItemsRendered={handleItemsRendered}
          className="pdf-virtual-list"
        >
          {VirtualPage}
        </List>
      )}

      {/* Loading state */}
      {!pdfDoc && (
        <div className="flex items-center justify-center h-full">
          <div className="bg-white rounded-journal shadow-shelf p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-library-mahogany-600 mx-auto"></div>
            <p className="mt-4 text-reading-secondary">Loading document...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualizedPDFDocument;