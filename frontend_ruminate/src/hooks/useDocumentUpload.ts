import { useState, useRef, useCallback, useEffect } from 'react';
import { CachedDocument, ProcessingProgress, DocumentProcessingEvent, DocumentStatus } from '@/types';
import { authenticatedFetch, API_BASE_URL } from '@/utils/api';
import { documentApi } from '@/services/api/document';

// Utility function (can be moved to a separate utils file if preferred)
async function calculateHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export type UploadMethod = 'auto' | 'backend' | 's3';

interface UseDocumentUploadResult {
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  error: string | null;
  documentId: string | null;
  pdfFile: string | null;
  uploadFile: (file: File, method?: UploadMethod) => Promise<void>;
  uploadFromUrl: (url: string, filename?: string) => Promise<void>;
  resetUploadState: () => void;
  hasUploadedFile: boolean;
  setPdfFileDirectly: (dataUrl: string | null) => void;
  setDocumentIdDirectly: (docId: string | null) => void;
  setHasUploadedFileDirectly: (status: boolean) => void;
  // New properties for enhanced progress tracking
  processingEvents: DocumentProcessingEvent[];
  currentStatus: DocumentStatus;
}

export function useDocumentUpload(): UseDocumentUploadResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [processingEvents, setProcessingEvents] = useState<DocumentProcessingEvent[]>([]);
  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>('PENDING');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount or when dependencies change
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const resetUploadState = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
    setError(null);
    setDocumentId(null);
    setPdfFile(null);
    setHasUploadedFile(false);
    setProcessingEvents([]);
    setCurrentStatus('PENDING');
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }
  }, []);

  // Function to fetch PDF URL (uses presigned URLs for better performance)
  const fetchPdfUrl = async (docId: string): Promise<string | null> => {
    try {
      return await documentApi.getPdfUrl(docId);
    } catch (err) {
      console.error("Error fetching PDF URL:", err);
      setError(`Failed to load PDF URL: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };

  // Helper function to add processing event
  const addProcessingEvent = useCallback((eventType: string, status: DocumentStatus, message?: string, error?: string) => {
    const event: DocumentProcessingEvent = {
      event_type: eventType,
      status,
      document_id: documentId || '',
      message,
      error,
      timestamp: new Date().toISOString()
    };
    
    setProcessingEvents(prev => [...prev, event]);
    setCurrentStatus(status);
    setProgress({
      status,
      detail: message,
      error,
      event_type: eventType
    });
  }, [documentId]);

  const uploadFileViaBackend = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authenticatedFetch(`${API_BASE_URL}/documents/`, {
      method: 'POST', body: formData,
    });

    if (!response.ok) {
      let errorDetail = `Upload failed: ${response.statusText}`; 
      try { 
        const ed = await response.json(); 
        errorDetail = ed.detail || errorDetail; 
      } catch {} 
      throw new Error(errorDetail);
    }

    const initialDocData = await response.json();
    const newDocumentId = initialDocData.document?.id;
    if (!newDocumentId) throw new Error("Server did not return a document ID after upload.");
    
    return newDocumentId;
  };

  const uploadFileViaS3 = async (file: File) => {
    // Get presigned URL
    const urlResponse = await authenticatedFetch(`${API_BASE_URL}/documents/upload-url?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
    });

    if (!urlResponse.ok) {
      throw new Error('Failed to get upload URL');
    }

    const { document_id, upload_url, fields, key } = await urlResponse.json();

    // Create form data for S3
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      formData.append(k, v as string);
    });
    formData.append('file', file);

    // Upload to S3
    const s3Response = await fetch(upload_url, {
      method: 'POST',
      body: formData,
    });

    if (!s3Response.ok) {
      throw new Error('Failed to upload to S3');
    }

    // Confirm upload with backend
    const confirmResponse = await authenticatedFetch(`${API_BASE_URL}/documents/confirm-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id,
        filename: file.name,
        storage_key: key,
      }),
    });

    if (!confirmResponse.ok) {
      throw new Error('Failed to confirm upload');
    }

    return document_id;
  };

  const uploadFile = useCallback(async (file: File, method: UploadMethod = 'auto') => {
    resetUploadState();
    setIsProcessing(true);
    addProcessingEvent('upload_start', 'INITIALIZING', 'Preparing your document for upload...');

    try {
      const fileHash = await calculateHash(file);
      const cachedDocuments = JSON.parse(localStorage.getItem('pdfDocuments') || '{}') as { [hash: string]: CachedDocument };
      const cachedData = cachedDocuments[fileHash];

      if (cachedData) {
        addProcessingEvent('cache_check', 'CACHE_CHECK', 'Checking if this document was processed before...');
        try {
          const docResponse = await authenticatedFetch(`${API_BASE_URL}/documents/${cachedData.documentId}`);
          if (docResponse.ok) {
            const docData = await docResponse.json();
            if (docData.status === "READY") {
              addProcessingEvent('cache_hit', 'CACHE_HIT', 'Great! Found your previously processed document.');
              const pdfUrl = await fetchPdfUrl(cachedData.documentId);
              if (pdfUrl) {
                setDocumentId(cachedData.documentId);
                setPdfFile(pdfUrl);
                setHasUploadedFile(true);
                setIsProcessing(false);
                addProcessingEvent('ready', 'READY', 'Your document is ready to explore!');
                return;
              }
            } else {
              addProcessingEvent('cache_info', 'CACHE_INFO', 'Previous processing incomplete. Starting fresh...');
            }
          } else {
            addProcessingEvent('cache_miss', 'CACHE_MISS', 'Document not found on server. Uploading...');
            delete cachedDocuments[fileHash];
            localStorage.setItem('pdfDocuments', JSON.stringify(cachedDocuments));
          }
        } catch (fetchError) {
          console.error("Error checking cached document:", fetchError);
          addProcessingEvent('cache_error', 'CACHE_ERROR', 'Cache check failed. Proceeding with upload...');
        }
      }

      // ---- Proceed with upload ----
      addProcessingEvent('upload_start', 'UPLOADING', 'Securely uploading your document...');
      const formData = new FormData();
      formData.append('file', file);

      const response = await authenticatedFetch(`${API_BASE_URL}/documents/`, {
        method: 'POST', body: formData,
      });

      if (!response.ok) {
        let errorDetail = `Upload failed: ${response.statusText}`; try { const ed = await response.json(); errorDetail = ed.detail || errorDetail; } catch {} throw new Error(errorDetail);
      }

      const initialDocData = await response.json();
      // Backend returns { document: { id: "..." }, message: "..." }
      const newDocumentId = initialDocData.document?.id;
      if (!newDocumentId) throw new Error("Server did not return a document ID after upload.");

      setDocumentId(newDocumentId);
      addProcessingEvent('upload_complete', 'PROCESSING_START', 'Upload complete! Starting document processing...');

      // ---- Start SSE Listening ----
      const token = localStorage.getItem('auth_token');
      const eventSourceUrl = `${API_BASE_URL}/documents/${newDocumentId}/processing-stream`;
      // Note: EventSource doesn't support custom headers, so we add token as query param
      const authenticatedEventSourceUrl = token ? `${eventSourceUrl}?token=${token}` : eventSourceUrl;
      const es = new EventSource(authenticatedEventSourceUrl);
      eventSourceRef.current = es;

      // Enhanced SSE message handler
      es.onmessage = async (event) => {
        try {
          let eventData;
          
          // Handle case where event.data might contain full SSE format
          if (event.data.includes('event:') && event.data.includes('data:')) {
            // Extract JSON from SSE format
            const lines = event.data.split('\n');
            const dataLine = lines.find((line: string) => line.startsWith('data:'));
            if (dataLine) {
              const jsonStr = dataLine.substring(5).trim(); // Remove 'data:' prefix
              eventData = JSON.parse(jsonStr);
            } else {
              throw new Error('No data line found in SSE message');
            }
          } else {
            // Standard case - event.data should be JSON
            eventData = JSON.parse(event.data);
          }
          
          const status = eventData.status as DocumentStatus;
          const message = eventData.message || eventData.detail;
          const error = eventData.error;
          
          // Map backend statuses to user-friendly messages
          const getDisplayMessage = (status: DocumentStatus, message?: string) => {
            switch (status) {
              case 'PROCESSING_MARKER':
                return 'Our AI is carefully reading through your document...';
              case 'ANALYZING_CONTENT':
                return 'Creating an intelligent summary of your content...';
              case 'ANALYSIS_COMPLETE':
                return 'Almost ready! Finalizing everything...';
              case 'ANALYSIS_WARNING':
                return 'Summary generation had some issues, but your document is still being processed...';
              case 'READY':
                return 'Your document is ready to explore!';
              case 'ERROR':
                return error || message || 'Something went wrong during processing';
              default:
                return message || `Processing: ${status}`;
            }
          };
          
          // Add the processing event
          addProcessingEvent(
            event.type || 'processing_update',
            status,
            getDisplayMessage(status, message),
            error
          );

          // Handle completion states
          if (status === 'READY') {
            es.close();
            eventSourceRef.current = null;
            const pdfUrl = await fetchPdfUrl(newDocumentId);
            if (pdfUrl) {
              setPdfFile(pdfUrl);
              setHasUploadedFile(true);
              cachedDocuments[fileHash] = { 
                documentId: newDocumentId, 
                title: file.name, 
                blockConversations: {} 
              };
              localStorage.setItem('pdfDocuments', JSON.stringify(cachedDocuments));
            }
            setIsProcessing(false);
          } else if (status === 'ERROR') {
            es.close();
            eventSourceRef.current = null;
            setError(getDisplayMessage(status, message));
            setIsProcessing(false);
          }
          
        } catch (parseError) {
          console.error("Failed to parse SSE message:", event.data, parseError);
          addProcessingEvent('parse_error', 'ERROR', 'Received invalid update from server');
          setError("Communication error during processing");
          es.close();
          eventSourceRef.current = null;
          setIsProcessing(false);
        }
      };

      es.onerror = (err) => {
        console.error("EventSource failed:", err);
        addProcessingEvent('connection_error', 'ERROR', 'Lost connection during processing');
        setError("Connection error during processing. Please try again.");
        es.close();
        eventSourceRef.current = null;
        setIsProcessing(false);
      };

    } catch (err) {
      console.error("Upload process failed:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown upload error occurred.";
      addProcessingEvent('upload_error', 'ERROR', errorMessage);
      setError(errorMessage);
      setIsProcessing(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [resetUploadState, addProcessingEvent]);

  // Upload from URL (e.g., from external PDF generation service)
  const uploadFromUrl = useCallback(async (url: string, filename: string = 'generated.pdf') => {
    resetUploadState();
    setIsProcessing(true);
    addProcessingEvent('upload_start', 'INITIALIZING', 'Generating PDF from URL...');

    try {
      // Step 1: Get presigned URL from backend
      addProcessingEvent('presigned_url', 'UPLOADING', 'Getting upload location...');
      const { upload_url, fields, key } = await documentApi.getUploadUrl(filename);
      
      // Step 2: Use SSE endpoint for real-time progress
      addProcessingEvent('pdf_generation', 'UPLOADING', 'Connecting to PDF generation service...');
      
      // Extract the user's URL from the augment URL
      const urlParams = new URL(url).searchParams;
      const userUrl = urlParams.get('url') || url;
      
      // Create request body with presigned post data
      const requestBody = {
        url: userUrl,
        presigned_post_data: {
          url: upload_url,
          fields: fields
        }
      };
      
      // Use EventSource for SSE
      const sseUrl = 'https://augment.explainai.pro/generate-pdf-sse';
      const response = await fetch(sseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error('Failed to start PDF generation');
      }
      
      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value);
            const lines = text.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  switch (data.status) {
                    case 'navigating':
                      addProcessingEvent('pdf_navigating', 'UPLOADING', data.message);
                      break;
                    case 'generating':
                      addProcessingEvent('pdf_generating', 'UPLOADING', data.message);
                      break;
                    case 'uploading':
                      addProcessingEvent('pdf_uploading', 'UPLOADING', data.message);
                      break;
                    case 'complete':
                      addProcessingEvent('pdf_complete', 'UPLOADING', 'PDF uploaded successfully!');
                      break;
                    case 'error':
                      throw new Error(data.error || 'PDF generation failed');
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      
      // Step 4: Confirm upload with backend
      addProcessingEvent('confirm_upload', 'UPLOADING', 'Confirming upload with server...');
      const result = await documentApi.confirmS3Upload(key, filename);
      
      const newDocumentId = result.document?.id;
      if (!newDocumentId) throw new Error("Server did not return a document ID after upload.");
      
      setDocumentId(newDocumentId);
      addProcessingEvent('upload_complete', 'PROCESSING_START', 'Upload complete! Starting document processing...');
      
      // Start SSE listening for processing updates
      const token = localStorage.getItem('auth_token');
      const eventSourceUrl = `${API_BASE_URL}/documents/${newDocumentId}/processing-stream`;
      const authenticatedEventSourceUrl = token ? `${eventSourceUrl}?token=${token}` : eventSourceUrl;
      const es = new EventSource(authenticatedEventSourceUrl);
      eventSourceRef.current = es;
      
      // Set up SSE handlers (same as regular upload)
      es.onmessage = async (event) => {
        try {
          let eventData;
          
          // Handle case where event.data might contain full SSE format
          if (event.data.includes('event:') && event.data.includes('data:')) {
            // Extract JSON from SSE format
            const lines = event.data.split('\n');
            const dataLine = lines.find((line: string) => line.startsWith('data:'));
            if (dataLine) {
              const jsonStr = dataLine.substring(5).trim(); // Remove 'data:' prefix
              eventData = JSON.parse(jsonStr);
            } else {
              throw new Error('No data line found in SSE message');
            }
          } else {
            // Standard case - event.data should be JSON
            eventData = JSON.parse(event.data);
          }
          
          const status = eventData.status as DocumentStatus;
          const message = eventData.message || eventData.detail;
          const error = eventData.error;
          
          addProcessingEvent(status.toLowerCase(), status, message, error);
          
          if (status === 'READY') {
            const pdfUrl = await fetchPdfUrl(newDocumentId);
            if (pdfUrl) {
              setPdfFile(pdfUrl);
              setHasUploadedFile(true);
              setIsProcessing(false);
              
              // Cache the document
              const cachedDocuments = JSON.parse(localStorage.getItem('pdfDocuments') || '{}');
              cachedDocuments[filename] = { documentId: newDocumentId, pdfUrl };
              localStorage.setItem('pdfDocuments', JSON.stringify(cachedDocuments));
            }
            es.close();
          } else if (status === 'ERROR') {
            setError(error || message || 'Processing failed');
            setIsProcessing(false);
            es.close();
          }
        } catch (err) {
          console.error('Error processing SSE message:', err);
        }
      };
      
      es.onerror = (err) => {
        console.error('SSE Error:', err);
        setError('Lost connection to processing server');
        setIsProcessing(false);
        es.close();
      };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsProcessing(false);
      addProcessingEvent('upload_error', 'ERROR', undefined, errorMessage);
    }
  }, [resetUploadState, addProcessingEvent, fetchPdfUrl]);

  // Functions to allow LandingPage to set state when selecting an existing document
  const setPdfFileDirectly = useCallback((dataUrl: string | null) => setPdfFile(dataUrl), []);
  const setDocumentIdDirectly = useCallback((docId: string | null) => setDocumentId(docId), []);
  const setHasUploadedFileDirectly = useCallback((status: boolean) => setHasUploadedFile(status), []);


  return {
    isProcessing,
    progress,
    error,
    documentId,
    pdfFile,
    uploadFile,
    uploadFromUrl,
    resetUploadState,
    hasUploadedFile,
    setPdfFileDirectly,
    setDocumentIdDirectly,
    setHasUploadedFileDirectly,
    processingEvents,
    currentStatus
  };
}
