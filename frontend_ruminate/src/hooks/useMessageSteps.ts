import { useState, useEffect } from 'react';
import { agentApi, AgentStep } from '../services/api/agent';

/**
 * Hook to fetch agent process steps for a specific message
 * 
 * @param conversationId The ID of the conversation 
 * @param messageId The ID of the message to fetch steps for
 * @returns Object containing steps, loading state, and error
 */
export function useMessageSteps(conversationId: string | null, messageId: string | null) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    // Don't try to fetch steps if we don't have both IDs
    if (!conversationId || !messageId) return;
    
    async function fetchSteps() {
      setLoading(true);
      try {
        // Type assertion to string since we've already checked for null above
        const fetchedSteps = await agentApi.getMessageSteps(
          conversationId as string, 
          messageId as string
        );
        setSteps(fetchedSteps);
        setError(null);
      } catch (err) {
        console.error(`Error fetching steps for message ${messageId}:`, err);
        setError(err instanceof Error ? err : new Error('Failed to fetch message steps'));
        setSteps([]); // Clear steps on error
      } finally {
        setLoading(false);
      }
    }
    
    fetchSteps();
  }, [conversationId, messageId]);
  
  return { steps, loading, error };
} 