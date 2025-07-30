import { useCallback } from 'react';
import { documentApi } from '@/services/api/document';

interface UseDefinitionsProps {
  documentId: string;
  blockId: string;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
}

export const useDefinitions = ({ 
  documentId, 
  blockId, 
  onUpdateBlockMetadata 
}: UseDefinitionsProps) => {
  
  const saveDefinition = useCallback(async (
    term: string,
    startOffset: number,
    endOffset: number,
    currentMetadata?: any
  ): Promise<{ term: string; definition: string; fullResponse?: any }> => {
    try {
      const result = await documentApi.getTermDefinition(
        documentId,
        blockId,
        term,
        startOffset,
        endOffset
      );
      
      // Update block metadata optimistically using API response
      if (result && result.text_start_offset !== undefined && onUpdateBlockMetadata) {
        const definitionKey = `${startOffset}-${endOffset}`;
        const newMetadata = {
          definitions: {
            ...currentMetadata?.definitions,
            [definitionKey]: {
              term: result.term,
              definition: result.definition,
              text_start_offset: result.text_start_offset,
              text_end_offset: result.text_end_offset,
              created_at: result.created_at
            }
          }
        };
        onUpdateBlockMetadata(blockId, newMetadata);
        
        return { 
          term: result.term, 
          definition: result.definition, 
          fullResponse: result 
        };
      }
      
      return { 
        term: result.term || term, 
        definition: result.definition || '',
        fullResponse: result 
      };
    } catch (error) {
      console.error('Failed to save definition:', error);
      throw error; // Let the component handle the error
    }
  }, [documentId, blockId, onUpdateBlockMetadata]);

  return {
    saveDefinition
  };
};