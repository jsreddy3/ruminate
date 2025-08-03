import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { Block } from './PDFViewer';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface VirtualizedPDFViewerProps {
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
  onDocumentLoadSuccess?: (pdf: any) => void;
  scrollToPageRef?: React.MutableRefObject<(pageNumber: number) => void>;
}

interface PageDimensions {
  width: number;
  height: number;
}

const VirtualizedPDFViewer: React.FC<VirtualizedPDFViewerProps> = ({
  pdfFile,
  blocks,
  currentPage,
  totalPages,
  scale = 1,
  renderOverlay,
  onPageChange,
  onDocumentLoadSuccess,
  scrollToPageRef
}) => {
  const [pdf, setPdf] = useState<any>(null);
  const [pageDimensions, setPageDimensions] = useState<Map<number, PageDimensions>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visiblePagesRef = useRef<Set<number>>(new Set());

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
    
    // Pre-calculate page dimensions
    const loadPageDimensions = async () => {
      const dimensions = new Map<number, PageDimensions>();
      
      // Load first page to get default dimensions (most PDFs have uniform pages)
      const firstPage = await loadedPdf.getPage(1);
      const viewport = firstPage.getViewport({ scale });
      const defaultDimensions = {
        width: viewport.width,
        height: viewport.height
      };
      
      // Set default dimensions for all pages initially
      for (let i = 0; i < loadedPdf.numPages; i++) {
        dimensions.set(i, defaultDimensions);
      }
      
      setPageDimensions(dimensions);
      
      // Load actual dimensions for first few pages
      for (let i = 1; i <= Math.min(5, loadedPdf.numPages); i++) {
        const page = await loadedPdf.getPage(i);
        const viewport = page.getViewport({ scale });
        dimensions.set(i - 1, {
          width: viewport.width,
          height: viewport.height
        });
      }
      
      setPageDimensions(new Map(dimensions));
    };
    
    loadPageDimensions();
    onDocumentLoadSuccess?.(loadedPdf);
  }, [scale, onDocumentLoadSuccess]);

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
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Get item size (page height + margin)
  const getItemSize = useCallback((index: number) => {
    const dimensions = pageDimensions.get(index);
    if (!dimensions) return 800; // Default height
    return dimensions.height + 32; // Add margin
  }, [pageDimensions]);

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

  // Track visible pages
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
    if (onPageChange && middleIndex + 1 !== currentPage) {
      onPageChange(middleIndex + 1);
    }
  }, [currentPage, onPageChange]);

  // Render individual PDF page
  const PDFPageComponent = React.memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const [pageLoaded, setPageLoaded] = useState(false);
    const [pageScale, setPageScale] = useState(scale);
    const pageBlocks = blocksByPage.get(index) || [];

    // Adjust scale to fit container width if needed
    useEffect(() => {
      const dimensions = pageDimensions.get(index);
      if (dimensions && containerWidth > 0) {
        const maxScale = (containerWidth - 64) / dimensions.width * scale; // 64px for margins
        setPageScale(Math.min(scale, maxScale));
      }
    }, [index, containerWidth]);

    return (
      <div 
        style={style} 
        className="pdf-page-container flex justify-center items-start"
      >
        <div className="relative inline-block shadow-book rounded-book bg-white">
          {pdf && (
            <Page
              pageNumber={index + 1}
              scale={pageScale}
              onLoadSuccess={() => setPageLoaded(true)}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="pdf-page"
            >
              {pageLoaded && (
                <div className="absolute inset-0 pointer-events-none">
                  {renderOverlay({
                    pageIndex: index,
                    scale: pageScale,
                    rotation: 0
                  })}
                </div>
              )}
            </Page>
          )}
          
          {/* Page number indicator */}
          <div className="absolute bottom-4 right-4 bg-library-mahogany-600/80 text-white px-2 py-1 rounded text-xs">
            Page {index + 1}
          </div>
        </div>
      </div>
    );
  });

  PDFPageComponent.displayName = 'PDFPageComponent';

  return (
    <div ref={containerRef} className="h-full w-full relative bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment">
      {/* Hidden Document component for loading PDF */}
      <div style={{ position: 'absolute', left: '-9999px' }}>
        <Document
          file={pdfFile}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="text-reading-secondary">Loading PDF...</div>
            </div>
          }
        >
          {/* We don't render pages here, just use Document to load the PDF */}
        </Document>
      </div>

      {/* Virtual list for pages */}
      {pdf && containerHeight > 0 && (
        <List
          ref={listRef}
          height={containerHeight}
          itemCount={totalPages}
          itemSize={getItemSize}
          width="100%"
          overscanCount={2} // Render 2 pages above and below viewport
          onItemsRendered={handleItemsRendered}
          className="pdf-virtual-list"
        >
          {PDFPageComponent}
        </List>
      )}

      {/* Loading state */}
      {!pdf && (
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

export default VirtualizedPDFViewer;