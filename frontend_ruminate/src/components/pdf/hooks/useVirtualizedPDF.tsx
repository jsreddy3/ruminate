import { useState, useCallback, useRef, useEffect } from 'react';

export type PDFLoadingState = 'idle' | 'loading' | 'loaded' | 'error' | 'stuck';

interface UseVirtualizedPDFProps {
  pdfFile: string;
  documentId: string;
  initialScale?: number;
}

interface UseVirtualizedPDFReturn {
  // State
  pdfLoadingState: PDFLoadingState;
  currentPage: number;
  totalPages: number;
  scale: number;
  forceRefreshKey: number;
  
  // Actions
  handleDocumentLoad: (pdf: any) => void;
  handlePageChange: (pageNumber: number) => void;
  handleForceRefresh: () => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (pageNumber: number) => void;
  setCurrentPage: (page: number) => void;
  
  // Refs
  scrollToPageRef: React.MutableRefObject<(pageNumber: number) => void>;
}

export function useVirtualizedPDF({
  pdfFile,
  documentId,
  initialScale = 1
}: UseVirtualizedPDFProps): UseVirtualizedPDFReturn {
  const [pdfLoadingState, setPdfLoadingState] = useState<PDFLoadingState>('idle');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(initialScale);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Ref to store scroll function from virtualized viewer
  const scrollToPageRef = useRef<(pageNumber: number) => void>(() => {});
  
  // Handle document load
  const handleDocumentLoad = useCallback((pdf: any) => {
    setPdfLoadingState('loaded');
    setTotalPages(pdf.numPages);
    setCurrentPage(1);
    // Clear any loading timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  }, [loadingTimeout]);
  
  // Handle page change from virtual list
  const handlePageChange = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);
  
  // Handle force refresh
  const handleForceRefresh = useCallback(() => {
    setPdfLoadingState('idle');
    setForceRefreshKey(prev => prev + 1);
    
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  }, [loadingTimeout]);
  
  // Zoom controls
  const zoomIn = useCallback(() => {
    setScale(prev => {
      const newScale = prev * 1.2;
      return Math.min(newScale, 3); // Max 300% zoom
    });
  }, []);
  
  const zoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = prev / 1.2;
      return Math.max(newScale, 0.5); // Min 50% zoom
    });
  }, []);
  
  // Navigation controls
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      scrollToPageRef.current(nextPage);
    }
  }, [currentPage, totalPages]);
  
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      scrollToPageRef.current(prevPage);
    }
  }, [currentPage]);
  
  const goToPage = useCallback((pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      scrollToPageRef.current(pageNumber);
    }
  }, [totalPages]);
  
  // Set initial loading state and handle timeout
  useEffect(() => {
    if (pdfLoadingState === 'idle') {
      const timer = setTimeout(() => {
        setPdfLoadingState('loading');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [forceRefreshKey, pdfLoadingState]);
  
  // Add timeout mechanism for stuck PDF loading
  useEffect(() => {
    if (pdfLoadingState === 'loading') {
      const timeout = setTimeout(() => {
        console.warn('⚠️ PDF loading timeout reached - marking as stuck');
        setPdfLoadingState('stuck');
      }, 10000); // 10 second timeout
      
      setLoadingTimeout(timeout);
      
      return () => {
        clearTimeout(timeout);
        setLoadingTimeout(null);
      };
    }
  }, [pdfLoadingState]);
  
  return {
    // State
    pdfLoadingState,
    currentPage,
    totalPages,
    scale,
    forceRefreshKey,
    
    // Actions
    handleDocumentLoad,
    handlePageChange,
    handleForceRefresh,
    setScale,
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    setCurrentPage,
    
    // Refs
    scrollToPageRef,
  };
}