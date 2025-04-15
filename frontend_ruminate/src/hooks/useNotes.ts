import { useState } from 'react';
import { generateNoteFromMessage, getDocumentNotes, getBlockNotes } from '../services/notes';
import { Notes } from '../types/notes';

interface GenerateNoteParams {
  documentId: string;
  blockId: string;
  conversationId: string;
  messageId: string;
  blockSequenceNo?: number;
}

export function useNotes() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedNote, setGeneratedNote] = useState<Notes | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateNote = async (params: GenerateNoteParams) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // Transform params to match API expectations
      const apiParams = {
        document_id: params.documentId,
        block_id: params.blockId,
        conversation_id: params.conversationId,
        message_id: params.messageId,
        block_sequence_no: params.blockSequenceNo
      };
      
      const result = await generateNoteFromMessage(apiParams);
      setGeneratedNote(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate note';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchDocumentNotes = async (documentId: string) => {
    try {
      return await getDocumentNotes(documentId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch document notes';
      setError(errorMessage);
      throw err;
    }
  };

  const fetchBlockNotes = async (blockId: string) => {
    try {
      return await getBlockNotes(blockId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch block notes';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    isGenerating,
    generatedNote,
    error,
    generateNote,
    fetchDocumentNotes,
    fetchBlockNotes
  };
}
