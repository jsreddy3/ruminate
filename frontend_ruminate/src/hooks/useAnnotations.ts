import { useCallback } from 'react';
import { documentApi } from '@/services/api/document';

interface UseAnnotationsProps {
  documentId: string;
  blockId: string;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
}

interface AnnotationData {
  id: string;
  text: string;
  note: string;
  text_start_offset: number;
  text_end_offset: number;
  created_at: string;
  updated_at: string;
}

export const useAnnotations = ({ 
  documentId, 
  blockId, 
  onUpdateBlockMetadata 
}: UseAnnotationsProps) => {
  
  const saveAnnotation = useCallback(async (
    text: string,
    note: string,
    startOffset: number,
    endOffset: number,
    currentMetadata?: any
  ): Promise<void> => {
    try {
      const result = await documentApi.createAnnotation(
        documentId,
        blockId,
        text,
        note,
        startOffset,
        endOffset
      );
      
      // Update block metadata optimistically using API response
      if (result && 'id' in result && onUpdateBlockMetadata) {
        const annotationKey = `${startOffset}-${endOffset}`;
        const newMetadata = {
          annotations: {
            ...currentMetadata?.annotations,
            [annotationKey]: {
              id: result.id,
              text: result.text,
              note: result.note,
              text_start_offset: result.text_start_offset,
              text_end_offset: result.text_end_offset,
              created_at: result.created_at,
              updated_at: result.updated_at
            }
          }
        };
        onUpdateBlockMetadata(blockId, newMetadata);
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
      throw error; // Let the component handle the error
    }
  }, [documentId, blockId, onUpdateBlockMetadata]);

  const deleteAnnotation = useCallback(async (
    text: string,
    startOffset: number,
    endOffset: number,
    currentMetadata?: any
  ): Promise<void> => {
    try {
      await documentApi.deleteAnnotation(
        documentId,
        blockId,
        text,
        startOffset,
        endOffset
      );
      
      // Update block metadata by removing the annotation
      if (onUpdateBlockMetadata) {
        const annotationKey = `${startOffset}-${endOffset}`;
        const currentAnnotations = currentMetadata?.annotations || {};
        const { [annotationKey]: deleted, ...remainingAnnotations } = currentAnnotations;
        const newMetadata = {
          annotations: Object.keys(remainingAnnotations).length > 0 ? remainingAnnotations : undefined
        };
        onUpdateBlockMetadata(blockId, newMetadata);
      }
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      throw error; // Let the component handle the error
    }
  }, [documentId, blockId, onUpdateBlockMetadata]);

  return {
    saveAnnotation,
    deleteAnnotation
  };
};