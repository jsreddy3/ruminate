import { Notes } from '../types/notes';
import { authenticatedFetch, API_BASE_URL } from '../utils/api';


interface GenerateNoteParams {
  document_id: string;
  block_id: string;
  conversation_id: string;
  message_id: string;
  block_sequence_no?: number;
}

/**
 * Calls the API to auto-generate a note from a message
 */
export const generateNoteFromMessage = async (params: GenerateNoteParams): Promise<Notes> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/notes/auto-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to generate note: ${response.status}`);
  }
  
  return await response.json();
};

/**
 * Fetches all notes for a document
 */
export const getDocumentNotes = async (documentId: string): Promise<Notes[]> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/notes/document/${documentId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch document notes: ${response.status}`);
  }
  
  return await response.json();
};

/**
 * Fetches all notes for a specific block
 */
export const getBlockNotes = async (blockId: string): Promise<Notes[]> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/notes/block/${blockId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch block notes: ${response.status}`);
  }
  
  return await response.json();
};
