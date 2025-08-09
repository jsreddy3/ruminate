import { authenticatedFetch, API_BASE_URL } from "../../utils/api";

// Base interface for all text enhancements
interface BaseTextEnhancement {
  id: string;
  document_id: string;
  block_id: string;
  user_id: string;
  text: string;
  text_start_offset: number;
  text_end_offset: number;
  created_at: string;
  updated_at: string;
}

// Type-specific interfaces
export interface DefinitionEnhancement extends BaseTextEnhancement {
  type: 'DEFINITION';
  data: {
    term: string;
    definition: string;
    context?: string;
  };
}

export interface AnnotationEnhancement extends BaseTextEnhancement {
  type: 'ANNOTATION';
  data: {
    note: string;
  };
}

export interface RabbitholeEnhancement extends BaseTextEnhancement {
  type: 'RABBITHOLE';
  data: {
    conversation_id: string;
  };
}

// Union type for all text enhancements
export type TextEnhancement = DefinitionEnhancement | AnnotationEnhancement | RabbitholeEnhancement;

export interface TextEnhancementsResponse {
  definitions: DefinitionEnhancement[];
  annotations: AnnotationEnhancement[];
  rabbitholes: RabbitholeEnhancement[];
}

export interface CreateDefinitionRequest {
  block_id: string;
  term: string;
  text_start_offset: number;
  text_end_offset: number;
  surrounding_text?: string;
}

export interface CreateAnnotationRequest {
  block_id: string;
  text: string;
  note: string;
  text_start_offset: number;
  text_end_offset: number;
}

export const textEnhancementsApi = {
  /**
   * Get all text enhancements for a document
   * @param documentId Document ID
   * @returns All text enhancements grouped by type
   */
  getAllForDocument: async (documentId: string): Promise<TextEnhancementsResponse> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/documents/${documentId}/text-enhancements`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch text enhancements');
    }
    
    return response.json();
  },

  /**
   * Create a new definition
   * @param documentId Document ID
   * @param request Definition creation request
   * @returns Created definition enhancement
   */
  createDefinition: async (
    documentId: string,
    request: CreateDefinitionRequest
  ): Promise<DefinitionEnhancement> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/documents/${documentId}/text-enhancements/definitions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to create definition');
    }
    
    return response.json();
  },

  /**
   * Create or update an annotation
   * @param documentId Document ID
   * @param request Annotation creation request
   * @returns Created/updated annotation enhancement or deletion message
   */
  createAnnotation: async (
    documentId: string,
    request: CreateAnnotationRequest
  ): Promise<AnnotationEnhancement | { message: string }> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/documents/${documentId}/text-enhancements/annotations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to create annotation');
    }
    
    return response.json();
  },

  /**
   * Delete a text enhancement
   * @param documentId Document ID
   * @param enhancementId Enhancement ID to delete
   * @returns Success message
   */
  deleteEnhancement: async (
    documentId: string,
    enhancementId: string
  ): Promise<{ message: string }> => {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/documents/${documentId}/text-enhancements/${enhancementId}`,
      {
        method: 'DELETE',
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to delete enhancement');
    }
    
    return response.json();
  },
};