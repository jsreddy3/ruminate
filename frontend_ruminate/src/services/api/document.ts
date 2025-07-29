import { authenticatedFetch, API_BASE_URL } from '@/utils/api';

// Define type for document based on backend model
export interface Document {
  id: string;
  user_id?: string | null;
  status: string;
  s3_pdf_path?: string | null;
  chunk_ids: string[];
  title: string;
  summary?: string | null;
  arguments?: Array<{id: string, name: string}> | null;
  key_themes_terms?: Array<{id: string, name: string}> | null;
  processing_error?: string | null;
  marker_job_id?: string | null;
  marker_check_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export const documentApi = {
  /**
   * Get all uploaded documents
   * @param userId Optional user ID to filter documents
   * @returns Array of document objects
   */
  getAllDocuments: async (userId?: string): Promise<Document[]> => {
    const url = userId 
      ? `${API_BASE_URL}/documents/?user_id=${encodeURIComponent(userId)}`
      : `${API_BASE_URL}/documents/`;
      
    const response = await authenticatedFetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch documents");
    }
    const data = await response.json();
    // Backend returns { documents: Document[], total: number }
    return data.documents || [];
  },

  /**
   * Get a specific document by ID
   * @param documentId Document ID
   * @returns Document object
   */
  getDocument: async (documentId: string): Promise<Document> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch document");
    }
    return response.json();
  },

  /**
   * Get presigned URL for a document PDF
   * @param documentId Document ID
   * @returns Presigned URL for the PDF
   */
  getPdfUrl: async (documentId: string): Promise<string> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/pdf-url`);
    if (!response.ok) {
      throw new Error("Failed to fetch PDF URL");
    }
    
    const data = await response.json();
    return data.pdf_url;
  },

  /**
   * Get contextual definition for a term
   * @param documentId Document ID
   * @param blockId Block ID containing the term
   * @param term The term to define
   * @param textStartOffset Start position of the term in the block
   * @param textEndOffset End position of the term in the block
   * @param surroundingText Optional surrounding text for better context
   * @returns Definition response
   */
  getTermDefinition: async (
    documentId: string, 
    blockId: string, 
    term: string,
    textStartOffset: number,
    textEndOffset: number,
    surroundingText?: string
  ): Promise<{ term: string; definition: string; context?: string }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/define`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        term,
        block_id: blockId,
        text_start_offset: textStartOffset,
        text_end_offset: textEndOffset,
        surrounding_text: surroundingText
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to get definition");
    }
    
    return response.json();
  },
};
