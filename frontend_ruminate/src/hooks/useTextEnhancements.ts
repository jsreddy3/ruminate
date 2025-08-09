import { useState, useEffect, useCallback } from 'react';
import { 
  textEnhancementsApi, 
  DefinitionEnhancement, 
  AnnotationEnhancement, 
  RabbitholeEnhancement, 
  TextEnhancementsResponse 
} from '../services/api/textEnhancements';

export interface UseTextEnhancementsResult {
  enhancements: TextEnhancementsResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // Helper methods to get enhancements for a specific block
  getDefinitionsForBlock: (blockId: string) => DefinitionEnhancement[];
  getAnnotationsForBlock: (blockId: string) => AnnotationEnhancement[];
  getRabbitholesForBlock: (blockId: string) => RabbitholeEnhancement[];
}

/**
 * Hook to manage text enhancements for a document
 * Fetches all enhancements on mount and provides helper methods
 */
export const useTextEnhancements = (documentId: string): UseTextEnhancementsResult => {
  const [enhancements, setEnhancements] = useState<TextEnhancementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all enhancements for the document
  const fetchEnhancements = useCallback(async () => {
    if (!documentId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await textEnhancementsApi.getAllForDocument(documentId);
      setEnhancements(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch enhancements'));
      console.error('Error fetching text enhancements:', err);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Fetch on mount and when documentId changes
  useEffect(() => {
    fetchEnhancements();
  }, [fetchEnhancements]);

  // Helper methods to filter enhancements by block
  const getDefinitionsForBlock = useCallback(
    (blockId: string): DefinitionEnhancement[] => {
      if (!enhancements) return [];
      return enhancements.definitions.filter(def => def.block_id === blockId);
    },
    [enhancements]
  );

  const getAnnotationsForBlock = useCallback(
    (blockId: string): AnnotationEnhancement[] => {
      if (!enhancements) return [];
      return enhancements.annotations.filter(ann => ann.block_id === blockId);
    },
    [enhancements]
  );

  const getRabbitholesForBlock = useCallback(
    (blockId: string): RabbitholeEnhancement[] => {
      if (!enhancements) return [];
      return enhancements.rabbitholes.filter(rab => rab.block_id === blockId);
    },
    [enhancements]
  );

  return {
    enhancements,
    loading,
    error,
    refetch: fetchEnhancements,
    getDefinitionsForBlock,
    getAnnotationsForBlock,
    getRabbitholesForBlock,
  };
};