import { Notes } from '../types/notes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";


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
  const response = await fetch(`${API_BASE_URL}/notes/auto-generate`, {
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
  const response = await fetch(`${API_BASE_URL}/notes/document/${documentId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch document notes: ${response.status}`);
  }
  
  return await response.json();
};

/**
 * Fetches all notes for a specific block
 */
export const getBlockNotes = async (blockId: string): Promise<Notes[]> => {
  const response = await fetch(`${API_BASE_URL}/notes/block/${blockId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch block notes: ${response.status}`);
  }
  
  return await response.json();
};
