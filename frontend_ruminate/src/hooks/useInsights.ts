import { useState, useEffect } from 'react';
import { BlockInsight } from '../types/insights';
import { insightsApi } from '../services/api/insights';

interface UseInsightsProps {
  documentId: string;
  blockId?: string;
}

export function useInsights({ documentId, blockId }: UseInsightsProps) {
  const [documentInsights, setDocumentInsights] = useState<BlockInsight[]>([]);
  const [currentBlockInsight, setCurrentBlockInsight] = useState<BlockInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all document insights
  useEffect(() => {
    async function fetchDocumentInsights() {
      if (!documentId) return;
      
      setIsLoading(true);
      setError(null);
      try {
        const insights = await insightsApi.getDocumentInsights(documentId);
        setDocumentInsights(insights);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch document insights');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocumentInsights();
  }, [documentId]);

  // Fetch specific block insight when blockId changes
  useEffect(() => {
    async function fetchBlockInsight() {
      if (!blockId) {
        setCurrentBlockInsight(null);
        return;
      }

      // First check if we already have this block's insights in our document cache
      const cachedInsight = documentInsights.find(insight => insight.block_id === blockId);
      if (cachedInsight) {
        setCurrentBlockInsight(cachedInsight);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const insight = await insightsApi.getBlockInsight(blockId, documentId);
        setCurrentBlockInsight(insight);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch block insight');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBlockInsight();
  }, [blockId, documentInsights]);

  // Function to analyze a specific block
  const analyzeBlock = async (blockContent: string, pageNumber: number) => {
    if (!blockId) return;

    setIsLoading(true);
    setError(null);
    try {
      const insight = await insightsApi.analyzeBlock(
        blockId,
        pageNumber,
        blockContent,
        documentId
      );
      setCurrentBlockInsight(insight);
      
      // Update document insights cache
      setDocumentInsights(prev => {
        const index = prev.findIndex(i => i.block_id === blockId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = insight;
          return updated;
        }
        return [...prev, insight];
      });

      return insight;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze block');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    documentInsights,
    currentBlockInsight,
    isLoading,
    error,
    analyzeBlock
  };
} 