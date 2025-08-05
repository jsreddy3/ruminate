import { useState, useCallback } from 'react';
import { authenticatedFetch, API_BASE_URL } from '@/utils/api';
import { documentApi } from '@/services/api/document';
import { useProcessing } from '@/contexts/ProcessingContext';

export type UploadMethod = 'auto' | 'backend' | 's3';

interface UseDocumentUploadResult {
  isUploading: boolean;
  uploadError: string | null;
  uploadFile: (file: File, method?: UploadMethod) => Promise<string | null>;
  uploadFromUrl: (url: string, filename?: string) => Promise<string | null>;
  resetUploadState: () => void;
}

export function useDocumentUploadV2(): UseDocumentUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { startProcessing } = useProcessing();

  const resetUploadState = useCallback(() => {
    setIsUploading(false);
    setUploadError(null);
  }, []);

  const uploadFile = useCallback(async (file: File, method: UploadMethod = 'auto'): Promise<string | null> => {
    resetUploadState();
    setIsUploading(true);

    try {
      // Upload file to backend
      const formData = new FormData();
      formData.append('file', file);

      const response = await authenticatedFetch(`${API_BASE_URL}/documents/`, {
        method: 'POST',
        body: formData,
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
      if (!newDocumentId) {
        throw new Error("Server did not return a document ID after upload.");
      }

      // Register with processing context - it will handle SSE
      startProcessing(newDocumentId, file.name);
      
      setIsUploading(false);
      return newDocumentId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown upload error occurred.";
      setUploadError(errorMessage);
      setIsUploading(false);
      return null;
    }
  }, [resetUploadState, startProcessing]);

  const uploadFromUrl = useCallback(async (url: string, filename: string = 'generated.pdf'): Promise<string | null> => {
    resetUploadState();
    setIsUploading(true);

    try {
      // Step 1: Get presigned URL from backend
      const { upload_url, fields, key } = await documentApi.getUploadUrl(filename);
      
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
      
      // Read SSE stream for PDF generation progress
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
                  
                  if (data.status === 'error') {
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
      const result = await documentApi.confirmS3Upload(key, filename);
      
      const newDocumentId = result.document?.id;
      if (!newDocumentId) {
        throw new Error("Server did not return a document ID after upload.");
      }
      
      // Register with processing context - it will handle SSE
      startProcessing(newDocumentId, filename);
      
      setIsUploading(false);
      return newDocumentId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setUploadError(errorMessage);
      setIsUploading(false);
      return null;
    }
  }, [resetUploadState, startProcessing]);

  return {
    isUploading,
    uploadError,
    uploadFile,
    uploadFromUrl,
    resetUploadState
  };
}