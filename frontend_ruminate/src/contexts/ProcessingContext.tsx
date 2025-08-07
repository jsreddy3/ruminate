"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DocumentProcessingEvent, DocumentStatus } from '@/types';
import { API_BASE_URL } from '@/utils/api';

interface ProcessingDocument {
  documentId: string;
  title: string;
  status: DocumentStatus;
  events: DocumentProcessingEvent[];
  startedAt: Date;
  eventSource?: EventSource;
  // For multi-chunk documents
  batchId?: string;
  totalChunks?: number;
  chunkIndex?: number;
  isParent?: boolean;
}

interface ProcessingContextType {
  processingDocuments: Map<string, ProcessingDocument>;
  activeCount: number;
  startProcessing: (documentId: string, title: string) => void;
  completeProcessing: (documentId: string) => void;
  getProcessing: (documentId: string) => ProcessingDocument | null;
  isProcessing: (documentId: string) => boolean;
  // Modal management
  selectedDocumentId: string | null;
  openProcessingModal: (documentId: string) => void;
  closeProcessingModal: () => void;
  isModalOpen: boolean;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

const STORAGE_KEY = 'ruminate_active_processing';
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 3; // Maximum number of reconnection attempts

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [processingDocuments, setProcessingDocuments] = useState<Map<string, ProcessingDocument>>(new Map());
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const reconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());

  // Calculate active count
  const activeCount = Array.from(processingDocuments.values()).filter(
    doc => !['READY', 'ERROR'].includes(doc.status)
  ).length;

  // Clean up function for SSE connections
  const cleanupEventSource = useCallback((documentId: string) => {
    const es = eventSourcesRef.current.get(documentId);
    if (es) {
      es.close();
      eventSourcesRef.current.delete(documentId);
    }
    
    const timeout = reconnectTimeoutsRef.current.get(documentId);
    if (timeout) {
      clearTimeout(timeout);
      reconnectTimeoutsRef.current.delete(documentId);
    }
    
    // Clear reconnect attempts when cleaning up
    reconnectAttemptsRef.current.delete(documentId);
  }, []);

  // Add processing event to document
  const addProcessingEvent = useCallback((documentId: string, event: DocumentProcessingEvent) => {
    setProcessingDocuments(prev => {
      const updated = new Map(prev);
      const doc = updated.get(documentId);
      if (doc) {
        // Create new events array to trigger React re-render
        const updatedDoc = {
          ...doc,
          events: [...doc.events, event],
          status: event.status
        };
        updated.set(documentId, updatedDoc);
      }
      return updated;
    });
  }, []);

  // Connect to SSE stream for a document
  const connectToProcessingStream = useCallback((documentId: string, isReconnect: boolean = false) => {
    // Clean up any existing connection
    cleanupEventSource(documentId);

    const token = localStorage.getItem('auth_token');
    const eventSourceUrl = `${API_BASE_URL}/documents/${documentId}/processing-stream`;
    const authenticatedUrl = token ? `${eventSourceUrl}?token=${token}` : eventSourceUrl;
    
    console.log('[ProcessingContext] Connecting to SSE:', authenticatedUrl);
    const es = new EventSource(authenticatedUrl);
    eventSourcesRef.current.set(documentId, es);
    
    // Set a timeout for initial connection
    const connectionTimeout = setTimeout(() => {
      if (es.readyState !== EventSource.OPEN) {
        console.error(`Initial connection timeout for document ${documentId}`);
        es.close();
        // Trigger error handler
        es.onerror?.(new Event('error'));
      }
    }, 10000); // 10 second timeout for initial connection
    
    es.onopen = () => {
      // Clear connection timeout on successful open
      clearTimeout(connectionTimeout);
      console.log(`SSE connection established for document ${documentId}`);
      // Reset reconnect attempts on successful connection
      reconnectAttemptsRef.current.set(documentId, 0);
    };

    es.onmessage = async (event) => {
      // Clear connection timeout on successful message
      clearTimeout(connectionTimeout);
      
      try {
        let eventData;
        
        // Parse SSE data (handle both standard and wrapped formats)
        if (event.data.includes('event:') && event.data.includes('data:')) {
          const lines = event.data.split('\n');
          const dataLine = lines.find((line: string) => line.startsWith('data:'));
          if (dataLine) {
            eventData = JSON.parse(dataLine.substring(5).trim());
          }
        } else {
          eventData = JSON.parse(event.data);
        }
        
        const status = eventData.status as DocumentStatus;
        const message = eventData.message || eventData.detail;
        const error = eventData.error;
        
        // Create processing event
        const processingEvent: DocumentProcessingEvent = {
          event_type: event.type || 'processing_update',
          status,
          document_id: documentId,
          message: getDisplayMessage(status, message),
          error,
          timestamp: new Date().toISOString()
        };
        
        addProcessingEvent(documentId, processingEvent);
        
        // Handle completion states
        if (status === 'READY') {
          cleanupEventSource(documentId);
          
          // Auto-navigate to viewer if user is on home page when processing completes
          if (window.location.pathname === '/home') {
            setTimeout(() => {
              window.location.href = `/viewer/${documentId}`;
            }, 1000);
          }
        } else if (status === 'ERROR') {
          cleanupEventSource(documentId);
        }
      } catch (parseError) {
        console.error("Failed to parse SSE message:", parseError);
        addProcessingEvent(documentId, {
          event_type: 'parse_error',
          status: 'ERROR',
          document_id: documentId,
          message: 'Communication error during processing',
          timestamp: new Date().toISOString()
        });
      }
    };

    es.onerror = (error) => {
      console.error(`EventSource failed for document ${documentId}`, {
        readyState: es.readyState,
        url: authenticatedUrl,
        error: error,
        isReconnect: isReconnect
      });
      cleanupEventSource(documentId);
      
      // Get current document status and reconnect attempts
      const doc = processingDocuments.get(documentId);
      const currentAttempts = reconnectAttemptsRef.current.get(documentId) || 0;
      
      if (doc && !['READY', 'ERROR'].includes(doc.status)) {
        // IMMEDIATELY show error to user before retry
        if (!isReconnect || currentAttempts === 0) {
          // First failure - show immediate feedback
          addProcessingEvent(documentId, {
            event_type: 'connection_error',
            status: doc.status,
            document_id: documentId,
            message: 'Connection to processing service lost. Attempting to reconnect...',
            timestamp: new Date().toISOString()
          });
        }
        
        if (currentAttempts < MAX_RECONNECT_ATTEMPTS) {
          // Increment attempt counter
          reconnectAttemptsRef.current.set(documentId, currentAttempts + 1);
          
          // Update message to show retry attempt
          addProcessingEvent(documentId, {
            event_type: 'connection_error',
            status: doc.status,
            document_id: documentId,
            message: `Reconnecting... (attempt ${currentAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
            timestamp: new Date().toISOString()
          });
          
          // Attempt to reconnect after delay
          const timeout = setTimeout(() => {
            console.log(`Attempting to reconnect for document ${documentId} (attempt ${currentAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            connectToProcessingStream(documentId, true);
          }, RECONNECT_DELAY);
          reconnectTimeoutsRef.current.set(documentId, timeout);
        } else {
          // Max attempts reached - mark as permanent failure
          console.error(`Max reconnection attempts reached for document ${documentId}`);
          
          addProcessingEvent(documentId, {
            event_type: 'processing_failed',
            status: 'ERROR',
            document_id: documentId,
            message: 'Processing failed. The document could not be processed successfully.',
            error: 'The processing service is not responding. Please try uploading your document again.',
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }, [processingDocuments, addProcessingEvent, cleanupEventSource]);

  // Start processing a document
  const startProcessing = useCallback((documentId: string, title: string) => {
    console.log('[ProcessingContext] Starting processing for:', documentId, title);
    
    const newDoc: ProcessingDocument = {
      documentId,
      title,
      status: 'PROCESSING_START',
      events: [{
        event_type: 'processing_start',
        status: 'PROCESSING_START',
        document_id: documentId,
        message: 'Starting document processing...',
        timestamp: new Date().toISOString()
      }],
      startedAt: new Date()
    };
    
    setProcessingDocuments(prev => {
      const updated = new Map(prev);
      updated.set(documentId, newDoc);
      console.log('[ProcessingContext] Processing documents count:', updated.size);
      return updated;
    });
    
    // Connect to SSE stream
    connectToProcessingStream(documentId);
  }, [connectToProcessingStream]);

  // Complete processing (cleanup)
  const completeProcessing = useCallback((documentId: string) => {
    cleanupEventSource(documentId);
    
    // Keep the document in state but mark as completed
    // This allows users to still view the processing history
  }, [cleanupEventSource]);

  // Get processing document
  const getProcessing = useCallback((documentId: string): ProcessingDocument | null => {
    return processingDocuments.get(documentId) || null;
  }, [processingDocuments]);

  // Check if document is processing
  const isProcessing = useCallback((documentId: string): boolean => {
    const doc = processingDocuments.get(documentId);
    return doc ? !['READY', 'ERROR'].includes(doc.status) : false;
  }, [processingDocuments]);

  // Modal management
  const openProcessingModal = useCallback((documentId: string) => {
    console.log('[ProcessingContext] Opening modal for:', documentId);
    setSelectedDocumentId(documentId);
    setIsModalOpen(true);
  }, []);

  const closeProcessingModal = useCallback(() => {
    console.log('[ProcessingContext] Closing modal');
    setIsModalOpen(false);
    // Don't clear selectedDocumentId immediately for animation purposes
    setTimeout(() => setSelectedDocumentId(null), 300);
  }, []);

  // Persist active processing to localStorage
  useEffect(() => {
    const activeProcessing = Array.from(processingDocuments.entries())
      .filter(([_, doc]) => !['READY', 'ERROR'].includes(doc.status))
      .map(([id, doc]) => ({
        documentId: id,
        title: doc.title,
        status: doc.status,
        startedAt: doc.startedAt.toISOString()
      }));
    
    if (activeProcessing.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeProcessing));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [processingDocuments]);

  // Restore processing state on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const documents = JSON.parse(saved);
        documents.forEach((doc: any) => {
          // Recreate the processing document
          const restoredDoc: ProcessingDocument = {
            documentId: doc.documentId,
            title: doc.title,
            status: doc.status,
            events: [{
              event_type: 'restored',
              status: doc.status,
              document_id: doc.documentId,
              message: 'Resuming processing after page refresh...',
              timestamp: new Date().toISOString()
            }],
            startedAt: new Date(doc.startedAt)
          };
          
          setProcessingDocuments(prev => {
            const updated = new Map(prev);
            updated.set(doc.documentId, restoredDoc);
            return updated;
          });
          
          // Reconnect to SSE stream
          setTimeout(() => {
            connectToProcessingStream(doc.documentId, true);
          }, 100); // Small delay to ensure state is set
        });
      } catch (error) {
        console.error('Failed to restore processing state:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []); // Run only on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Close all event sources
      eventSourcesRef.current.forEach((es, id) => {
        cleanupEventSource(id);
      });
    };
  }, [cleanupEventSource]);

  return (
    <ProcessingContext.Provider value={{
      processingDocuments,
      activeCount,
      startProcessing,
      completeProcessing,
      getProcessing,
      isProcessing,
      selectedDocumentId,
      openProcessingModal,
      closeProcessingModal,
      isModalOpen
    }}>
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (context === undefined) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
}

// Helper function to get display message for status
function getDisplayMessage(status: DocumentStatus, message?: string): string {
  switch (status) {
    case 'PROCESSING_MARKER':
      return 'Our AI is carefully reading through your document...';
    case 'ANALYZING_CONTENT':
      return 'Creating an intelligent summary of your content...';
    case 'ANALYSIS_COMPLETE':
      return 'Almost ready! Finalizing everything...';
    case 'READY':
      return 'Your document is ready to explore!';
    case 'ERROR':
      return message || 'Something went wrong during processing';
    default:
      return message || `Processing: ${status}`;
  }
}