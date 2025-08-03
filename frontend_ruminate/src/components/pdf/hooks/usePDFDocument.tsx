import { useState, useEffect, useCallback, useRef } from 'react';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

export type PDFLoadingState = 'idle' | 'loading' | 'loaded' | 'error' | 'stuck';

interface UsePDFDocumentProps {
  pdfFile: string;
  documentId: string;
}

interface UsePDFDocumentReturn {
  // State
  pdfLoadingState: PDFLoadingState;
  currentPage: number;
  totalPages: number;
  forceRefreshKey: number;
  
  // Plugin instances
  zoomPluginInstance: ReturnType<typeof zoomPlugin>;
  pageNavigationPluginInstance: ReturnType<typeof pageNavigationPlugin>;
  defaultLayoutPluginInstance: ReturnType<typeof defaultLayoutPlugin>;
  
  // Actions
  handleForceRefresh: () => void;
  handleDocumentLoad: (e: any) => void;
  handlePageChange: (e: any) => void;
  setCurrentPage: (page: number) => void;
  
  // Components from plugins
  ZoomIn: any;
  ZoomOut: any;
  GoToNextPage: any;
  GoToPreviousPage: any;
}

export function usePDFDocument({
  pdfFile,
  documentId
}: UsePDFDocumentProps): UsePDFDocumentReturn {
  // PDF loading state management
  const [pdfLoadingState, setPdfLoadingState] = useState<PDFLoadingState>('idle');
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  
  // Page state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  
  // Create plugin instances (these are stable and don't need to be in state)
  const zoomPluginInstance = zoomPlugin();
  const { ZoomIn, ZoomOut } = zoomPluginInstance;

  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { GoToNextPage, GoToPreviousPage } = pageNavigationPluginInstance;

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    toolbarPlugin: {
      fullScreenPlugin: {
        onEnterFullScreen: () => { },
        onExitFullScreen: () => { },
      },
      searchPlugin: {
        keyword: [''],
      },
    },
    renderToolbar: () => <></>, // Hide the default toolbar
    sidebarTabs: () => [],
  });
  
  // Debug PDF URL
  useEffect(() => {
    if (pdfFile.startsWith('data:application/pdf;base64,')) {
      const base64Length = pdfFile.length;
      const estimatedSizeMB = (base64Length * 0.75) / (1024 * 1024);
      
      if (base64Length > 10000000) { // ~7.5MB
        console.warn('⚠️ Very large base64 PDF - this might cause loading issues');
      }
    } else {
      if (pdfFile.startsWith('file://')) {
        console.error('❌ Invalid PDF URL: file:// URLs cannot be loaded in browsers');
      }
    }
  }, [pdfFile, documentId]);
  
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
  
  // Track when PDF starts loading
  useEffect(() => {
    if (pdfLoadingState === 'idle') {
      const timer = setTimeout(() => {
        setPdfLoadingState('loading');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [forceRefreshKey, pdfLoadingState]);
  
  // Force refresh function
  const handleForceRefresh = useCallback(() => {
    setPdfLoadingState('idle');
    setForceRefreshKey(prev => prev + 1);
    
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  }, [loadingTimeout]);
  
  // Handle document load event
  const handleDocumentLoad = useCallback((e: any) => {
    setPdfLoadingState('loaded');
    setTotalPages(e.doc.numPages);
    setCurrentPage(1);
  }, []);
  
  // Handle page change event
  const handlePageChange = useCallback((e: any) => {
    setCurrentPage(e.currentPage + 1);
  }, []);
  
  return {
    // State
    pdfLoadingState,
    currentPage,
    totalPages,
    forceRefreshKey,
    
    // Plugin instances
    zoomPluginInstance,
    pageNavigationPluginInstance,
    defaultLayoutPluginInstance,
    
    // Actions
    handleForceRefresh,
    handleDocumentLoad,
    handlePageChange,
    setCurrentPage,
    
    // Components from plugins
    ZoomIn,
    ZoomOut,
    GoToNextPage,
    GoToPreviousPage,
  };
}