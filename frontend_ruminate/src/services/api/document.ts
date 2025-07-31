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
  // Reading progress fields
  furthest_read_block_id?: string | null;
  furthest_read_position?: number | null;
  furthest_read_updated_at?: string | null;
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
   * @returns Enhanced definition response with positioning data
   */
  getTermDefinition: async (
    documentId: string, 
    blockId: string, 
    term: string,
    textStartOffset: number,
    textEndOffset: number,
    surroundingText?: string
  ): Promise<{ 
    term: string; 
    definition: string; 
    text_start_offset: number;
    text_end_offset: number;
    created_at: string;
    context?: string;
    block_id: string;
  }> => {
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

  /**
   * Create or update an annotation on a block
   * @param documentId Document ID
   * @param blockId Block ID containing the annotation
   * @param text The selected text being annotated
   * @param note The annotation content
   * @param textStartOffset Start position of the annotated text in the block
   * @param textEndOffset End position of the annotated text in the block
   * @returns Complete annotation data or success message for deletion
   */
  createAnnotation: async (
    documentId: string,
    blockId: string,
    text: string,
    note: string,
    textStartOffset: number,
    textEndOffset: number
  ): Promise<{ 
    id: string;
    text: string;
    note: string;
    text_start_offset: number;
    text_end_offset: number;
    created_at: string;
    updated_at: string;
  } | { message: string }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/blocks/${blockId}/annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        note,
        text_start_offset: textStartOffset,
        text_end_offset: textEndOffset
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to create annotation");
    }
    
    return response.json();
  },

  /**
   * Delete an annotation by sending empty note
   * @param documentId Document ID
   * @param blockId Block ID containing the annotation
   * @param text The selected text (for identification)
   * @param textStartOffset Start position of the annotated text
   * @param textEndOffset End position of the annotated text
   * @returns Success message
   */
  deleteAnnotation: async (
    documentId: string,
    blockId: string,
    text: string,
    textStartOffset: number,
    textEndOffset: number
  ): Promise<{ message: string }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/blocks/${blockId}/annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        note: "", // Empty note deletes the annotation
        text_start_offset: textStartOffset,
        text_end_offset: textEndOffset
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to delete annotation");
    }
    
    return response.json();
  },

  /**
   * Delete a document and all its associated data
   * @param documentId Document ID to delete
   * @returns Success message
   */
  deleteDocument: async (documentId: string): Promise<{ message: string }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to delete document");
    }
    
    return response.json();
  },

  /**
   * Update document metadata
   * @param documentId Document ID to update
   * @param updates Object containing fields to update (e.g., { title: "New Title" })
   * @returns Updated document
   */
  updateDocument: async (documentId: string, updates: { title?: string }): Promise<Document> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to update document');
    }
    
    return response.json();
  },

  /**
   * Start processing for a document chunk in AWAITING_PROCESSING status
   * @param documentId Document ID to start processing
   * @returns Updated document object
   */
  startProcessing: async (documentId: string): Promise<Document> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/start-processing`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to start processing");
    }
    
    return response.json();
  },

  /**
   * Get presigned upload URL for direct S3 upload
   * @param filename The filename to upload
   * @returns Upload URL, form fields, and S3 key
   */
  getUploadUrl: async (filename: string): Promise<{
    upload_url: string;
    fields: Record<string, string>;
    key: string;
  }> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/documents/upload-url?filename=${encodeURIComponent(filename)}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to get upload URL');
    }
    
    return response.json();
  },

  /**
   * Confirm S3 upload and start processing
   * @param s3Key The S3 key where file was uploaded
   * @param filename The original filename
   * @returns Document upload response
   */
  confirmS3Upload: async (s3Key: string, filename: string): Promise<{
    document: Document;
    message: string;
  }> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/documents/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          s3_key: s3Key,
          filename: filename
        })
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to confirm upload');
    }
    
    return response.json();
  },

  /**
   * Update reading progress for a document
   * @param documentId Document ID
   * @param blockId ID of the furthest read block  
   * @param position Position of the block in reading order
   * @returns Updated document with reading progress
   */
  updateReadingProgress: async (
    documentId: string, 
    blockId: string, 
    position: number
  ): Promise<Document> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/reading-progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        block_id: blockId,
        position: position
      })
    });
    
    if (!response.ok) {
      throw new Error("Failed to update reading progress");
    }
    
    return response.json();
  },

  /**
   * Get a specific block by ID with its metadata
   * @param documentId Document ID
   * @param blockId Block ID
   * @returns Block object with metadata including annotations
   */
  getBlock: async (documentId: string, blockId: string): Promise<{
    id: string;
    block_type?: string;
    html_content?: string;
    metadata?: {
      annotations?: {
        [key: string]: {
          id: string;
          text: string;
          note: string;
          text_start_offset: number;
          text_end_offset: number;
          created_at: string;
          updated_at: string;
          is_generated?: boolean;
          source_conversation_id?: string;
          message_count?: number;
          topic?: string;
        };
      };
    };
    [key: string]: any;
  }> => {
    const response = await authenticatedFetch(`${API_BASE_URL}/documents/${documentId}/blocks/${blockId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch block");
    }
    return response.json();
  },
};
