import { useState, useCallback, useRef, useEffect } from 'react';
import { PDFLoadingState } from './usePDFDocument';

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
  
  // Actions
  handleDocumentLoad: (pdf: any) => void;
  handlePageChange: (pageNumber: number) => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (pageNumber: number) => void;
  
  // Refs
  scrollToPageRef: React.MutableRefObject<(pageNumber: number) => void>;
}

export function useVirtualizedPDF({
  pdfFile,
  documentId,
  initialScale = 1
}: UseVirtualizedPDFProps): UseVirtualizedPDFReturn {
  const [pdfLoadingState, setPdfLoadingState] = useState<PDFLoadingState>('loading');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(initialScale);
  
  // Ref to store scroll function from virtualized viewer
  const scrollToPageRef = useRef<(pageNumber: number) => void>(() => {});
  
  // Handle document load
  const handleDocumentLoad = useCallback((pdf: any) => {
    setPdfLoadingState('loaded');
    setTotalPages(pdf.numPages);
    setCurrentPage(1);
  }, []);
  
  // Handle page change from virtual list
  const handlePageChange = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);
  
  // Zoom controls
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 3)); // Max 300% zoom
  }, []);
  
  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.2, 0.5)); // Min 50% zoom
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
  
  // Set initial loading state
  useEffect(() => {
    setPdfLoadingState('loading');
  }, [pdfFile]);
  
  return {
    // State
    pdfLoadingState,
    currentPage,
    totalPages,
    scale,
    
    // Actions
    handleDocumentLoad,
    handlePageChange,
    setScale,
    zoomIn,
    zoomOut,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    
    // Refs
    scrollToPageRef,
  };
}