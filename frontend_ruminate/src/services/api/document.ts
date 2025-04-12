const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

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
      
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch documents");
    }
    return response.json();
  },

  /**
   * Get a specific document by ID
   * @param documentId Document ID
   * @returns Document object
   */
  getDocument: async (documentId: string): Promise<Document> => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch document");
    }
    return response.json();
  },

  /**
   * Get PDF data URL for a document
   * @param documentId Document ID
   * @returns Data URL for the PDF
   */
  getPdfDataUrl: async (documentId: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/pdf`);
    if (!response.ok) {
      throw new Error("Failed to fetch PDF");
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
};
