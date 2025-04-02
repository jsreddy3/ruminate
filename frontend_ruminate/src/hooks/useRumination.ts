import { useState, useEffect, useCallback } from 'react';
import { BlockInsight } from '../types/insights';
import { insightsApi } from '../services/api/insights';

type RuminationStatus = 'pending' | 'complete' | 'error';

interface UseRuminationProps {
  documentId: string;
  onBlockProcessing?: (blockId: string | null) => void;
}

export function useRumination({ documentId, onBlockProcessing }: UseRuminationProps) {
  const [isRuminating, setIsRuminating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<BlockInsight[]>([]);
  const [status, setStatus] = useState<RuminationStatus>('pending');
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);

  // Start rumination process
  const startRumination = useCallback(async (objective: string) => {
    try {
      setIsRuminating(true);
      setError(null);
      setStatus('pending');
      setCurrentBlockId(null);
      
      // Start the rumination process
      await insightsApi.startRumination(documentId, objective);
      
      // Connect to SSE stream
      const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_BASE_URL}/insights/ruminate/stream/${documentId}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          setStatus('error');
          setCurrentBlockId(null);
          onBlockProcessing?.(null);
          eventSource.close();
          setIsRuminating(false);
          return;
        }
        
        // Update insights and status
        setInsights(data.insights || []);
        if (data.status) {
          setStatus(data.status);
          if (data.status === 'complete' || data.status === 'error') {
            setIsRuminating(false);
            setCurrentBlockId(null);
            onBlockProcessing?.(null);
            eventSource.close();
          }
        }

        // Update current block
        if (data.current_block_id !== currentBlockId) {
          setCurrentBlockId(data.current_block_id);
          onBlockProcessing?.(data.current_block_id);
        }
      };
      
      eventSource.onerror = () => {
        setError('Lost connection to server');
        setStatus('error');
        setCurrentBlockId(null);
        onBlockProcessing?.(null);
        eventSource.close();
        setIsRuminating(false);
      };
      
      return () => {
        eventSource.close();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start rumination');
      setStatus('error');
      setCurrentBlockId(null);
      onBlockProcessing?.(null);
      setIsRuminating(false);
    }
  }, [documentId, onBlockProcessing]);

  return {
    isRuminating,
    error,
    insights,
    status,
    currentBlockId,
    startRumination
  };
} 