import { useState, useRef, useCallback, useEffect } from 'react';
import { CachedDocument, ProcessingProgress } from '@/types';
import { authenticatedFetch, API_BASE_URL } from '@/utils/api';
import { documentApi } from '@/services/api/document';

// Utility function (can be moved to a separate utils file if preferred)
async function calculateHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface UseDocumentUploadResult {
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  error: string | null;
  documentId: string | null; // ID of the document being processed or completed
  pdfFile: string | null; // Data URL of the PDF for viewing
  uploadFile: (file: File) => Promise<void>;
  resetUploadState: () => void; // Function to reset state if needed
  hasUploadedFile: boolean; // Indicates if a file has been successfully processed and is ready
  setPdfFileDirectly: (dataUrl: string | null) => void;
  setDocumentIdDirectly: (docId: string | null) => void;
  setHasUploadedFileDirectly: (status: boolean) => void;
}

export function useDocumentUpload(): UseDocumentUploadResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount or when dependencies change
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        // console.log("Closing EventSource connection on cleanup.");
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

  const uploadFile = useCallback(async (file: File) => {
    resetUploadState(); // Reset state before starting a new upload
    setIsProcessing(true);
    setProgress({ status: "INITIALIZING", detail: "Preparing upload..." });

    try {
      const fileHash = await calculateHash(file);
      const cachedDocuments = JSON.parse(localStorage.getItem('pdfDocuments') || '{}') as { [hash: string]: CachedDocument };
      const cachedData = cachedDocuments[fileHash];

      if (cachedData) {
         setProgress({ status: "CACHE_CHECK", detail: "Checking cache..." });
        try {
          const docResponse = await authenticatedFetch(`${API_BASE_URL}/documents/${cachedData.documentId}`);
          if (docResponse.ok) {
            const docData = await docResponse.json();
            if (docData.status === "READY") {
              setProgress({ status: "CACHE_HIT", detail: "Found previously processed document." });
              const pdfUrl = await fetchPdfUrl(cachedData.documentId);
              if (pdfUrl) {
                setDocumentId(cachedData.documentId);
                setPdfFile(pdfUrl);
                setHasUploadedFile(true);
                setIsProcessing(false);
                setProgress(null);
                return; // Exit early
              }
            } else {
                 setProgress({ status: "CACHE_INFO", detail: "Previous processing incomplete or failed. Re-uploading..." });
            }
          } else {
             setProgress({ status: "CACHE_MISS", detail: "Cached record found, but document missing on server. Uploading..." });
             delete cachedDocuments[fileHash];
             localStorage.setItem('pdfDocuments', JSON.stringify(cachedDocuments));
          }
        } catch (fetchError) {
          console.error("Error checking cached document:", fetchError);
           setProgress({ status: "CACHE_ERROR", detail: "Error verifying cached document. Proceeding with upload..." });
        }
      }

      // ---- Proceed with upload ----
      setProgress({ status: "UPLOADING", detail: "Uploading document..." });
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

      setDocumentId(newDocumentId); // Store ID early

      // ---- Start SSE Listening ----
      setProgress({ status: "PROCESSING_START", detail: "Waiting for processing updates..." });
      const token = localStorage.getItem('auth_token');
      const eventSourceUrl = `${API_BASE_URL}/documents/${newDocumentId}/processing-stream`;
      // Note: EventSource doesn't support custom headers, so we add token as query param
      const authenticatedEventSourceUrl = token ? `${eventSourceUrl}?token=${token}` : eventSourceUrl;
      const es = new EventSource(authenticatedEventSourceUrl);
      eventSourceRef.current = es;

      es.onmessage = async (event) => {
        try {
          const progressData: ProcessingProgress = JSON.parse(event.data);
          setProgress(progressData);

          if (progressData.status === "READY") {
            es.close(); eventSourceRef.current = null;
            const pdfUrl = await fetchPdfUrl(newDocumentId);
            if (pdfUrl) {
              setPdfFile(pdfUrl);
              setHasUploadedFile(true);
              cachedDocuments[fileHash] = { documentId: newDocumentId, title: file.name, blockConversations: {} };
              localStorage.setItem('pdfDocuments', JSON.stringify(cachedDocuments));
            } // fetchPdfUrl handles error state
            setIsProcessing(false);
            setProgress(null);
          } else if (progressData.status === "ERROR") {
            es.close(); eventSourceRef.current = null;
            setError(`Processing failed: ${progressData.detail}`);
            setIsProcessing(false);
            setProgress(null);
          }
        } catch (parseError) {
          console.error("Failed to parse SSE message:", event.data, parseError);
          setError("Received invalid progress update.");
          es.close(); eventSourceRef.current = null;
          setIsProcessing(false);
          setProgress(null);
        }
      };

      es.onerror = (err) => {
        console.error("EventSource failed:", err);
        setError("Connection error during processing updates.");
        es.close(); eventSourceRef.current = null;
        setIsProcessing(false);
        setProgress(null);
      };

    } catch (err) {
      console.error("Upload process failed:", err);
      setError(err instanceof Error ? err.message : "An unknown upload error occurred.");
      setIsProcessing(false);
      setProgress(null);
      if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
      }
    }
  }, [resetUploadState]);

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
    resetUploadState,
    hasUploadedFile,
    setPdfFileDirectly,
    setDocumentIdDirectly,
    setHasUploadedFileDirectly
  };
}
